using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace MockApi.Core.Schemas;

/// <summary>
/// Reads and writes the discriminated <see cref="SchemaNode"/> union from spec §5.1. Unknown
/// properties are rejected at every level so the schema has exactly one representation.
/// </summary>
public sealed class SchemaNodeJsonConverter : JsonConverter<SchemaNode>
{
    public override SchemaNode Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options
    )
    {
        using var document = JsonDocument.ParseValue(ref reader);
        return ReadNode(document.RootElement);
    }

    public override void Write(
        Utf8JsonWriter writer,
        SchemaNode value,
        JsonSerializerOptions options
    )
    {
        ArgumentNullException.ThrowIfNull(writer);
        ArgumentNullException.ThrowIfNull(value);

        WriteNode(writer, value);
    }

    private static SchemaNode ReadNode(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException("A schema node must be a JSON object.");
        }

        var properties = ReadProperties(element);

        if (
            !properties.TryGetValue("type", out var typeElement)
            || typeElement.ValueKind != JsonValueKind.String
        )
        {
            throw new JsonException("A schema node requires a string 'type' property.");
        }

        if (!SchemaNodeTypeExtensions.TryParseJsonValue(typeElement.GetString(), out var type))
        {
            throw new JsonException($"Unknown schema node type '{typeElement.GetString()}'.");
        }

        return type switch
        {
            SchemaNodeType.Object => ReadObject(properties),
            SchemaNodeType.Array => ReadArray(properties),
            _ => ReadLeaf(properties, type),
        };
    }

    private static ObjectNode ReadObject(IReadOnlyDictionary<string, JsonElement> properties)
    {
        RejectUnknown(properties, "type", "fields");

        if (
            !properties.TryGetValue("fields", out var fieldsElement)
            || fieldsElement.ValueKind != JsonValueKind.Array
        )
        {
            throw new JsonException("An object node requires a 'fields' array.");
        }

        var fields = new List<SchemaField>();

        foreach (var fieldElement in fieldsElement.EnumerateArray())
        {
            if (fieldElement.ValueKind != JsonValueKind.Object)
            {
                throw new JsonException("Each object field must be a JSON object.");
            }

            var fieldProperties = ReadProperties(fieldElement);
            RejectUnknown(fieldProperties, "name", "node", "nullProbability", "omitProbability");

            if (
                !fieldProperties.TryGetValue("name", out var nameElement)
                || nameElement.ValueKind != JsonValueKind.String
            )
            {
                throw new JsonException("Each object field requires a string 'name'.");
            }

            if (!fieldProperties.TryGetValue("node", out var nodeElement))
            {
                throw new JsonException($"Field '{nameElement.GetString()}' requires a 'node'.");
            }

            fields.Add(
                new SchemaField
                {
                    Name = nameElement.GetString()!,
                    Node = ReadNode(nodeElement),
                    NullProbability = ReadOptionalDouble(fieldProperties, "nullProbability"),
                    OmitProbability = ReadOptionalDouble(fieldProperties, "omitProbability"),
                }
            );
        }

        return new ObjectNode { Fields = fields };
    }

    private static ArrayNode ReadArray(IReadOnlyDictionary<string, JsonElement> properties)
    {
        RejectUnknown(properties, "type", "item", "length");

        if (!properties.TryGetValue("item", out var itemElement))
        {
            throw new JsonException("An array node requires an 'item' node.");
        }

        ArrayLength? length = null;

        if (properties.TryGetValue("length", out var lengthElement))
        {
            if (lengthElement.ValueKind != JsonValueKind.Object)
            {
                throw new JsonException("Array 'length' must be an object.");
            }

            var lengthProperties = ReadProperties(lengthElement);
            RejectUnknown(lengthProperties, "min", "max");

            if (
                !lengthProperties.TryGetValue("min", out var minElement)
                || minElement.ValueKind != JsonValueKind.Number
                || !minElement.TryGetInt32(out var min)
            )
            {
                throw new JsonException("Array 'length.min' must be an integer.");
            }

            if (
                !lengthProperties.TryGetValue("max", out var maxElement)
                || maxElement.ValueKind != JsonValueKind.Number
                || !maxElement.TryGetInt32(out var max)
            )
            {
                throw new JsonException("Array 'length.max' must be an integer.");
            }

            length = new ArrayLength(min, max);
        }

        return new ArrayNode { Item = ReadNode(itemElement), Length = length };
    }

    private static LeafNode ReadLeaf(
        IReadOnlyDictionary<string, JsonElement> properties,
        SchemaNodeType type
    )
    {
        RejectUnknown(properties, "type", "generator");

        if (
            !properties.TryGetValue("generator", out var generatorElement)
            || generatorElement.ValueKind != JsonValueKind.Object
        )
        {
            throw new JsonException($"A {type.ToJsonValue()} node requires a 'generator' object.");
        }

        var generatorProperties = ReadProperties(generatorElement);
        RejectUnknown(generatorProperties, "name", "params");

        if (
            !generatorProperties.TryGetValue("name", out var nameElement)
            || nameElement.ValueKind != JsonValueKind.String
        )
        {
            throw new JsonException("A generator requires a string 'name'.");
        }

        JsonObject? parameters = null;

        if (generatorProperties.TryGetValue("params", out var paramsElement))
        {
            if (paramsElement.ValueKind != JsonValueKind.Object)
            {
                throw new JsonException("Generator 'params' must be an object.");
            }

            parameters =
                JsonNode.Parse(paramsElement.GetRawText()) as JsonObject
                ?? throw new JsonException("Generator 'params' must be an object.");
        }

        return new LeafNode(
            type,
            new GeneratorSpec { Name = nameElement.GetString()!, Params = parameters }
        );
    }

    private static Dictionary<string, JsonElement> ReadProperties(JsonElement element)
    {
        var properties = new Dictionary<string, JsonElement>(StringComparer.Ordinal);

        foreach (var property in element.EnumerateObject())
        {
            if (!properties.TryAdd(property.Name, property.Value))
            {
                throw new JsonException($"Duplicate property '{property.Name}'.");
            }
        }

        return properties;
    }

    private static void RejectUnknown(
        IReadOnlyDictionary<string, JsonElement> properties,
        params string[] allowed
    )
    {
        foreach (var name in properties.Keys)
        {
            if (!allowed.Contains(name, StringComparer.Ordinal))
            {
                throw new JsonException($"Unknown schema property '{name}'.");
            }
        }
    }

    private static double? ReadOptionalDouble(
        IReadOnlyDictionary<string, JsonElement> properties,
        string name
    )
    {
        if (!properties.TryGetValue(name, out var element))
        {
            return null;
        }

        if (element.ValueKind != JsonValueKind.Number || !element.TryGetDouble(out var value))
        {
            throw new JsonException($"'{name}' must be a number.");
        }

        return value;
    }

    private static void WriteNode(Utf8JsonWriter writer, SchemaNode node)
    {
        writer.WriteStartObject();
        writer.WriteString("type", node.NodeType.ToJsonValue());

        switch (node)
        {
            case ObjectNode objectNode:
                writer.WritePropertyName("fields");
                writer.WriteStartArray();

                foreach (var field in objectNode.Fields)
                {
                    writer.WriteStartObject();
                    writer.WriteString("name", field.Name);

                    writer.WritePropertyName("node");
                    WriteNode(
                        writer,
                        field.Node
                            ?? throw new JsonException($"Field '{field.Name}' has no schema node.")
                    );

                    if (field.NullProbability is { } nullProbability)
                    {
                        writer.WriteNumber("nullProbability", nullProbability);
                    }

                    if (field.OmitProbability is { } omitProbability)
                    {
                        writer.WriteNumber("omitProbability", omitProbability);
                    }

                    writer.WriteEndObject();
                }

                writer.WriteEndArray();
                break;

            case ArrayNode arrayNode:
                writer.WritePropertyName("item");
                WriteNode(
                    writer,
                    arrayNode.Item ?? throw new JsonException("An array node has no item.")
                );

                if (arrayNode.Length is { } length)
                {
                    writer.WriteStartObject("length");
                    writer.WriteNumber("min", length.Min);
                    writer.WriteNumber("max", length.Max);
                    writer.WriteEndObject();
                }

                break;

            case LeafNode leafNode:
                writer.WriteStartObject("generator");
                writer.WriteString("name", leafNode.Generator?.Name ?? string.Empty);

                if (leafNode.Generator?.Params is { } parameters)
                {
                    writer.WritePropertyName("params");
                    parameters.WriteTo(writer);
                }

                writer.WriteEndObject();
                break;

            default:
                throw new JsonException($"Unsupported schema node '{node.GetType().Name}'.");
        }

        writer.WriteEndObject();
    }
}
