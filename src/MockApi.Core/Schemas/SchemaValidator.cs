using System.Text.Json;
using System.Text.Json.Nodes;

namespace MockApi.Core.Schemas;

/// <summary>
/// The single structural validator for schemas (spec §5, §6.1, §7.1 and §10.4). It has no HTTP
/// or database dependency and returns one targeted, dotted-path error per violation.
/// </summary>
public sealed class SchemaValidator
{
    private const string RootPath = "root";

    private readonly SchemaLimits _limits;

    public SchemaValidator(SchemaLimits? limits = null)
    {
        _limits = limits ?? SchemaLimits.Default;
    }

    public SchemaValidationResult Validate(Schema? schema)
    {
        var errors = new List<SchemaValidationError>();

        if (schema is null)
        {
            errors.Add(new SchemaValidationError("schema", "A schema object is required."));
            return new SchemaValidationResult(errors);
        }

        if (schema.Version != 1)
        {
            errors.Add(new SchemaValidationError("version", "Schema version must be 1."));
        }

        var nodeCount = 0;
        Visit(schema.Root, RootPath, 1, ref nodeCount, errors);

        return new SchemaValidationResult(errors);
    }

    public SchemaValidationResult ValidateNode(SchemaNode? node)
    {
        var errors = new List<SchemaValidationError>();
        var nodeCount = 0;
        Visit(node, RootPath, 1, ref nodeCount, errors);
        return new SchemaValidationResult(errors);
    }

    private void Visit(
        SchemaNode? node,
        string path,
        int depth,
        ref int nodeCount,
        List<SchemaValidationError> errors
    )
    {
        if (node is null)
        {
            errors.Add(new SchemaValidationError(path, "A schema node is required."));
            return;
        }

        nodeCount++;

        if (nodeCount > _limits.MaxNodes)
        {
            if (nodeCount == _limits.MaxNodes + 1)
            {
                errors.Add(
                    new SchemaValidationError(
                        path,
                        $"A schema may contain at most {_limits.MaxNodes} nodes."
                    )
                );
            }

            return;
        }

        if (depth > _limits.MaxDepth)
        {
            errors.Add(
                new SchemaValidationError(
                    path,
                    $"A schema may be nested at most {_limits.MaxDepth} levels deep."
                )
            );
            return;
        }

        switch (node)
        {
            case ObjectNode objectNode:
                VisitObject(objectNode, path, depth, ref nodeCount, errors);
                break;
            case ArrayNode arrayNode:
                VisitArray(arrayNode, path, depth, ref nodeCount, errors);
                break;
            case LeafNode leafNode:
                VisitLeaf(leafNode, path, errors);
                break;
            default:
                errors.Add(new SchemaValidationError(path, "Unsupported schema node kind."));
                break;
        }
    }

    private void VisitObject(
        ObjectNode node,
        string path,
        int depth,
        ref int nodeCount,
        List<SchemaValidationError> errors
    )
    {
        if (node.Fields is null)
        {
            errors.Add(new SchemaValidationError($"{path}.fields", "Object fields are required."));
            return;
        }

        var fieldsPath = $"{path}.fields";

        if (node.Fields.Count > _limits.MaxFieldsPerObject)
        {
            errors.Add(
                new SchemaValidationError(
                    fieldsPath,
                    $"An object may contain at most {_limits.MaxFieldsPerObject} fields."
                )
            );
            return;
        }

        var seenNames = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < node.Fields.Count; index++)
        {
            var field = node.Fields[index];
            var fieldPath = $"{fieldsPath}[{index}]";

            if (field is null)
            {
                errors.Add(new SchemaValidationError(fieldPath, "An object field is required."));
                continue;
            }

            var namePath = $"{fieldPath}.name";

            if (string.IsNullOrEmpty(field.Name))
            {
                errors.Add(new SchemaValidationError(namePath, "A field name is required."));
            }
            else
            {
                if (field.Name.Length > _limits.MaxFieldNameLength)
                {
                    errors.Add(
                        new SchemaValidationError(
                            namePath,
                            $"A field name may contain at most {_limits.MaxFieldNameLength} characters."
                        )
                    );
                }

                if (!seenNames.Add(field.Name))
                {
                    errors.Add(
                        new SchemaValidationError(
                            namePath,
                            $"Field name '{field.Name}' must be unique inside an object."
                        )
                    );
                }
            }

            ValidateProbability(
                field.NullProbability,
                $"{fieldPath}.nullProbability",
                "nullProbability",
                errors
            );
            ValidateProbability(
                field.OmitProbability,
                $"{fieldPath}.omitProbability",
                "omitProbability",
                errors
            );

            Visit(field.Node, $"{fieldPath}.node", depth + 1, ref nodeCount, errors);
        }
    }

    private void VisitArray(
        ArrayNode node,
        string path,
        int depth,
        ref int nodeCount,
        List<SchemaValidationError> errors
    )
    {
        if (node.Length is { } length)
        {
            if (length.Min < 0)
            {
                errors.Add(
                    new SchemaValidationError(
                        $"{path}.length.min",
                        "Array length min must be zero or greater."
                    )
                );
            }

            if (length.Max < 0)
            {
                errors.Add(
                    new SchemaValidationError(
                        $"{path}.length.max",
                        "Array length max must be zero or greater."
                    )
                );
            }

            if (length.Min > length.Max)
            {
                errors.Add(
                    new SchemaValidationError(
                        $"{path}.length.max",
                        "Array length max must be greater than or equal to min."
                    )
                );
            }
        }

        Visit(node.Item, $"{path}.item", depth + 1, ref nodeCount, errors);
    }

    private void VisitLeaf(LeafNode node, string path, List<SchemaValidationError> errors)
    {
        if (!node.Type.IsLeaf())
        {
            errors.Add(
                new SchemaValidationError(
                    $"{path}.type",
                    "A leaf node type must be one of string, integer, number, boolean, or null."
                )
            );
            return;
        }

        var generatorPath = $"{path}.generator";

        if (node.Generator is null)
        {
            errors.Add(new SchemaValidationError(generatorPath, "A generator is required."));
            return;
        }

        var namePath = $"{generatorPath}.name";

        if (string.IsNullOrEmpty(node.Generator.Name))
        {
            errors.Add(new SchemaValidationError(namePath, "A generator name is required."));
            return;
        }

        if (!GeneratorCatalog.TryGet(node.Generator.Name, out var definition))
        {
            errors.Add(
                new SchemaValidationError(namePath, $"Unknown generator '{node.Generator.Name}'.")
            );
            return;
        }

        if (!definition.Supports(node.Type))
        {
            errors.Add(
                new SchemaValidationError(
                    namePath,
                    $"Generator '{definition.Name}' does not support node type '{node.Type.ToJsonValue()}'."
                )
            );
            return;
        }

        ValidateParameters(
            node.Generator,
            definition,
            node.Type,
            $"{generatorPath}.params",
            errors
        );
    }

    private void ValidateParameters(
        GeneratorSpec generator,
        GeneratorDefinition definition,
        SchemaNodeType nodeType,
        string path,
        List<SchemaValidationError> errors
    )
    {
        var parameters = generator.Params;
        var definitions = definition.Parameters.ToDictionary(
            parameter => parameter.Name,
            StringComparer.Ordinal
        );

        if (parameters is not null)
        {
            foreach (var pair in parameters)
            {
                if (!definitions.ContainsKey(pair.Key))
                {
                    errors.Add(
                        new SchemaValidationError(
                            $"{path}.{pair.Key}",
                            $"Unknown parameter '{pair.Key}' for generator '{definition.Name}'."
                        )
                    );
                }
            }
        }

        foreach (var parameter in definition.Parameters)
        {
            if (
                parameters is null
                || !parameters.TryGetPropertyValue(parameter.Name, out var value)
            )
            {
                if (parameter.Required)
                {
                    errors.Add(
                        new SchemaValidationError(
                            $"{path}.{parameter.Name}",
                            $"Parameter '{parameter.Name}' is required."
                        )
                    );
                }

                continue;
            }

            var parameterPath = $"{path}.{parameter.Name}";
            ValidateParameterValue(parameter, value, parameterPath, nodeType, errors);
        }

        ValidateCrossParameterRules(generator, definition.Name, parameters, path, errors);
    }

    private void ValidateParameterValue(
        GeneratorParameter parameter,
        JsonNode? value,
        string path,
        SchemaNodeType nodeType,
        List<SchemaValidationError> errors
    )
    {
        switch (parameter.Kind)
        {
            case GeneratorParameterKind.Integer:
                if (!TryGetInt32(value, out var integer))
                {
                    errors.Add(new SchemaValidationError(path, "Value must be an integer."));
                    return;
                }

                ValidateRange(parameter, integer, path, errors);
                break;

            case GeneratorParameterKind.Number:
                if (!TryGetDouble(value, out var number))
                {
                    errors.Add(new SchemaValidationError(path, "Value must be a number."));
                    return;
                }

                ValidateRange(parameter, number, path, errors);
                break;

            case GeneratorParameterKind.Boolean:
                if (!TryGetBoolean(value, out _))
                {
                    errors.Add(new SchemaValidationError(path, "Value must be a boolean."));
                }

                break;

            case GeneratorParameterKind.String:
                if (!TryGetString(value, out _))
                {
                    errors.Add(new SchemaValidationError(path, "Value must be a string."));
                }

                break;

            case GeneratorParameterKind.Enum:
                if (!TryGetString(value, out var text))
                {
                    errors.Add(new SchemaValidationError(path, "Value must be a string."));
                    return;
                }

                if (
                    parameter.AllowedValues is { } allowed
                    && !allowed.Contains(text, StringComparer.Ordinal)
                )
                {
                    errors.Add(
                        new SchemaValidationError(
                            path,
                            $"Value must be one of: {string.Join(", ", allowed)}."
                        )
                    );
                }

                break;

            case GeneratorParameterKind.EnumValues:
                ValidateEnumValues(value, nodeType, path, errors);
                break;

            case GeneratorParameterKind.JsonValue:
                ValidateConstant(value, nodeType, path, errors);
                break;

            default:
                errors.Add(new SchemaValidationError(path, "Unsupported parameter kind."));
                break;
        }
    }

    private void ValidateEnumValues(
        JsonNode? value,
        SchemaNodeType nodeType,
        string path,
        List<SchemaValidationError> errors
    )
    {
        if (value is not JsonArray values)
        {
            errors.Add(new SchemaValidationError(path, "Value must be an array."));
            return;
        }

        if (values.Count is < 1)
        {
            errors.Add(new SchemaValidationError(path, "At least one enum value is required."));
            return;
        }

        if (values.Count > _limits.MaxEnumValues)
        {
            errors.Add(
                new SchemaValidationError(
                    path,
                    $"An enum may contain at most {_limits.MaxEnumValues} values."
                )
            );
            return;
        }

        for (var index = 0; index < values.Count; index++)
        {
            var item = values[index];
            var itemPath = $"{path}[{index}]";

            if (nodeType == SchemaNodeType.String)
            {
                if (!TryGetString(item, out _))
                {
                    errors.Add(new SchemaValidationError(itemPath, "Enum value must be a string."));
                }

                continue;
            }

            if (!TryGetInt32(item, out _))
            {
                errors.Add(new SchemaValidationError(itemPath, "Enum value must be an integer."));
            }
        }
    }

    private static void ValidateConstant(
        JsonNode? value,
        SchemaNodeType nodeType,
        string path,
        List<SchemaValidationError> errors
    )
    {
        var matches = nodeType switch
        {
            SchemaNodeType.String => TryGetString(value, out _),
            SchemaNodeType.Integer => TryGetInt32(value, out _),
            SchemaNodeType.Number => TryGetDouble(value, out _),
            SchemaNodeType.Boolean => TryGetBoolean(value, out _),
            SchemaNodeType.Null => value is null || value.GetValueKind() == JsonValueKind.Null,
            _ => false,
        };

        if (!matches)
        {
            errors.Add(
                new SchemaValidationError(
                    path,
                    $"Constant value must match node type '{nodeType.ToJsonValue()}'."
                )
            );
        }
    }

    private static void ValidateRange(
        GeneratorParameter parameter,
        double value,
        string path,
        List<SchemaValidationError> errors
    )
    {
        if (!double.IsFinite(value))
        {
            errors.Add(new SchemaValidationError(path, "Value must be a finite number."));
            return;
        }

        if (parameter.Minimum is { } minimum && value < minimum)
        {
            errors.Add(
                new SchemaValidationError(
                    path,
                    $"Value must be greater than or equal to {minimum}."
                )
            );
        }

        if (parameter.Maximum is { } maximum && value > maximum)
        {
            errors.Add(
                new SchemaValidationError(path, $"Value must be less than or equal to {maximum}.")
            );
        }
    }

    private static void ValidateCrossParameterRules(
        GeneratorSpec generator,
        string generatorName,
        JsonObject? parameters,
        string path,
        List<SchemaValidationError> errors
    )
    {
        switch (generatorName)
        {
            case "randomInt":
            case "randomDecimal":
                ValidateMinMax(parameters, "min", "max", path, errors);
                break;
            case "price":
                ValidateMinMax(parameters, "min", "max", path, errors, 1, 1_000);
                break;
            case "words":
                ValidateMinMax(parameters, "min", "max", path, errors, 1, 3);
                break;
            case "sentence":
                ValidateMinMax(parameters, "minWords", "maxWords", path, errors, 3, 8);
                break;
            case "date":
                ValidateDateRange(parameters, path, errors);
                break;
            case "autoId":
            case "randomBool":
            case "nullValue":
            case "uuid":
            case "email":
            case "fullName":
            case "firstName":
            case "lastName":
            case "username":
            case "phone":
            case "city":
            case "country":
            case "company":
            case "url":
            case "paragraph":
            case "dateTime":
            case "enum":
            case "constant":
                break;
            default:
                errors.Add(
                    new SchemaValidationError(
                        $"{path}.__generator",
                        $"Unsupported generator '{generator.Name}'."
                    )
                );
                break;
        }
    }

    private static void ValidateMinMax(
        JsonObject? parameters,
        string minName,
        string maxName,
        string path,
        List<SchemaValidationError> errors,
        double? defaultMin = null,
        double? defaultMax = null
    )
    {
        if (
            !TryGetParameterDouble(parameters, minName, defaultMin, out var min)
            || !TryGetParameterDouble(parameters, maxName, defaultMax, out var max)
        )
        {
            return;
        }

        if (min > max)
        {
            errors.Add(
                new SchemaValidationError(
                    $"{path}.{maxName}",
                    $"'{maxName}' must be greater than or equal to '{minName}'."
                )
            );
        }
    }

    private static void ValidateDateRange(
        JsonObject? parameters,
        string path,
        List<SchemaValidationError> errors
    )
    {
        if (
            !TryGetParameterInteger(parameters, "rangeDays", 365, out var rangeDays)
            || !TryGetParameterInteger(parameters, "minDaysAgo", 0, out var minDaysAgo)
        )
        {
            return;
        }

        if (minDaysAgo > rangeDays)
        {
            errors.Add(
                new SchemaValidationError(
                    $"{path}.minDaysAgo",
                    "'minDaysAgo' must be less than or equal to 'rangeDays'."
                )
            );
        }
    }

    private static void ValidateProbability(
        double? value,
        string path,
        string name,
        List<SchemaValidationError> errors
    )
    {
        if (
            value is { } probability
            && (!double.IsFinite(probability) || probability is < 0 or > 1)
        )
        {
            errors.Add(new SchemaValidationError(path, $"'{name}' must be between 0 and 1."));
        }
    }

    private static bool TryGetParameterDouble(
        JsonObject? parameters,
        string name,
        double? defaultValue,
        out double value
    )
    {
        if (parameters is not null && parameters.TryGetPropertyValue(name, out var node))
        {
            return TryGetDouble(node, out value);
        }

        value = defaultValue ?? 0;
        return defaultValue.HasValue;
    }

    private static bool TryGetParameterInteger(
        JsonObject? parameters,
        string name,
        int defaultValue,
        out int value
    )
    {
        if (parameters is not null && parameters.TryGetPropertyValue(name, out var node))
        {
            return TryGetInt32(node, out value);
        }

        value = defaultValue;
        return true;
    }

    private static bool TryGetInt32(JsonNode? node, out int value)
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

    private static bool TryGetString(JsonNode? node, out string? value)
    {
        value = null;

        if (node is not JsonValue jsonValue)
        {
            return false;
        }

        if (jsonValue.TryGetValue<string>(out value))
        {
            return true;
        }

        if (
            jsonValue.TryGetValue<JsonElement>(out var element)
            && element.ValueKind == JsonValueKind.String
        )
        {
            value = element.GetString();
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
