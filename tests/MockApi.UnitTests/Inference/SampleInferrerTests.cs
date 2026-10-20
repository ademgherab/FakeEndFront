using System.Text.Json;
using System.Text.Json.Nodes;
using MockApi.Core.Inference;
using MockApi.Core.Schemas;
using MockApi.Core.Serialization;
using MockApi.UnitTests.Schemas;

namespace MockApi.UnitTests.Inference;

public sealed class SampleInferrerTests
{
    private static readonly JsonSerializerOptions Options = JsonDefaults.Create();
    private static readonly SampleInferrer Inferrer = new();
    private static readonly SchemaValidator Validator = new();

    [Fact]
    public void Spec_sample_produces_the_exact_schema()
    {
        const string sample =
            """{"id":1,"name":"Ahmed Benali","email":"ahmed@example.com","age":28,"created_at":"2026-01-15T10:30:00Z"}""";

        var result = Inferrer.Infer(sample);

        var serialized = JsonSerializer.Serialize(result.Schema, Options);
        Assert.True(
            JsonNode.DeepEquals(
                JsonNode.Parse(serialized),
                JsonNode.Parse(SchemaModelTests.SpecExample)
            ),
            serialized
        );
        Assert.True(Validator.Validate(result.Schema).IsValid);
    }

    [Fact]
    public void Object_fields_keep_first_seen_order()
    {
        var result = Inferrer.Infer("""{"z":1,"a":"x","m":true}""");
        var root = Assert.IsType<ObjectNode>(result.Schema.Root);

        Assert.Equal(["z", "a", "m"], root.Fields.Select(field => field.Name));
    }

    [Fact]
    public void Integer_and_number_are_decided_from_raw_json_text()
    {
        var result = Inferrer.Infer("""{"a":1,"b":1.0,"c":1e3}""");

        Assert.Equal(SchemaNodeType.Integer, Leaf(result.Schema.Root, "a").Type);
        Assert.Equal(SchemaNodeType.Number, Leaf(result.Schema.Root, "b").Type);
        Assert.Equal(SchemaNodeType.Number, Leaf(result.Schema.Root, "c").Type);
    }

    [Fact]
    public void Array_merging_computes_omit_and_null_probabilities()
    {
        var items = new JsonArray();

        for (var index = 0; index < 100; index++)
        {
            var item = new JsonObject { ["id"] = index + 1, ["name"] = $"User {index}" };

            if (index >= 3)
            {
                item["nickname"] = $"user{index}";
            }

            item["bio"] = index < 2 ? null : $"Biography {index}";
            items.Add(item);
        }

        var result = Inferrer.Infer(items);

        var itemNode = Assert.IsType<ObjectNode>(Assert.IsType<ArrayNode>(result.Schema.Root).Item);
        var nickname = Field(itemNode, "nickname");
        var bio = Field(itemNode, "bio");

        Assert.Equal(0.03, nickname.OmitProbability);
        Assert.Null(nickname.NullProbability);
        Assert.Equal(0.02, bio.NullProbability);
        Assert.Null(bio.OmitProbability);
        Assert.True(Validator.Validate(result.Schema).IsValid);
    }

    [Fact]
    public void Empty_array_becomes_a_null_item_with_a_warning()
    {
        var result = Inferrer.Infer("""{"tags":[]}""");

        var tags = Assert.IsType<ArrayNode>(Field(result.Schema.Root, "tags").Node);
        var item = Assert.IsType<LeafNode>(tags.Item);

        Assert.Equal(SchemaNodeType.Null, item.Type);
        Assert.Equal("nullValue", item.Generator!.Name);
        Assert.Equal(new ArrayLength(1, 3), tags.Length);
        Assert.Contains(
            result.Warnings,
            warning => warning.Code == InferenceWarningCodes.EmptyArray
        );
        Assert.True(Validator.Validate(result.Schema).IsValid);
    }

    [Fact]
    public void Wrap_in_list_wraps_a_non_array_root()
    {
        var result = Inferrer.Infer("""{"id":1}""", new InferenceOptions { WrapInList = true });

        var root = Assert.IsType<ArrayNode>(result.Schema.Root);
        Assert.IsType<ObjectNode>(root.Item);
    }

    [Fact]
    public void Wrap_in_list_does_not_double_wrap_an_array_root()
    {
        var result = Inferrer.Infer("""[{"id":1}]""", new InferenceOptions { WrapInList = true });

        var root = Assert.IsType<ArrayNode>(result.Schema.Root);
        Assert.IsType<ObjectNode>(root.Item);
    }

    [Theory]
    [InlineData("3f2b8c4e-1a2b-4c5d-8e9f-0a1b2c3d4e5f", "uuid")]
    [InlineData("ahmed@example.com", "email")]
    [InlineData("2026-01-15T10:30:00Z", "dateTime")]
    [InlineData("2026-01-15T10:30:00.123Z", "dateTime")]
    [InlineData("2026-01-15", "date")]
    [InlineData("https://example.com/users/1", "url")]
    public void Value_patterns_select_high_confidence_generators(string value, string expected)
    {
        var result = Inferrer.Infer($$"""{"value":{{JsonSerializer.Serialize(value)}}}""");

        Assert.Equal(expected, Leaf(result.Schema.Root, "value").Generator!.Name);
    }

    [Fact]
    public void Date_time_precision_selects_the_matching_format()
    {
        var result = Inferrer.Infer(
            """{"a":"2026-01-15T10:30:00.123Z","b":"2026-01-15T10:30:00Z"}"""
        );

        var withMs = Leaf(result.Schema.Root, "a").Generator!.Params!;
        var seconds = Leaf(result.Schema.Root, "b").Generator!.Params!;

        Assert.Equal("iso-datetime-ms", withMs["format"]!.GetValue<string>());
        Assert.Equal("iso-datetime", seconds["format"]!.GetValue<string>());
    }

    [Theory]
    [InlineData("email", "email")]
    [InlineData("firstName", "firstName")]
    [InlineData("lastName", "lastName")]
    [InlineData("fullName", "fullName")]
    [InlineData("username", "username")]
    [InlineData("city", "city")]
    [InlineData("country", "country")]
    [InlineData("phone", "phone")]
    [InlineData("company", "company")]
    [InlineData("title", "sentence")]
    [InlineData("description", "paragraph")]
    [InlineData("status", "enum")]
    [InlineData("type", "enum")]
    [InlineData("role", "enum")]
    [InlineData("createdAt", "dateTime")]
    [InlineData("updated_at", "dateTime")]
    [InlineData("url", "url")]
    public void String_name_rules_select_the_expected_generator(string name, string expected)
    {
        var result = Inferrer.Infer($$"""{"{{name}}":"plain"}""");

        Assert.Equal(expected, Leaf(result.Schema.Root, name).Generator!.Name);
    }

    [Theory]
    [InlineData("id", "1", "autoId")]
    [InlineData("age", "28", "randomInt")]
    [InlineData("price", "19.99", "price")]
    [InlineData("amount", "19.99", "price")]
    [InlineData("rating", "4", "randomInt")]
    [InlineData("score", "4.5", "randomDecimal")]
    [InlineData("count", "12", "randomInt")]
    [InlineData("views", "12", "randomInt")]
    public void Numeric_name_rules_select_the_expected_generator(
        string name,
        string value,
        string expected
    )
    {
        var result = Inferrer.Infer($$"""{"{{name}}":{{value}}}""");

        Assert.Equal(expected, Leaf(result.Schema.Root, name).Generator!.Name);
    }

    [Fact]
    public void Numeric_looking_string_price_keeps_string_type()
    {
        var result = Inferrer.Infer("""{"price":"19.99"}""");

        var node = Leaf(result.Schema.Root, "price");
        Assert.Equal(SchemaNodeType.String, node.Type);
        Assert.Equal("price", node.Generator!.Name);
    }

    [Fact]
    public void Fallbacks_match_the_value_type()
    {
        var result = Inferrer.Infer(
            """{"int":7,"number":7.25,"bool":true,"str":"quiet river","nothing":null}"""
        );

        Assert.Equal("randomInt", Leaf(result.Schema.Root, "int").Generator!.Name);
        Assert.Equal("randomDecimal", Leaf(result.Schema.Root, "number").Generator!.Name);
        Assert.Equal("randomBool", Leaf(result.Schema.Root, "bool").Generator!.Name);
        Assert.Equal("words", Leaf(result.Schema.Root, "str").Generator!.Name);
        Assert.Equal("nullValue", Leaf(result.Schema.Root, "nothing").Generator!.Name);
        Assert.Contains(
            result.Warnings,
            warning => warning.Code == InferenceWarningCodes.NullTypeUnknown
        );
    }

    [Theory]
    [InlineData("color", "\"#a1b2c3\"")]
    [InlineData("ip", "\"1.2.3.4\"")]
    [InlineData("countryCode", "\"US\"")]
    [InlineData("imageUrl", "\"https://example.com/a.png\"")]
    [InlineData("avatarUrl", "\"https://example.com/a.png\"")]
    [InlineData("streetAddress", "\"12 Oak Street\"")]
    [InlineData("zipCode", "\"69000\"")]
    [InlineData("jobTitle", "\"Engineer\"")]
    [InlineData("unixTimestamp", "1767225600")]
    public void Removed_patterns_fall_back_instead_of_using_a_removed_generator(
        string name,
        string value
    )
    {
        var result = Inferrer.Infer($$"""{"{{name}}":{{value}}}""");

        var generator = Leaf(result.Schema.Root, name).Generator!.Name;
        Assert.DoesNotContain(
            generator,
            new[]
            {
                "ipv4",
                "hexColor",
                "imageUrl",
                "avatarUrl",
                "unixTimestamp",
                "streetAddress",
                "state",
                "zipCode",
                "countryCode",
                "currencyCode",
                "productName",
                "jobTitle",
            }
        );
        Assert.True(Validator.Validate(result.Schema).IsValid);
    }

    [Fact]
    public void Removed_product_name_pattern_falls_back()
    {
        var result = Inferrer.Infer("""{"product":{"name":"Widget"}}""");

        var product = Assert.IsType<ObjectNode>(Field(result.Schema.Root, "product").Node);
        var name = Assert.IsType<LeafNode>(Field(product, "name").Node);

        Assert.Equal("words", name.Generator!.Name);
    }

    [Fact]
    public void Enum_is_detected_from_array_values_with_a_warning()
    {
        var result = Inferrer.Infer("""{"items":[{"foo":"a"},{"foo":"b"},{"foo":"c"}]}""");

        var items = Assert.IsType<ArrayNode>(Field(result.Schema.Root, "items").Node);
        var item = Assert.IsType<ObjectNode>(items.Item);
        var foo = Assert.IsType<LeafNode>(Field(item, "foo").Node);

        Assert.Equal("enum", foo.Generator!.Name);
        Assert.Equal(3, foo.Generator.Params!["values"]!.AsArray().Count);
        Assert.Contains(
            result.Warnings,
            warning => warning.Code == InferenceWarningCodes.EnumFromSample
        );
    }

    [Fact]
    public void Mixed_types_choose_number_and_emit_a_warning_at_the_path()
    {
        var result = Inferrer.Infer("""{"items":[{"value":1},{"value":2.5}]}""");

        var items = Assert.IsType<ArrayNode>(Field(result.Schema.Root, "items").Node);
        var item = Assert.IsType<ObjectNode>(items.Item);
        var value = Assert.IsType<LeafNode>(Field(item, "value").Node);
        var warning = Assert.Single(
            result.Warnings,
            candidate => candidate.Code == InferenceWarningCodes.MixedTypes
        );

        Assert.Equal(SchemaNodeType.Number, value.Type);
        Assert.Equal("/items/0/value", warning.Path);
    }

    [Fact]
    public void Suggestions_detect_the_list_and_pagination_envelope()
    {
        const string sample = """
            {
              "data": [ { "id": 1 } ],
              "meta": { "page": 1, "limit": 10, "total": 100, "totalPages": 10, "hasNext": true, "hasPrev": false }
            }
            """;

        var result = Inferrer.Infer(sample);

        Assert.Equal("/data", result.Suggestions.List?.Path);
        Assert.Equal("/meta/page", result.Suggestions.Pagination?.Bindings.Page);
        Assert.Equal("/meta/limit", result.Suggestions.Pagination?.Bindings.Limit);
        Assert.Equal("/meta/total", result.Suggestions.Pagination?.Bindings.Total);
        Assert.Equal("/meta/totalPages", result.Suggestions.Pagination?.Bindings.TotalPages);
        Assert.Equal("/meta/hasNext", result.Suggestions.Pagination?.Bindings.HasNext);
        Assert.Equal("/meta/hasPrev", result.Suggestions.Pagination?.Bindings.HasPrev);
    }

    [Fact]
    public void Root_array_has_no_list_path_suggestion()
    {
        var result = Inferrer.Infer("""[{"id":1}]""");

        Assert.Null(result.Suggestions.List);
    }

    [Fact]
    public void Sample_content_is_not_retained_outside_enum_values()
    {
        const string canary = "CANARY_SECRET_123";
        var result = Inferrer.Infer($$"""{"note":"{{canary}}"}""");
        var serialized = JsonSerializer.Serialize(result.Schema, Options);

        Assert.DoesNotContain(canary, serialized, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("""{"id":1}""")]
    [InlineData("""{"items":[{"price":1},{"price":2.5}],"meta":{"page":1}}""")]
    [InlineData("""[{"a":1},{"a":"x"}]""")]
    [InlineData("""{"error":"not-json"}""")]
    public void Every_emitted_schema_passes_validation(string sample)
    {
        var result = Inferrer.Infer(sample);

        Assert.True(
            Validator.Validate(result.Schema).IsValid,
            string.Join(
                Environment.NewLine,
                Validator
                    .Validate(result.Schema)
                    .Errors.Select(error => $"{error.Path}: {error.Message}")
            )
        );
    }

    [Theory]
    [InlineData("42")]
    [InlineData("\"text\"")]
    [InlineData("null")]
    [InlineData("true")]
    public void Scalar_and_null_roots_are_rejected(string sample)
    {
        var exception = Assert.Throws<SampleInferenceException>(() => Inferrer.Infer(sample));

        Assert.Equal("sample_invalid", exception.Code);
    }

    private static SchemaField Field(SchemaNode? node, string name) =>
        Assert.IsType<ObjectNode>(node).Fields.Single(field => field.Name == name);

    private static LeafNode Leaf(SchemaNode? node, string name) =>
        Assert.IsType<LeafNode>(Field(node, name).Node);
}
