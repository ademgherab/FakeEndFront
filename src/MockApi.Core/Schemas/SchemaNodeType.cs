namespace MockApi.Core.Schemas;

/// <summary>
/// The discriminator values of the schema node union (technical spec §5.1).
/// </summary>
public enum SchemaNodeType
{
    Object,
    Array,
    String,
    Integer,
    Number,
    Boolean,
    Null,
}

public static class SchemaNodeTypeExtensions
{
    public static string ToJsonValue(this SchemaNodeType type) =>
        type switch
        {
            SchemaNodeType.Object => "object",
            SchemaNodeType.Array => "array",
            SchemaNodeType.String => "string",
            SchemaNodeType.Integer => "integer",
            SchemaNodeType.Number => "number",
            SchemaNodeType.Boolean => "boolean",
            SchemaNodeType.Null => "null",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, null),
        };

    public static bool TryParseJsonValue(string? value, out SchemaNodeType type)
    {
        switch (value)
        {
            case "object":
                type = SchemaNodeType.Object;
                return true;
            case "array":
                type = SchemaNodeType.Array;
                return true;
            case "string":
                type = SchemaNodeType.String;
                return true;
            case "integer":
                type = SchemaNodeType.Integer;
                return true;
            case "number":
                type = SchemaNodeType.Number;
                return true;
            case "boolean":
                type = SchemaNodeType.Boolean;
                return true;
            case "null":
                type = SchemaNodeType.Null;
                return true;
            default:
                type = default;
                return false;
        }
    }

    public static bool IsLeaf(this SchemaNodeType type) =>
        type is not (SchemaNodeType.Object or SchemaNodeType.Array);
}
