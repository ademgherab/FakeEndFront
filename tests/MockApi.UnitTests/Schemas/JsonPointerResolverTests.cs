using MockApi.Core.Schemas;

namespace MockApi.UnitTests.Schemas;

public sealed class JsonPointerResolverTests
{
    private static readonly SchemaNode Root = new ObjectNode
    {
        Fields =
        [
            Field("data", new ArrayNode { Item = Leaf(SchemaNodeType.String, "email") }),
            Field(
                "meta",
                new ObjectNode
                {
                    Fields =
                    [
                        Field(
                            "page",
                            Leaf(SchemaNodeType.Integer, "randomInt", """{"min":1,"max":10}""")
                        ),
                    ],
                }
            ),
            Field("a/b", Leaf(SchemaNodeType.String, "uuid")),
            Field("t~n", Leaf(SchemaNodeType.String, "uuid")),
        ],
    };

    [Fact]
    public void Empty_pointer_resolves_the_root()
    {
        var result = JsonPointerResolver.Resolve(Root, "");

        Assert.True(result.Success);
        Assert.Same(Root, result.Target!.Node);
    }

    [Fact]
    public void Object_fields_resolve_by_name()
    {
        var result = JsonPointerResolver.ResolveArray(Root, "/data");

        Assert.True(result.Success);
        Assert.IsType<ArrayNode>(result.Target!.Node);
    }

    [Fact]
    public void Array_item_token_resolves_the_item_node()
    {
        var result = JsonPointerResolver.Resolve(Root, "/data/item");

        Assert.True(result.Success);
        Assert.Equal(SchemaNodeType.String, result.Target!.NodeType);
    }

    [Fact]
    public void Nested_object_pointers_resolve_to_leaves()
    {
        var result = JsonPointerResolver.ResolveLeaf(Root, "/meta/page");

        Assert.True(result.Success);
        Assert.Equal(SchemaNodeType.Integer, result.Target!.NodeType);
    }

    [Theory]
    [InlineData("/a~1b")]
    [InlineData("/t~0n")]
    public void Escaped_tokens_are_unescaped(string pointer)
    {
        var result = JsonPointerResolver.ResolveLeaf(Root, pointer);

        Assert.True(result.Success);
    }

    [Fact]
    public void Missing_targets_return_path_specific_errors()
    {
        var result = JsonPointerResolver.Resolve(Root, "/missing");

        Assert.False(result.Success);
        Assert.Contains("missing", result.Error, StringComparison.Ordinal);
    }

    [Fact]
    public void Non_array_targets_are_rejected_for_list_paths()
    {
        var result = JsonPointerResolver.ResolveArray(Root, "/meta/page");

        Assert.False(result.Success);
        Assert.Contains("must target an array", result.Error, StringComparison.Ordinal);
    }

    [Fact]
    public void Traversing_into_a_leaf_is_rejected()
    {
        var result = JsonPointerResolver.Resolve(Root, "/data/item/more");

        Assert.False(result.Success);
        Assert.Contains("Cannot traverse", result.Error, StringComparison.Ordinal);
    }

    [Fact]
    public void Invalid_escapes_are_rejected()
    {
        var result = JsonPointerResolver.Resolve(Root, "/bad~2token");

        Assert.False(result.Success);
        Assert.Contains("escape", result.Error, StringComparison.Ordinal);
    }

    [Fact]
    public void Pointer_must_start_with_a_slash()
    {
        var result = JsonPointerResolver.Resolve(Root, "data");

        Assert.False(result.Success);
    }

    private static SchemaField Field(string name, SchemaNode node) =>
        new() { Name = name, Node = node };

    private static LeafNode Leaf(
        SchemaNodeType type,
        string generatorName,
        string? paramsJson = null
    ) =>
        new(
            type,
            new GeneratorSpec
            {
                Name = generatorName,
                Params = paramsJson is null
                    ? null
                    : System.Text.Json.Nodes.JsonNode.Parse(paramsJson)!.AsObject(),
            }
        );
}
