using System.Text.Json.Nodes;

namespace MockApi.Core.Schemas;

/// <summary>
/// The exact schema envelope from technical spec §5.1. <see cref="Version"/> defaults to zero so
/// a missing property is rejected by <see cref="SchemaValidator"/> instead of silently becoming 1.
/// </summary>
public sealed class Schema
{
    public int Version { get; init; }

    public SchemaNode? Root { get; init; }
}

public abstract class SchemaNode
{
    public abstract SchemaNodeType NodeType { get; }
}

public sealed class ObjectNode : SchemaNode
{
    public IReadOnlyList<SchemaField> Fields { get; init; } = [];

    public override SchemaNodeType NodeType => SchemaNodeType.Object;
}

public sealed class ArrayNode : SchemaNode
{
    public SchemaNode? Item { get; init; }

    public ArrayLength? Length { get; init; }

    public override SchemaNodeType NodeType => SchemaNodeType.Array;
}

public sealed class LeafNode : SchemaNode
{
    public LeafNode() { }

    public LeafNode(SchemaNodeType type, GeneratorSpec generator)
    {
        Type = type;
        Generator = generator;
    }

    public SchemaNodeType Type { get; init; }

    public GeneratorSpec? Generator { get; init; }

    public override SchemaNodeType NodeType => Type;
}

/// <summary>
/// A property of an object node. Fields are intentionally an ordered array, never a map, so
/// output field order survives inference and JSONB storage (spec §5.1 and §5.3).
/// </summary>
public sealed class SchemaField
{
    public string Name { get; init; } = string.Empty;

    public SchemaNode? Node { get; init; }

    public double? NullProbability { get; init; }

    public double? OmitProbability { get; init; }
}

public sealed record ArrayLength(int Min, int Max);

public sealed class GeneratorSpec
{
    public string Name { get; init; } = string.Empty;

    public JsonObject? Params { get; init; }
}
