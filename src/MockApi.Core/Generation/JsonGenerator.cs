using System.Buffers;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using MockApi.Core.Schemas;

namespace MockApi.Core.Generation;

/// <summary>
/// Writes mock data directly from a validated schema into a <see cref="Utf8JsonWriter"/>.
/// The core generator catalog only; delay, errors and pagination are owned by the runtime.
/// </summary>
public sealed class JsonGenerator
{
    public void Generate(Schema schema, Utf8JsonWriter writer, GenerationOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(schema);
        ArgumentNullException.ThrowIfNull(writer);

        if (schema.Root is null)
        {
            throw new ArgumentException("The schema has no root node.", nameof(schema));
        }

        new Session(options ?? new GenerationOptions()).WriteRoot(schema.Root, writer);
    }

    public JsonNode? Generate(Schema schema, GenerationOptions? options = null)
    {
        var buffer = new ArrayBufferWriter<byte>();

        using (var writer = new Utf8JsonWriter(buffer))
        {
            Generate(schema, writer, options);
        }

        return buffer.WrittenCount == 0 ? null : JsonNode.Parse(buffer.WrittenSpan);
    }

    public long EstimateValueCount(Schema schema, GenerationOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(schema);

        return EstimateValueCount(schema, schema.Root as ArrayNode, options);
    }

    /// <summary>
    /// Estimates the worst-case value count while treating <paramref name="listNode"/> as the list
    /// whose length comes from settings/pagination instead of its own <c>length</c>.
    /// </summary>
    public long EstimateValueCount(
        Schema schema,
        SchemaNode? listNode,
        GenerationOptions? options = null
    )
    {
        ArgumentNullException.ThrowIfNull(schema);

        return Estimate(schema.Root, listNode, options ?? new GenerationOptions());
    }

    private static long Estimate(SchemaNode? node, SchemaNode? listNode, GenerationOptions options)
    {
        if (node is null)
        {
            return 0;
        }

        switch (node)
        {
            case LeafNode:
                return 1;

            case ObjectNode objectNode:
            {
                var total = 0L;

                foreach (var field in objectNode.Fields)
                {
                    total = SaturatingAdd(total, Estimate(field.Node, listNode, options));
                }

                return total;
            }

            case ArrayNode arrayNode:
            {
                var length = ReferenceEquals(arrayNode, listNode)
                    ? options.ListMax ?? arrayNode.Length?.Max ?? 3
                    : arrayNode.Length?.Max ?? 3;

                var itemCount = Estimate(arrayNode.Item, listNode, options);

                return length <= 0 ? 0 : SaturatingMultiply(length, itemCount);
            }

            default:
                return 0;
        }
    }

    private static long SaturatingAdd(long left, long right) =>
        left > long.MaxValue - right ? long.MaxValue : left + right;

    private static long SaturatingMultiply(long left, long right)
    {
        if (left == 0 || right == 0)
        {
            return 0;
        }

        return left > long.MaxValue / right ? long.MaxValue : left * right;
    }

    private sealed class Session
    {
        private static readonly string[] FirstNames =
        [
            "Ahmed",
            "Amina",
            "Clara",
            "Diego",
            "Elena",
            "Fatima",
            "Grace",
            "Hugo",
            "Ines",
            "Jonas",
            "Leila",
            "Marco",
            "Nadia",
            "Omar",
            "Priya",
            "Ravi",
            "Sofia",
            "Tariq",
            "Yara",
            "Zoe",
        ];

        private static readonly string[] LastNames =
        [
            "Benali",
            "Costa",
            "Dubois",
            "Garcia",
            "Haddad",
            "Ivanov",
            "Johnson",
            "Khan",
            "Lopez",
            "Martin",
            "Moreau",
            "Nakamura",
            "Patel",
            "Rossi",
            "Silva",
            "Smith",
            "Tanaka",
            "Varga",
            "Weber",
            "Zhang",
        ];

        private static readonly string[] Cities =
        [
            "Lyon",
            "Paris",
            "Berlin",
            "Madrid",
            "Lisbon",
            "Rome",
            "London",
            "Oslo",
            "Vienna",
            "Prague",
            "Amsterdam",
            "Dublin",
            "Toronto",
            "Tokyo",
            "Cairo",
            "Nairobi",
            "Casablanca",
            "Istanbul",
            "Mumbai",
            "Sydney",
        ];

        private static readonly string[] Countries =
        [
            "France",
            "Germany",
            "Spain",
            "Portugal",
            "Italy",
            "United Kingdom",
            "Norway",
            "Austria",
            "Czechia",
            "Netherlands",
            "Ireland",
            "Canada",
            "Japan",
            "Egypt",
            "Kenya",
            "Morocco",
            "Turkey",
            "India",
            "Australia",
            "Brazil",
        ];

        private static readonly string[] Companies =
        [
            "Acme Corp",
            "Northwind Labs",
            "Globex",
            "Initech",
            "Umbrella Group",
            "Contoso",
            "Fabrikam",
            "Blue River",
            "Summit Works",
            "Orbit Systems",
        ];

        private static readonly string[] SentenceWords =
        [
            "quiet",
            "river",
            "system",
            "updates",
            "quickly",
            "bright",
            "market",
            "opens",
            "early",
            "small",
            "team",
            "ships",
            "reliable",
            "service",
            "responds",
            "calm",
            "morning",
            "starts",
            "gently",
            "clear",
            "signal",
            "travels",
            "fast",
            "modern",
            "design",
            "feels",
            "simple",
            "fresh",
            "idea",
            "grows",
            "steady",
            "progress",
            "continues",
            "open",
            "window",
            "shows",
            "distant",
            "harbor",
            "rests",
            "still",
        ];

        private readonly GenerationOptions _options;
        private int _valueCount;

        public Session(GenerationOptions options)
        {
            _options = options;
        }

        public void WriteRoot(SchemaNode root, Utf8JsonWriter writer)
        {
            if (root is not ArrayNode array)
            {
                WriteNode(root, writer, listIndex: null);
                return;
            }

            var length = RootLength(array);
            writer.WriteStartArray();

            for (var index = 0; index < length; index++)
            {
                if (array.Item is null)
                {
                    throw new InvalidOperationException("The root array has no item node.");
                }

                WriteNode(array.Item, writer, listIndex: index + _options.ListIndexOffset);
            }

            writer.WriteEndArray();
        }

        private void WriteNode(SchemaNode? node, Utf8JsonWriter writer, int? listIndex)
        {
            ArgumentNullException.ThrowIfNull(writer);

            if (node is null)
            {
                throw new InvalidOperationException("A schema node is missing.");
            }

            switch (node)
            {
                case ObjectNode objectNode:
                    WriteObject(objectNode, writer, listIndex);
                    break;
                case ArrayNode arrayNode:
                    WriteArray(arrayNode, writer);
                    break;
                case LeafNode leafNode:
                    WriteLeaf(leafNode, writer, listIndex);
                    break;
                default:
                    throw new InvalidOperationException(
                        $"Unsupported schema node '{node.GetType().Name}'."
                    );
            }
        }

        private void WriteObject(ObjectNode node, Utf8JsonWriter writer, int? listIndex)
        {
            writer.WriteStartObject();

            foreach (var field in node.Fields)
            {
                if (
                    field.OmitProbability is { } omitProbability
                    && Random.Shared.NextDouble() < omitProbability
                )
                {
                    continue;
                }

                writer.WritePropertyName(field.Name);

                if (
                    field.NullProbability is { } nullProbability
                    && Random.Shared.NextDouble() < nullProbability
                )
                {
                    CountValue();
                    writer.WriteNullValue();
                    continue;
                }

                WriteNode(field.Node, writer, listIndex);
            }

            writer.WriteEndObject();
        }

        private void WriteArray(ArrayNode node, Utf8JsonWriter writer)
        {
            var length = NestedLength(node);
            writer.WriteStartArray();

            for (var index = 0; index < length; index++)
            {
                WriteNode(node.Item, writer, listIndex: null);
            }

            writer.WriteEndArray();
        }

        private void WriteLeaf(LeafNode node, Utf8JsonWriter writer, int? listIndex)
        {
            CountValue();

            var generator = node.Generator;
            var name = generator?.Name;

            switch (name)
            {
                case "autoId":
                {
                    var start = GetInt(generator?.Params, "start", 1);

                    if (listIndex is { } index)
                    {
                        writer.WriteNumberValue((long)start + index);
                    }
                    else
                    {
                        writer.WriteNumberValue(Random.Shared.Next(1, 100_001));
                    }

                    break;
                }

                case "randomInt":
                {
                    var min = GetInt(generator?.Params, "min", 0);
                    var max = GetInt(generator?.Params, "max", min);
                    writer.WriteNumberValue(NextInclusive(min, Math.Max(min, max)));
                    break;
                }

                case "randomDecimal":
                {
                    var min = GetDouble(generator?.Params, "min", 0);
                    var max = GetDouble(generator?.Params, "max", min);
                    var precision = GetInt(generator?.Params, "precision", 2);
                    writer.WriteNumberValue(NextDecimal(min, max, precision));
                    break;
                }

                case "price":
                {
                    var min = GetDouble(generator?.Params, "min", 1);
                    var max = GetDouble(generator?.Params, "max", 1_000);
                    var value = NextDecimal(min, max, 2);

                    if (node.Type == SchemaNodeType.String)
                    {
                        writer.WriteStringValue(
                            value.ToString("0.00", CultureInfo.InvariantCulture)
                        );
                    }
                    else if (node.Type == SchemaNodeType.Integer)
                    {
                        writer.WriteNumberValue((long)Math.Round(value));
                    }
                    else
                    {
                        writer.WriteNumberValue(value);
                    }

                    break;
                }

                case "randomBool":
                {
                    var trueProbability = GetDouble(generator?.Params, "trueProbability", 0.5);
                    writer.WriteBooleanValue(Random.Shared.NextDouble() < trueProbability);
                    break;
                }

                case "nullValue":
                    writer.WriteNullValue();
                    break;

                case "uuid":
                    writer.WriteStringValue(Guid.NewGuid().ToString());
                    break;

                case "email":
                    writer.WriteStringValue(BuildEmail());
                    break;

                case "fullName":
                    writer.WriteStringValue($"{Pick(FirstNames)} {Pick(LastNames)}");
                    break;

                case "firstName":
                    writer.WriteStringValue(Pick(FirstNames));
                    break;

                case "lastName":
                    writer.WriteStringValue(Pick(LastNames));
                    break;

                case "username":
                    writer.WriteStringValue(BuildUsername());
                    break;

                case "phone":
                    writer.WriteStringValue(
                        $"+1-555-{Random.Shared.Next(0, 10_000).ToString("D4", CultureInfo.InvariantCulture)}"
                    );
                    break;

                case "city":
                    writer.WriteStringValue(Pick(Cities));
                    break;

                case "country":
                    writer.WriteStringValue(Pick(Countries));
                    break;

                case "company":
                    writer.WriteStringValue(Pick(Companies));
                    break;

                case "url":
                    writer.WriteStringValue(
                        $"https://example.com/{Pick(SentenceWords)}/{Random.Shared.Next(1, 10_000)}"
                    );
                    break;

                case "words":
                {
                    var min = Math.Max(1, GetInt(generator?.Params, "min", 1));
                    var max = Math.Max(min, GetInt(generator?.Params, "max", 3));
                    var count = NextInclusive(min, max);
                    var words = new string[count];

                    for (var index = 0; index < count; index++)
                    {
                        words[index] = Pick(SentenceWords);
                    }

                    writer.WriteStringValue(string.Join(' ', words));
                    break;
                }

                case "sentence":
                {
                    var min = Math.Max(1, GetInt(generator?.Params, "minWords", 3));
                    var max = Math.Max(min, GetInt(generator?.Params, "maxWords", 8));
                    writer.WriteStringValue(BuildSentence(NextInclusive(min, max)));
                    break;
                }

                case "paragraph":
                {
                    var sentences = Math.Max(1, GetInt(generator?.Params, "sentences", 3));
                    var parts = new string[sentences];

                    for (var index = 0; index < sentences; index++)
                    {
                        parts[index] = BuildSentence(NextInclusive(3, 8));
                    }

                    writer.WriteStringValue(string.Join(' ', parts));
                    break;
                }

                case "dateTime":
                {
                    var kind = GetString(generator?.Params, "kind", "past");
                    var rangeDays = Math.Max(0, GetInt(generator?.Params, "rangeDays", 365));
                    var format = GetString(generator?.Params, "format", "iso-datetime");
                    writer.WriteStringValue(FormatDateTime(kind, rangeDays, format));
                    break;
                }

                case "date":
                {
                    var kind = GetString(generator?.Params, "kind", "past");
                    var rangeDays = Math.Max(0, GetInt(generator?.Params, "rangeDays", 365));
                    var minDaysAgo = Math.Max(0, GetInt(generator?.Params, "minDaysAgo", 0));
                    writer.WriteStringValue(FormatDate(kind, rangeDays, minDaysAgo));
                    break;
                }

                case "enum":
                    WriteEnum(node, generator?.Params, writer);
                    break;

                case "constant":
                    WriteConstant(node, generator?.Params, writer);
                    break;

                default:
                    throw new InvalidOperationException(
                        $"Unknown generator '{name ?? "<missing>"}'."
                    );
            }
        }

        private static void WriteEnum(LeafNode node, JsonObject? parameters, Utf8JsonWriter writer)
        {
            var values = parameters?["values"] as JsonArray;

            if (values is null || values.Count == 0)
            {
                throw new InvalidOperationException("Enum generator has no values.");
            }

            var value = values[Random.Shared.Next(0, values.Count)];

            if (node.Type == SchemaNodeType.Integer)
            {
                if (TryGetInt(value, out var integer))
                {
                    writer.WriteNumberValue(integer);
                    return;
                }

                throw new InvalidOperationException("Enum value is not an integer.");
            }

            if (TryGetString(value, out var text))
            {
                writer.WriteStringValue(text);
                return;
            }

            writer.WriteStringValue(value?.ToJsonString() ?? string.Empty);
        }

        private static void WriteConstant(
            LeafNode node,
            JsonObject? parameters,
            Utf8JsonWriter writer
        )
        {
            if (parameters is null || !parameters.TryGetPropertyValue("value", out var value))
            {
                throw new InvalidOperationException("Constant generator has no value.");
            }

            switch (node.Type)
            {
                case SchemaNodeType.String:
                    writer.WriteStringValue(
                        TryGetString(value, out var text)
                            ? text
                            : value?.ToJsonString() ?? string.Empty
                    );
                    break;

                case SchemaNodeType.Integer:
                    if (!TryGetInt(value, out var integer))
                    {
                        throw new InvalidOperationException("Constant value is not an integer.");
                    }

                    writer.WriteNumberValue(integer);
                    break;

                case SchemaNodeType.Number:
                    if (!TryGetDouble(value, out var number))
                    {
                        throw new InvalidOperationException("Constant value is not a number.");
                    }

                    writer.WriteNumberValue(number);
                    break;

                case SchemaNodeType.Boolean:
                    if (!TryGetBoolean(value, out var boolean))
                    {
                        throw new InvalidOperationException("Constant value is not a boolean.");
                    }

                    writer.WriteBooleanValue(boolean);
                    break;

                case SchemaNodeType.Null:
                    writer.WriteNullValue();
                    break;

                default:
                    throw new InvalidOperationException(
                        $"Constant is not supported on '{node.Type.ToJsonValue()}'."
                    );
            }
        }

        private string BuildEmail()
        {
            var first = Pick(FirstNames).ToLowerInvariant();
            var last = Pick(LastNames).ToLowerInvariant();
            return $"{first}.{last}{Random.Shared.Next(1, 100)}@example.com";
        }

        private static string BuildUsername()
        {
            var first = Pick(FirstNames).ToLowerInvariant();
            var last = Pick(LastNames).ToLowerInvariant();
            return $"{first}_{last}{Random.Shared.Next(1, 100)}";
        }

        private static string BuildSentence(int wordCount)
        {
            var words = new string[wordCount];

            for (var index = 0; index < wordCount; index++)
            {
                words[index] = Pick(SentenceWords);
            }

            var sentence = string.Join(' ', words);

            if (sentence.Length > 0)
            {
                sentence = char.ToUpperInvariant(sentence[0]) + sentence[1..];
            }

            return sentence + ".";
        }

        private string FormatDateTime(string kind, int rangeDays, string format)
        {
            var reference = ReferenceTime;
            var instant = kind switch
            {
                "future" => reference.AddSeconds(NextInclusive(0, Math.Max(0, rangeDays) * 86_400)),
                "recent" => reference.AddSeconds(
                    -NextInclusive(0, Math.Min(Math.Max(0, rangeDays), 1) * 86_400)
                ),
                _ => reference.AddSeconds(-NextInclusive(0, Math.Max(0, rangeDays) * 86_400)),
            };

            instant = instant.ToUniversalTime();

            return format == "iso-datetime-ms"
                ? instant.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture)
                : instant.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
        }

        private string FormatDate(string kind, int rangeDays, int minDaysAgo)
        {
            var reference = ReferenceTime.UtcDateTime.Date;
            var maxDays = Math.Max(minDaysAgo, rangeDays);

            var date = kind switch
            {
                "future" => reference.AddDays(
                    NextInclusive(Math.Max(1, minDaysAgo), Math.Max(1, maxDays))
                ),
                "recent" => reference.AddDays(
                    -NextInclusive(minDaysAgo, Math.Min(maxDays, Math.Max(minDaysAgo, 1)))
                ),
                _ => reference.AddDays(-NextInclusive(minDaysAgo, maxDays)),
            };

            return date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        private DateTimeOffset ReferenceTime => _options.ReferenceTime ?? DateTimeOffset.UtcNow;

        private int RootLength(ArrayNode node)
        {
            var min = _options.ListMin ?? node.Length?.Min ?? 1;
            var max = _options.ListMax ?? node.Length?.Max ?? 3;
            min = Math.Max(0, min);
            max = Math.Max(0, max);

            return NextInclusive(min, Math.Max(min, max));
        }

        private static int NestedLength(ArrayNode node)
        {
            var min = Math.Max(0, node.Length?.Min ?? 1);
            var max = Math.Max(0, node.Length?.Max ?? 3);
            return NextInclusive(min, Math.Max(min, max));
        }

        private void CountValue()
        {
            _valueCount++;

            if (_valueCount > _options.MaxValues)
            {
                throw new ResponseTooLargeException(_options.MaxValues);
            }
        }

        private static string Pick(IReadOnlyList<string> values) =>
            values[Random.Shared.Next(0, values.Count)];

        private static int RangeSeconds(int days)
        {
            var safeDays = Math.Clamp(days, 0, 24_855);
            return safeDays * 86_400;
        }

        private static int NextInclusive(int min, int max)
        {
            if (max <= min)
            {
                return min;
            }

            return (int)Random.Shared.NextInt64(min, (long)max + 1);
        }

        private static double NextDecimal(double min, double max, int precision)
        {
            if (max < min)
            {
                (min, max) = (max, min);
            }

            precision = Math.Clamp(precision, 0, 6);

            if (max == min)
            {
                return Math.Round(min, precision, MidpointRounding.AwayFromZero);
            }

            var value = min + (Random.Shared.NextDouble() * (max - min));
            return Math.Round(value, precision, MidpointRounding.AwayFromZero);
        }

        private static int GetInt(JsonObject? parameters, string name, int defaultValue) =>
            parameters is not null
            && parameters.TryGetPropertyValue(name, out var value)
            && TryGetInt(value, out var result)
                ? result
                : defaultValue;

        private static double GetDouble(JsonObject? parameters, string name, double defaultValue) =>
            parameters is not null
            && parameters.TryGetPropertyValue(name, out var value)
            && TryGetDouble(value, out var result)
                ? result
                : defaultValue;

        private static string GetString(JsonObject? parameters, string name, string defaultValue) =>
            parameters is not null
            && parameters.TryGetPropertyValue(name, out var value)
            && TryGetString(value, out var result)
                ? result
                : defaultValue;

        private static bool TryGetInt(JsonNode? node, out int value)
        {
            value = 0;

            if (node is not JsonValue jsonValue)
            {
                return false;
            }

            if (jsonValue.TryGetValue<int>(out value))
            {
                return true;
            }

            if (
                !jsonValue.TryGetValue<JsonElement>(out var element)
                || element.ValueKind != JsonValueKind.Number
            )
            {
                return false;
            }

            var raw = element.GetRawText();
            return raw.IndexOfAny(['.', 'e', 'E']) < 0 && element.TryGetInt32(out value);
        }

        private static bool TryGetDouble(JsonNode? node, out double value)
        {
            value = 0;

            if (node is not JsonValue jsonValue)
            {
                return false;
            }

            if (jsonValue.TryGetValue<double>(out value))
            {
                return true;
            }

            if (jsonValue.TryGetValue<int>(out var integer))
            {
                value = integer;
                return true;
            }

            if (jsonValue.TryGetValue<long>(out var longValue))
            {
                value = longValue;
                return true;
            }

            return jsonValue.TryGetValue<JsonElement>(out var element)
                && element.ValueKind == JsonValueKind.Number
                && element.TryGetDouble(out value);
        }

        private static bool TryGetString(JsonNode? node, out string value)
        {
            value = string.Empty;

            if (node is not JsonValue jsonValue)
            {
                return false;
            }

            if (jsonValue.TryGetValue<string>(out var text) && text is not null)
            {
                value = text;
                return true;
            }

            if (
                jsonValue.TryGetValue<JsonElement>(out var element)
                && element.ValueKind == JsonValueKind.String
            )
            {
                value = element.GetString() ?? string.Empty;
                return true;
            }

            return false;
        }

        private static bool TryGetBoolean(JsonNode? node, out bool value)
        {
            value = false;

            if (node is not JsonValue jsonValue)
            {
                return false;
            }

            if (jsonValue.TryGetValue<bool>(out value))
            {
                return true;
            }

            if (jsonValue.TryGetValue<JsonElement>(out var element))
            {
                if (element.ValueKind == JsonValueKind.True)
                {
                    value = true;
                    return true;
                }

                if (element.ValueKind == JsonValueKind.False)
                {
                    value = false;
                    return true;
                }
            }

            return false;
        }
    }
}
