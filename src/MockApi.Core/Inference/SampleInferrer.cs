using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MockApi.Core.Schemas;

namespace MockApi.Core.Inference;

/// <summary>
/// Infers a valid <see cref="Schema"/> from a JSON sample entirely in memory. The sample is
/// never stored or logged; only enum values survive as part of the resulting schema.
/// </summary>
public sealed class SampleInferrer
{
    public InferenceResult Infer(JsonElement sample, InferenceOptions? options = null) =>
        new Session(options ?? new InferenceOptions()).Run(sample);

    public InferenceResult Infer(string json, InferenceOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(json);

        var effectiveOptions = options ?? new InferenceOptions();

        if (Encoding.UTF8.GetByteCount(json) > effectiveOptions.Limits.MaxSampleBytes)
        {
            throw SampleInferenceException.TooComplex(
                $"The sample exceeds the {effectiveOptions.Limits.MaxSampleBytes} byte limit."
            );
        }

        using var document = JsonDocument.Parse(json);
        return Infer(document.RootElement, effectiveOptions);
    }

    public InferenceResult Infer(JsonNode? sample, InferenceOptions? options = null)
    {
        if (sample is null)
        {
            throw SampleInferenceException.Invalid("The sample must be a JSON object or array.");
        }

        return Infer(sample.ToJsonString(), options);
    }

    private sealed class Session
    {
        private static readonly Regex UuidPattern = new(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
            RegexOptions.CultureInvariant
        );

        private static readonly Regex EmailPattern = new(
            "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
            RegexOptions.CultureInvariant
        );

        private static readonly Regex DateTimePattern = new(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,7})?(?:Z|[+-]\\d{2}:\\d{2})$",
            RegexOptions.CultureInvariant
        );

        private static readonly Regex DatePattern = new(
            "^\\d{4}-\\d{2}-\\d{2}$",
            RegexOptions.CultureInvariant
        );

        private static readonly Regex WordSeparator = new("[\\s]+", RegexOptions.CultureInvariant);

        private readonly InferenceOptions _options;
        private readonly InferenceLimits _limits;
        private readonly List<InferenceWarning> _warnings = [];
        private readonly IReadOnlyList<string> _endpointTokens;
        private int _nodeCount;

        public Session(InferenceOptions options)
        {
            _options = options;
            _limits = options.Limits;
            _endpointTokens = Tokenize(options.EndpointPath ?? string.Empty);
        }

        public InferenceResult Run(JsonElement sample)
        {
            var raw = sample.GetRawText();

            if (Encoding.UTF8.GetByteCount(raw) > _limits.MaxSampleBytes)
            {
                throw SampleInferenceException.TooComplex(
                    $"The sample exceeds the {_limits.MaxSampleBytes} byte limit."
                );
            }

            if (sample.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array))
            {
                throw SampleInferenceException.Invalid(
                    "The sample root must be a JSON object or array."
                );
            }

            var inferred = ReadValue(sample, string.Empty, 1);
            SchemaNode root = BuildNode(
                inferred,
                string.Empty,
                [],
                _endpointTokens,
                1,
                suppressNullWarning: false
            );

            if (_options.WrapInList && root is not ArrayNode)
            {
                root = new ArrayNode { Item = root };
            }

            return new InferenceResult
            {
                Schema = new Schema { Version = 1, Root = root },
                Warnings = _warnings,
                Suggestions = BuildSuggestions(root),
            };
        }

        private Inferred ReadValue(JsonElement element, string path, int depth)
        {
            if (depth > _limits.MaxDepth)
            {
                throw SampleInferenceException.TooComplex(
                    $"The sample may be nested at most {_limits.MaxDepth} levels deep."
                );
            }

            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                {
                    var inferred = new InferredObject();
                    var fieldCount = 0;

                    foreach (var property in element.EnumerateObject())
                    {
                        fieldCount++;

                        if (fieldCount > _limits.MaxFieldsPerObject)
                        {
                            throw SampleInferenceException.TooComplex(
                                $"An object may contain at most {_limits.MaxFieldsPerObject} fields."
                            );
                        }

                        inferred.Add(
                            property.Name,
                            ReadValue(property.Value, AppendPointer(path, property.Name), depth + 1)
                        );
                    }

                    return inferred;
                }

                case JsonValueKind.Array:
                {
                    var inferred = new InferredArray { MaxLength = element.GetArrayLength() };

                    var index = 0;

                    foreach (var item in element.EnumerateArray())
                    {
                        inferred.Items.Add(ReadValue(item, AppendPointer(path, index), depth + 1));
                        index++;
                    }

                    return inferred;
                }

                case JsonValueKind.String:
                    return new InferredString([element.GetString() ?? string.Empty]);

                case JsonValueKind.Number:
                    return ReadNumber(element);

                case JsonValueKind.True:
                    return new InferredBoolean([true]);

                case JsonValueKind.False:
                    return new InferredBoolean([false]);

                case JsonValueKind.Null:
                    return InferredNull.Instance;

                default:
                    return InferredNull.Instance;
            }
        }

        private static Inferred ReadNumber(JsonElement element)
        {
            var raw = element.GetRawText();
            var isInteger = raw.IndexOfAny(['.', 'e', 'E']) < 0;

            if (
                isInteger
                && long.TryParse(
                    raw,
                    NumberStyles.AllowLeadingSign,
                    CultureInfo.InvariantCulture,
                    out var integer
                )
            )
            {
                return new InferredInteger([integer]);
            }

            var value = element.TryGetDouble(out var parsed) ? parsed : 0;
            return new InferredNumber([value], DecimalPlaces(raw));
        }

        private SchemaNode BuildNode(
            Inferred data,
            string path,
            IReadOnlyList<string> keyTokens,
            IReadOnlyList<string> parentHint,
            int depth,
            bool suppressNullWarning
        )
        {
            if (depth > _limits.MaxDepth)
            {
                throw SampleInferenceException.TooComplex(
                    $"The schema may be nested at most {_limits.MaxDepth} levels deep."
                );
            }

            _nodeCount++;

            if (_nodeCount > _limits.MaxNodes)
            {
                throw SampleInferenceException.TooComplex(
                    $"The schema may contain at most {_limits.MaxNodes} nodes."
                );
            }

            return data switch
            {
                InferredObject inferredObject => BuildObject(
                    inferredObject,
                    path,
                    keyTokens,
                    parentHint,
                    depth
                ),
                InferredArray inferredArray => BuildArray(
                    inferredArray,
                    path,
                    keyTokens,
                    parentHint,
                    depth
                ),
                _ => BuildLeaf(data, path, keyTokens, parentHint, suppressNullWarning),
            };
        }

        private ObjectNode BuildObject(
            InferredObject data,
            string path,
            IReadOnlyList<string> keyTokens,
            IReadOnlyList<string> parentHint,
            int depth
        )
        {
            var childParentHint = keyTokens.Count > 0 ? keyTokens : parentHint;
            var fields = new List<SchemaField>(data.Order.Count);

            foreach (var name in data.Order)
            {
                var state = data.Fields[name];
                var fieldPath = AppendPointer(path, name);
                var tokens = Tokenize(name);
                var values = MergeAll(state.Values, fieldPath);

                var node = BuildNode(
                    values,
                    fieldPath,
                    tokens,
                    childParentHint,
                    depth + 1,
                    suppressNullWarning: false
                );

                var nullProbability =
                    state.PresentCount > 0 ? (double)state.NullCount / state.PresentCount : 0;
                var omitProbability =
                    data.Observations > 0
                        ? (double)(data.Observations - state.PresentCount) / data.Observations
                        : 0;

                fields.Add(
                    new SchemaField
                    {
                        Name = name,
                        Node = node,
                        NullProbability = nullProbability > 0 ? nullProbability : null,
                        OmitProbability = omitProbability > 0 ? omitProbability : null,
                    }
                );
            }

            return new ObjectNode { Fields = fields };
        }

        private ArrayNode BuildArray(
            InferredArray data,
            string path,
            IReadOnlyList<string> keyTokens,
            IReadOnlyList<string> parentHint,
            int depth
        )
        {
            var length = new ArrayLength(1, Math.Max(3, data.MaxLength));
            var itemParentHint = keyTokens.Count > 0 ? keyTokens : parentHint;

            if (data.Items.Count == 0)
            {
                AddWarning(
                    InferenceWarningCodes.EmptyArray,
                    path,
                    "The array is empty; its item type is unknown."
                );

                var emptyItem = BuildNode(
                    InferredNull.Instance,
                    AppendPointer(path, 0),
                    [],
                    itemParentHint,
                    depth + 1,
                    suppressNullWarning: true
                );

                return new ArrayNode { Item = emptyItem, Length = length };
            }

            var itemPath = AppendPointer(path, 0);
            var itemData = MergeAll(data.Items, itemPath);
            var item = BuildNode(
                itemData,
                itemPath,
                [],
                itemParentHint,
                depth + 1,
                suppressNullWarning: false
            );

            return new ArrayNode { Item = item, Length = length };
        }

        private SchemaNode BuildLeaf(
            Inferred data,
            string path,
            IReadOnlyList<string> keyTokens,
            IReadOnlyList<string> parentHint,
            bool suppressNullWarning
        )
        {
            if (data is InferredNull)
            {
                if (!suppressNullWarning)
                {
                    AddWarning(
                        InferenceWarningCodes.NullTypeUnknown,
                        path,
                        "Only null values were observed; a null generator is used."
                    );
                }

                return new LeafNode(SchemaNodeType.Null, new GeneratorSpec { Name = "nullValue" });
            }

            var generator = SelectGenerator(data, path, keyTokens, parentHint);
            return new LeafNode(data.NodeType, generator);
        }

        private GeneratorSpec SelectGenerator(
            Inferred data,
            string path,
            IReadOnlyList<string> keyTokens,
            IReadOnlyList<string> parentHint
        )
        {
            if (IsRemovedPattern(data, keyTokens, parentHint))
            {
                return Fallback(data, path);
            }

            if (data is InferredString textData)
            {
                var value = textData.Values[0];
                var pattern = ByValuePattern(value);

                if (pattern is not null)
                {
                    return pattern;
                }
            }

            var named = ByName(data, path, keyTokens, parentHint);

            if (named is not null)
            {
                return named;
            }

            if (
                data is InferredString enumData
                && enumData.Values.Count >= 2
                && TryEnum(enumData.Values, maxDistinct: 10, out var enumGenerator)
            )
            {
                AddWarning(
                    InferenceWarningCodes.EnumFromSample,
                    path,
                    "Distinct sample values were converted to an enum."
                );
                return enumGenerator;
            }

            return Fallback(data, path);
        }

        private static GeneratorSpec? ByValuePattern(string value)
        {
            if (UuidPattern.IsMatch(value))
            {
                return Generator("uuid");
            }

            if (EmailPattern.IsMatch(value))
            {
                return Generator("email");
            }

            if (
                DateTimePattern.IsMatch(value)
                && DateTimeOffset.TryParse(
                    value,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out _
                )
            )
            {
                var format = value.Contains('.', StringComparison.Ordinal)
                    ? "iso-datetime-ms"
                    : "iso-datetime";

                return DateGenerator("dateTime", "past", 365, format: format);
            }

            if (
                DatePattern.IsMatch(value)
                && DateOnly.TryParseExact(
                    value,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out _
                )
            )
            {
                return DateGenerator("date", "past", 365);
            }

            if (
                Uri.TryCreate(value, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            )
            {
                return Generator("url");
            }

            return null;
        }

        private GeneratorSpec? ByName(
            Inferred data,
            string path,
            IReadOnlyList<string> tokens,
            IReadOnlyList<string> parentHint
        )
        {
            if (data is InferredString stringData)
            {
                if (LastIs(tokens, "email", "mail"))
                {
                    return Generator("email");
                }

                if (
                    (Has(tokens, "first") && Has(tokens, "name"))
                    || Has(tokens, "firstname", "givenname")
                )
                {
                    return Generator("firstName");
                }

                if (
                    (Has(tokens, "last") && Has(tokens, "name"))
                    || Has(tokens, "lastname", "surname", "familyname")
                )
                {
                    return Generator("lastName");
                }

                if (
                    Has(tokens, "username", "login", "handle", "nickname")
                    || (Has(tokens, "user") && Has(tokens, "name"))
                )
                {
                    return Generator("username");
                }

                if (
                    Has(tokens, "company", "organization", "employer", "brand")
                    || (
                        Has(tokens, "name")
                        && Has(parentHint, "company", "organization", "org", "employer")
                    )
                )
                {
                    return Generator("company");
                }

                if (Has(tokens, "name", "fullname", "displayname"))
                {
                    return Generator("fullName");
                }

                if (Has(tokens, "phone", "mobile", "tel", "telephone", "fax"))
                {
                    return Generator("phone");
                }

                if (Has(tokens, "city", "town"))
                {
                    return Generator("city");
                }

                if (Has(tokens, "country"))
                {
                    return Generator("country");
                }

                if (Has(tokens, "url", "uri", "link", "website", "homepage", "href"))
                {
                    return Generator("url");
                }

                if (Has(tokens, "title", "headline", "subject"))
                {
                    return Generator("sentence", Parameters(("minWords", 3), ("maxWords", 8)));
                }

                if (
                    Has(
                        tokens,
                        "description",
                        "summary",
                        "bio",
                        "about",
                        "content",
                        "body",
                        "comment",
                        "message",
                        "note",
                        "notes",
                        "text"
                    )
                )
                {
                    return Generator("paragraph", Parameters(("sentences", 3)));
                }

                if (
                    Has(
                        tokens,
                        "status",
                        "state",
                        "type",
                        "kind",
                        "role",
                        "category",
                        "level",
                        "priority",
                        "gender"
                    ) && TryEnum(stringData.Values, maxDistinct: 50, out var enumGenerator)
                )
                {
                    return enumGenerator;
                }

                if (Has(tokens, "birth", "birthday", "dob"))
                {
                    return DateGenerator("date", "past", 29_200, minDaysAgo: 6_570);
                }

                if (
                    Has(tokens, "expires", "expiry", "due", "deadline", "until", "scheduled")
                    || (Has(tokens, "next") && Has(tokens, "date", "time", "at"))
                )
                {
                    return DateGenerator("dateTime", "future", 365);
                }

                if (
                    LastIs(tokens, "at", "on", "date", "time", "timestamp")
                    || Has(tokens, "created", "updated", "deleted")
                )
                {
                    return DateGenerator("dateTime", "past", 365);
                }

                if (TryNumericString(stringData.Values[0], out var numeric) && IsPriceKey(tokens))
                {
                    return PriceGenerator(numeric);
                }
            }

            if (data is InferredInteger or InferredNumber)
            {
                var sample = NumberSample(data);

                if (data is InferredInteger && tokens.Count == 1 && tokens[0] == "id")
                {
                    var start = sample is >= 0 and <= int.MaxValue ? (int)sample : 1;
                    return Generator("autoId", Parameters(("start", start)));
                }

                if (Has(tokens, "age"))
                {
                    return data is InferredInteger
                        ? Generator("randomInt", Parameters(("min", 18), ("max", 80)))
                        : NumberGenerator(18, 80, 0);
                }

                if (data is InferredInteger && Has(tokens, "year"))
                {
                    return Generator(
                        "randomInt",
                        Parameters(("min", 1990), ("max", DateTime.UtcNow.Year))
                    );
                }

                if (Has(tokens, "rating", "score", "stars"))
                {
                    return data is InferredInteger
                        ? Generator("randomInt", Parameters(("min", 1), ("max", 5)))
                        : NumberGenerator(1, 5, 1);
                }

                if (IsPriceKey(tokens))
                {
                    if (data is InferredInteger)
                    {
                        return Generator(
                            "randomInt",
                            Parameters(("min", 1), ("max", CountMaximum(sample)))
                        );
                    }

                    return PriceGenerator(sample);
                }

                if (
                    data is InferredInteger
                    && LastIs(
                        tokens,
                        "count",
                        "quantity",
                        "qty",
                        "stock",
                        "likes",
                        "views",
                        "followers"
                    )
                )
                {
                    return Generator(
                        "randomInt",
                        Parameters(("min", 0), ("max", CountMaximum(sample)))
                    );
                }

                if (Has(tokens, "percent", "percentage"))
                {
                    return data is InferredInteger
                        ? Generator("randomInt", Parameters(("min", 0), ("max", 100)))
                        : NumberGenerator(0, 100, 0);
                }
            }

            return null;
        }

        private GeneratorSpec Fallback(Inferred data, string path)
        {
            switch (data)
            {
                case InferredInteger integerData:
                {
                    var value = integerData.Values[0];
                    var doubled = DoubleInteger(value);
                    var min = (int)Math.Min(0, doubled);
                    var max = (int)Math.Max(10, doubled);
                    return Generator("randomInt", Parameters(("min", min), ("max", max)));
                }

                case InferredNumber numberData:
                {
                    var value = numberData.Values[0];
                    var min = Math.Min(0, value * 2);
                    var max = Math.Max(10, value * 2);
                    return NumberGenerator(min, max, numberData.Precision);
                }

                case InferredBoolean:
                    return Generator("randomBool", Parameters(("trueProbability", 0.5)));

                case InferredString stringData:
                {
                    var words = Math.Clamp(
                        WordSeparator.Split(stringData.Values[0].Trim()).Length,
                        1,
                        6
                    );
                    var min = Math.Max(1, words - 1);
                    var max = Math.Min(6, words + 1);
                    return Generator("words", Parameters(("min", min), ("max", max)));
                }

                default:
                    AddWarning(
                        InferenceWarningCodes.NullTypeUnknown,
                        path,
                        "Only null values were observed; a null generator is used."
                    );
                    return Generator("nullValue");
            }
        }

        private static bool IsRemovedPattern(
            Inferred data,
            IReadOnlyList<string> tokens,
            IReadOnlyList<string> parentHint
        )
        {
            if (Has(tokens, "email", "mail"))
            {
                return false;
            }

            if (Has(tokens, "country") && Has(tokens, "code"))
            {
                return true;
            }

            if (Has(tokens, "province"))
            {
                return true;
            }

            if (
                Has(tokens, "state")
                && Has(parentHint, "address", "location", "billing", "shipping")
            )
            {
                return true;
            }

            if (
                Has(
                    tokens,
                    "street",
                    "address",
                    "address1",
                    "address2",
                    "zip",
                    "postal",
                    "postcode",
                    "currency",
                    "avatar",
                    "photo",
                    "picture",
                    "image",
                    "img",
                    "thumbnail",
                    "logo",
                    "icon",
                    "color",
                    "colour",
                    "ip",
                    "ipaddress",
                    "job",
                    "position",
                    "jobtitle",
                    "sku"
                )
            )
            {
                return true;
            }

            if (Has(tokens, "name") && Has(parentHint, "product", "item", "goods"))
            {
                return true;
            }

            if (data is InferredInteger && Has(tokens, "unix", "timestamp"))
            {
                return true;
            }

            return false;
        }

        private static bool TryEnum(
            IReadOnlyList<string> values,
            int maxDistinct,
            out GeneratorSpec generator
        )
        {
            var distinct = values.Distinct(StringComparer.Ordinal).ToArray();

            if (distinct.Length is < 1 || distinct.Length > maxDistinct)
            {
                generator = null!;
                return false;
            }

            var array = new JsonArray();
            foreach (var value in distinct)
            {
                array.Add(JsonValue.Create(value));
            }

            generator = Generator("enum", new JsonObject { ["values"] = array });
            return true;
        }

        private Inferred MergeAll(IReadOnlyList<Inferred> values, string path)
        {
            if (values.Count == 0)
            {
                return InferredNull.Instance;
            }

            var nonNull = values.Where(value => value is not InferredNull).ToArray();

            if (nonNull.Length == 0)
            {
                return InferredNull.Instance;
            }

            var distinct = nonNull.Select(value => value.Kind).Distinct().ToArray();

            var chosen = ChooseKind(nonNull, distinct);

            if (distinct.Length > 1)
            {
                AddWarning(
                    InferenceWarningCodes.MixedTypes,
                    path,
                    $"Values have different types; '{chosen.ToString().ToLowerInvariant()}' was chosen."
                );
            }

            return chosen switch
            {
                InferredKind.String => new InferredString(
                    nonNull.OfType<InferredString>().SelectMany(value => value.Values).ToArray()
                ),
                InferredKind.Integer => new InferredInteger(
                    nonNull.OfType<InferredInteger>().SelectMany(value => value.Values).ToArray()
                ),
                InferredKind.Number => MergeNumbers(nonNull),
                InferredKind.Boolean => new InferredBoolean(
                    nonNull.OfType<InferredBoolean>().SelectMany(value => value.Values).ToArray()
                ),
                InferredKind.Object => MergeObjects(nonNull.OfType<InferredObject>().ToArray()),
                InferredKind.Array => MergeArrays(nonNull.OfType<InferredArray>().ToArray()),
                _ => InferredNull.Instance,
            };
        }

        private static InferredKind ChooseKind(
            IReadOnlyList<Inferred> nonNull,
            IReadOnlyList<InferredKind> distinct
        )
        {
            if (
                distinct.Contains(InferredKind.Integer)
                && distinct.Contains(InferredKind.Number)
                && distinct.All(kind => kind is InferredKind.Integer or InferredKind.Number)
            )
            {
                return InferredKind.Number;
            }

            InferredKind? best = null;
            var bestCount = -1;
            var bestIndex = int.MaxValue;

            for (var index = 0; index < nonNull.Count; index++)
            {
                var kind = nonNull[index].Kind;
                var count = nonNull.Count(value => value.Kind == kind);

                if (count > bestCount || (count == bestCount && index < bestIndex))
                {
                    best = kind;
                    bestCount = count;
                    bestIndex = index;
                }
            }

            if (best == InferredKind.Integer && distinct.Contains(InferredKind.Number))
            {
                return InferredKind.Number;
            }

            return best ?? InferredKind.Null;
        }

        private static InferredNumber MergeNumbers(IReadOnlyList<Inferred> values)
        {
            var numbers = new List<double>();
            var precision = 0;

            foreach (var value in values)
            {
                switch (value)
                {
                    case InferredNumber number:
                        numbers.AddRange(number.Values);
                        precision = Math.Max(precision, number.Precision);
                        break;
                    case InferredInteger integer:
                        numbers.AddRange(integer.Values.Select(item => (double)item));
                        break;
                }
            }

            return new InferredNumber(numbers, Math.Min(precision, 6));
        }

        private static InferredObject MergeObjects(IReadOnlyList<InferredObject> objects)
        {
            var merged = new InferredObject { Observations = 0 };

            foreach (var source in objects)
            {
                merged.Observations += source.Observations;

                foreach (var name in source.Order)
                {
                    if (!merged.Fields.TryGetValue(name, out var target))
                    {
                        target = new ObjectFieldState();
                        merged.Fields[name] = target;
                        merged.Order.Add(name);
                    }

                    var incoming = source.Fields[name];
                    target.PresentCount += incoming.PresentCount;
                    target.NullCount += incoming.NullCount;
                    target.Values.AddRange(incoming.Values);
                }
            }

            return merged;
        }

        private static InferredArray MergeArrays(IReadOnlyList<InferredArray> arrays)
        {
            var merged = new InferredArray();

            foreach (var source in arrays)
            {
                merged.MaxLength = Math.Max(merged.MaxLength, source.MaxLength);
                merged.Items.AddRange(source.Items);
            }

            return merged;
        }

        private InferenceSuggestions BuildSuggestions(SchemaNode root)
        {
            if (root is not ObjectNode objectNode)
            {
                return new InferenceSuggestions();
            }

            var arrayFields = objectNode.Fields.Where(field => field.Node is ArrayNode).ToArray();
            var listPath =
                arrayFields.Length == 1 ? AppendPointer(string.Empty, arrayFields[0].Name) : null;

            string? page = null;
            string? limit = null;
            string? total = null;
            string? totalPages = null;
            string? hasNext = null;
            string? hasPrev = null;

            Scan(objectNode, string.Empty);

            foreach (var field in objectNode.Fields)
            {
                if (field.Node is ObjectNode nested)
                {
                    Scan(nested, AppendPointer(string.Empty, field.Name));
                }
            }

            void Scan(ObjectNode node, string prefix)
            {
                foreach (var field in node.Fields)
                {
                    var name = NormalizeKey(field.Name);
                    var pointer = AppendPointer(prefix, field.Name);

                    switch (name)
                    {
                        case "page":
                            page ??= pointer;
                            break;
                        case "limit":
                        case "perpage":
                        case "pagesize":
                            limit ??= pointer;
                            break;
                        case "total":
                        case "totalitems":
                        case "count":
                            total ??= pointer;
                            break;
                        case "totalpages":
                            totalPages ??= pointer;
                            break;
                        case "hasnext":
                            hasNext ??= pointer;
                            break;
                        case "hasprev":
                            hasPrev ??= pointer;
                            break;
                    }
                }
            }

            PaginationSuggestion? pagination = null;

            if (
                page is not null
                || limit is not null
                || total is not null
                || totalPages is not null
                || hasNext is not null
                || hasPrev is not null
            )
            {
                pagination = new PaginationSuggestion
                {
                    Bindings = new PaginationBindings
                    {
                        Page = page,
                        Limit = limit,
                        Total = total,
                        TotalPages = totalPages,
                        HasNext = hasNext,
                        HasPrev = hasPrev,
                    },
                };
            }

            return new InferenceSuggestions
            {
                List = listPath is null ? null : new ListSuggestion { Path = listPath },
                Pagination = pagination,
            };
        }

        private void AddWarning(string code, string path, string message) =>
            _warnings.Add(new InferenceWarning(code, path, message));

        private static GeneratorSpec Generator(string name, JsonObject? parameters = null) =>
            new() { Name = name, Params = parameters };

        private static GeneratorSpec DateGenerator(
            string name,
            string kind,
            int rangeDays,
            int? minDaysAgo = null,
            string? format = null
        )
        {
            var parameters = new JsonObject { ["kind"] = kind, ["rangeDays"] = rangeDays };

            if (minDaysAgo is { } minimum)
            {
                parameters["minDaysAgo"] = minimum;
            }

            if (format is not null)
            {
                parameters["format"] = format;
            }

            return Generator(name, parameters);
        }

        private static GeneratorSpec NumberGenerator(double min, double max, int precision) =>
            Generator(
                "randomDecimal",
                Parameters(("min", min), ("max", max), ("precision", precision))
            );

        private static GeneratorSpec PriceGenerator(double value)
        {
            var max = Math.Max(100, value * 2);
            return Generator("price", Parameters(("min", 1), ("max", max)));
        }

        private static JsonObject Parameters(params (string Name, object Value)[] values)
        {
            var parameters = new JsonObject();

            foreach (var (name, value) in values)
            {
                parameters[name] = value switch
                {
                    int integer => JsonValue.Create(integer),
                    long longValue => JsonValue.Create(longValue),
                    double number => JsonValue.Create(number),
                    string text => JsonValue.Create(text),
                    bool boolean => JsonValue.Create(boolean),
                    _ => JsonValue.Create(value.ToString()),
                };
            }

            return parameters;
        }

        private static bool LastIs(IReadOnlyList<string> tokens, params string[] values) =>
            tokens.Count > 0 && values.Contains(tokens[^1], StringComparer.Ordinal);

        private static bool Has(IReadOnlyList<string> tokens, params string[] values) =>
            tokens.Any(token => values.Contains(token, StringComparer.Ordinal));

        private static bool IsPriceKey(IReadOnlyList<string> tokens) =>
            Has(
                tokens,
                "price",
                "amount",
                "cost",
                "total",
                "subtotal",
                "fee",
                "salary",
                "balance",
                "budget",
                "revenue"
            );

        private static double NumberSample(Inferred data) =>
            data switch
            {
                InferredInteger integer => integer.Values[0],
                InferredNumber number => number.Values[0],
                _ => 0,
            };

        private static int CountMaximum(double value) =>
            (int)Math.Clamp(Math.Max(100, value * 2), 0, int.MaxValue);

        private static long DoubleInteger(long value)
        {
            if (value is >= int.MinValue / 2 and <= int.MaxValue / 2)
            {
                return value * 2;
            }

            return value < 0 ? int.MinValue : int.MaxValue;
        }

        private static bool TryNumericString(string value, out double number) =>
            double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out number);

        private static int DecimalPlaces(string raw)
        {
            var exponent = raw.IndexOfAny(['e', 'E']);
            var mantissa = exponent >= 0 ? raw[..exponent] : raw;
            var dot = mantissa.IndexOf('.', StringComparison.Ordinal);

            return dot < 0 ? 0 : Math.Min(6, mantissa.Length - dot - 1);
        }

        private static string AppendPointer(string path, string token) =>
            $"{path}/{EscapePointer(token)}";

        private static string AppendPointer(string path, int index) => $"{path}/{index}";

        private static string EscapePointer(string token) =>
            token
                .Replace("~", "~0", StringComparison.Ordinal)
                .Replace("/", "~1", StringComparison.Ordinal);

        private static string NormalizeKey(string key) =>
            key.Replace("_", string.Empty, StringComparison.Ordinal)
                .Replace("-", string.Empty, StringComparison.Ordinal)
                .ToLowerInvariant();

        private static IReadOnlyList<string> Tokenize(string key)
        {
            var tokens = new List<string>();
            var current = new StringBuilder();

            for (var index = 0; index < key.Length; index++)
            {
                var character = key[index];

                if (!char.IsLetterOrDigit(character))
                {
                    Flush();
                    continue;
                }

                if (char.IsUpper(character) && current.Length > 0)
                {
                    var previous = key[index - 1];
                    var nextIsLower = index + 1 < key.Length && char.IsLower(key[index + 1]);

                    if (
                        char.IsLower(previous)
                        || char.IsDigit(previous)
                        || (char.IsUpper(previous) && nextIsLower)
                    )
                    {
                        Flush();
                    }
                }

                current.Append(char.ToLowerInvariant(character));
            }

            Flush();
            return tokens;

            void Flush()
            {
                if (current.Length == 0)
                {
                    return;
                }

                tokens.Add(current.ToString());
                current.Clear();
            }
        }
    }

    private enum InferredKind
    {
        Null,
        Boolean,
        Integer,
        Number,
        String,
        Object,
        Array,
    }

    private abstract class Inferred
    {
        public abstract InferredKind Kind { get; }

        public abstract SchemaNodeType NodeType { get; }
    }

    private sealed class InferredNull : Inferred
    {
        public static InferredNull Instance { get; } = new();

        public override InferredKind Kind => InferredKind.Null;

        public override SchemaNodeType NodeType => SchemaNodeType.Null;
    }

    private sealed class InferredBoolean(IReadOnlyList<bool> values) : Inferred
    {
        public IReadOnlyList<bool> Values { get; } = values;

        public override InferredKind Kind => InferredKind.Boolean;

        public override SchemaNodeType NodeType => SchemaNodeType.Boolean;
    }

    private sealed class InferredInteger(IReadOnlyList<long> values) : Inferred
    {
        public IReadOnlyList<long> Values { get; } = values;

        public override InferredKind Kind => InferredKind.Integer;

        public override SchemaNodeType NodeType => SchemaNodeType.Integer;
    }

    private sealed class InferredNumber(IReadOnlyList<double> values, int precision) : Inferred
    {
        public IReadOnlyList<double> Values { get; } = values;

        public int Precision { get; } = precision;

        public override InferredKind Kind => InferredKind.Number;

        public override SchemaNodeType NodeType => SchemaNodeType.Number;
    }

    private sealed class InferredString(IReadOnlyList<string> values) : Inferred
    {
        public IReadOnlyList<string> Values { get; } = values;

        public override InferredKind Kind => InferredKind.String;

        public override SchemaNodeType NodeType => SchemaNodeType.String;
    }

    private sealed class InferredObject : Inferred
    {
        public List<string> Order { get; } = [];

        public Dictionary<string, ObjectFieldState> Fields { get; } = new(StringComparer.Ordinal);

        public int Observations { get; set; } = 1;

        public override InferredKind Kind => InferredKind.Object;

        public override SchemaNodeType NodeType => SchemaNodeType.Object;

        public void Add(string name, Inferred value)
        {
            if (!Fields.TryGetValue(name, out var state))
            {
                state = new ObjectFieldState();
                Fields[name] = state;
                Order.Add(name);
            }

            state.PresentCount++;

            if (value is InferredNull)
            {
                state.NullCount++;
            }
            else
            {
                state.Values.Add(value);
            }
        }
    }

    private sealed class InferredArray : Inferred
    {
        public List<Inferred> Items { get; } = [];

        public int MaxLength { get; set; }

        public override InferredKind Kind => InferredKind.Array;

        public override SchemaNodeType NodeType => SchemaNodeType.Array;
    }

    private sealed class ObjectFieldState
    {
        public int PresentCount { get; set; }

        public int NullCount { get; set; }

        public List<Inferred> Values { get; } = [];
    }
}
