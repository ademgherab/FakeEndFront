using System.Text.Json;
using MockApi.Core.Schemas;
using MockApi.Core.Serialization;

namespace MockApi.UnitTests.Schemas;

public sealed class SchemaValidatorTests
{
    private static readonly JsonSerializerOptions Options = JsonDefaults.Create();
    private static readonly SchemaValidator Validator = new();

    public static TheoryData<string, string> CoreGenerators =>
        new()
        {
            { "integer", """{"name":"autoId","params":{"start":1}}""" },
            { "integer", """{"name":"randomInt","params":{"min":1,"max":10}}""" },
            { "number", """{"name":"randomDecimal","params":{"min":1,"max":10,"precision":2}}""" },
            { "number", """{"name":"price","params":{"min":1,"max":100}}""" },
            { "string", """{"name":"price","params":{"min":1,"max":100}}""" },
            { "boolean", """{"name":"randomBool","params":{"trueProbability":0.5}}""" },
            { "null", """{"name":"nullValue"}""" },
            { "string", """{"name":"uuid"}""" },
            { "string", """{"name":"email"}""" },
            { "string", """{"name":"fullName"}""" },
            { "string", """{"name":"firstName"}""" },
            { "string", """{"name":"lastName"}""" },
            { "string", """{"name":"username"}""" },
            { "string", """{"name":"phone"}""" },
            { "string", """{"name":"city"}""" },
            { "string", """{"name":"country"}""" },
            { "string", """{"name":"company"}""" },
            { "string", """{"name":"url"}""" },
            { "string", """{"name":"words","params":{"min":1,"max":3}}""" },
            { "string", """{"name":"sentence","params":{"minWords":3,"maxWords":8}}""" },
            { "string", """{"name":"paragraph","params":{"sentences":3}}""" },
            {
                "string",
                """{"name":"dateTime","params":{"kind":"past","rangeDays":365,"format":"iso-datetime"}}"""
            },
            { "string", """{"name":"date","params":{"kind":"past","rangeDays":365}}""" },
            { "string", """{"name":"enum","params":{"values":["active","blocked"]}}""" },
            { "integer", """{"name":"enum","params":{"values":[1,2]}}""" },
            { "string", """{"name":"constant","params":{"value":"fixed"}}""" },
            { "integer", """{"name":"constant","params":{"value":7}}""" },
            { "number", """{"name":"constant","params":{"value":7.5}}""" },
            { "boolean", """{"name":"constant","params":{"value":true}}""" },
            { "null", """{"name":"constant","params":{"value":null}}""" },
        };

    [Theory]
    [MemberData(nameof(CoreGenerators))]
    public void Every_core_generator_validates_on_a_supported_type(string type, string generator)
    {
        var result = Validator.Validate(LeafSchema(type, generator));

        Assert.True(result.IsValid, Describe(result));
    }

    [Theory]
    [InlineData("ipv4")]
    [InlineData("hexColor")]
    [InlineData("imageUrl")]
    [InlineData("avatarUrl")]
    [InlineData("unixTimestamp")]
    [InlineData("streetAddress")]
    [InlineData("state")]
    [InlineData("zipCode")]
    [InlineData("countryCode")]
    [InlineData("currencyCode")]
    [InlineData("productName")]
    [InlineData("jobTitle")]
    [InlineData("notAGenerator")]
    public void Removed_and_unknown_generators_are_rejected(string name)
    {
        var result = Validator.Validate(LeafSchema("string", $$"""{"name":"{{name}}"}"""));

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.name", error.Path);
        Assert.Contains(name, error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("integer", "email")]
    [InlineData("string", "randomInt")]
    [InlineData("boolean", "autoId")]
    [InlineData("number", "randomBool")]
    [InlineData("null", "uuid")]
    public void Generator_must_support_the_leaf_type(string type, string generator)
    {
        var result = Validator.Validate(LeafSchema(type, $$"""{"name":"{{generator}}"}"""));

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.name", error.Path);
    }

    [Fact]
    public void Spec_example_validates()
    {
        var schema = Deserialize(SchemaModelTests.SpecExample);

        var result = Validator.Validate(schema);

        Assert.True(result.IsValid, Describe(result));
    }

    [Fact]
    public void Version_must_be_one()
    {
        const string json =
            """{"version":2,"root":{"type":"null","generator":{"name":"nullValue"}}}""";

        var result = Validator.Validate(Deserialize(json));

        var error = Assert.Single(result.Errors);
        Assert.Equal("version", error.Path);
    }

    [Fact]
    public void Duplicate_field_names_are_rejected()
    {
        const string json = """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"name","node":{"type":"string","generator":{"name":"email"}}},
              {"name":"name","node":{"type":"string","generator":{"name":"email"}}}
            ]}}
            """;

        var result = Validator.Validate(Deserialize(json));

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.fields[1].name", error.Path);
    }

    [Fact]
    public void Field_name_length_is_bounded()
    {
        var name = new string('a', 101);
        var json =
            """{"version":1,"root":{"type":"object","fields":[{"name":"FIELD_NAME","node":{"type":"null","generator":{"name":"nullValue"}}}]}}""".Replace(
                "FIELD_NAME",
                name,
                StringComparison.Ordinal
            );

        var result = Validator.Validate(Deserialize(json));

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.fields[0].name", error.Path);
    }

    [Fact]
    public void Object_field_count_is_bounded()
    {
        var fields = string.Join(
            ',',
            Enumerable
                .Range(0, 101)
                .Select(index =>
                    """{"name":"FIELD_INDEX","node":{"type":"null","generator":{"name":"nullValue"}}}""".Replace(
                        "FIELD_INDEX",
                        $"f{index}",
                        StringComparison.Ordinal
                    )
                )
        );

        var schema = Deserialize(
            """{"version":1,"root":{"type":"object","fields":[FIELDS]}}""".Replace(
                "FIELDS",
                fields,
                StringComparison.Ordinal
            )
        );

        var result = Validator.Validate(schema);

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.fields", error.Path);
    }

    [Theory]
    [InlineData("nullProbability", "-0.1")]
    [InlineData("nullProbability", "1.1")]
    [InlineData("omitProbability", "2")]
    public void Probabilities_must_be_between_zero_and_one(string property, string value)
    {
        var json =
            """{"version":1,"root":{"type":"object","fields":[{"name":"x","PROPERTY":VALUE,"node":{"type":"null","generator":{"name":"nullValue"}}}]}}"""
                .Replace("PROPERTY", property, StringComparison.Ordinal)
                .Replace("VALUE", value, StringComparison.Ordinal);

        var result = Validator.Validate(Deserialize(json));

        var error = Assert.Single(result.Errors);
        Assert.Equal($"root.fields[0].{property}", error.Path);
    }

    [Fact]
    public void Depth_is_limited_to_ten()
    {
        SchemaNode node = new LeafNode(
            SchemaNodeType.Null,
            new GeneratorSpec { Name = "nullValue" }
        );

        for (var index = 0; index < 10; index++)
        {
            node = new ObjectNode
            {
                Fields = [new SchemaField { Name = $"level{index}", Node = node }],
            };
        }

        var result = Validator.Validate(new Schema { Version = 1, Root = node });

        var error = Assert.Single(result.Errors);
        Assert.EndsWith(".node", error.Path, StringComparison.Ordinal);
        Assert.Contains("10", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Node_count_is_limited_to_two_thousand()
    {
        var fieldNodes = Enumerable
            .Range(0, 20)
            .Select(index => new SchemaField
            {
                Name = $"f{index}",
                Node = new LeafNode(SchemaNodeType.Null, new GeneratorSpec { Name = "nullValue" }),
            })
            .ToArray();

        var arrayItems = Enumerable
            .Range(0, 100)
            .Select(index => new SchemaField
            {
                Name = $"a{index}",
                Node = new ArrayNode { Item = new ObjectNode { Fields = fieldNodes } },
            })
            .ToArray();

        var root = new ObjectNode { Fields = arrayItems };

        var result = Validator.Validate(new Schema { Version = 1, Root = root });

        var error = Assert.Single(result.Errors);
        Assert.Contains("2000", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Array_length_bounds_are_validated()
    {
        const string json = """
            {"version":1,"root":{"type":"array","length":{"min":5,"max":2},"item":{"type":"null","generator":{"name":"nullValue"}}}}
            """;

        var result = Validator.Validate(Deserialize(json));

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.length.max", error.Path);
    }

    [Fact]
    public void Unknown_parameters_are_rejected()
    {
        var result = Validator.Validate(
            LeafSchema("string", """{"name":"email","params":{"bogus":1}}""")
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.params.bogus", error.Path);
    }

    [Fact]
    public void Required_parameters_are_required()
    {
        var result = Validator.Validate(
            LeafSchema("integer", """{"name":"randomInt","params":{"min":1}}""")
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.params.max", error.Path);
    }

    [Fact]
    public void Min_must_not_exceed_max()
    {
        var result = Validator.Validate(
            LeafSchema("integer", """{"name":"randomInt","params":{"min":10,"max":2}}""")
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.params.max", error.Path);
    }

    [Fact]
    public void Entity_range_min_must_not_exceed_max()
    {
        var result = Validator.Validate(
            LeafSchema("string", """{"name":"date","params":{"rangeDays":2,"minDaysAgo":3}}""")
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.params.minDaysAgo", error.Path);
    }

    [Theory]
    [InlineData(
        "integer",
        """{"name":"randomInt","params":{"min":1.5,"max":2}}""",
        "root.generator.params.min"
    )]
    [InlineData(
        "number",
        """{"name":"randomDecimal","params":{"min":1,"max":2,"precision":7}}""",
        "root.generator.params.precision"
    )]
    [InlineData(
        "boolean",
        """{"name":"randomBool","params":{"trueProbability":1.5}}""",
        "root.generator.params.trueProbability"
    )]
    [InlineData(
        "string",
        """{"name":"dateTime","params":{"kind":"sometime"}}""",
        "root.generator.params.kind"
    )]
    [InlineData(
        "string",
        """{"name":"dateTime","params":{"format":"rfc"}}""",
        "root.generator.params.format"
    )]
    public void Parameter_types_and_ranges_are_validated(
        string type,
        string generator,
        string expectedPath
    )
    {
        var result = Validator.Validate(LeafSchema(type, generator));

        var error = Assert.Single(result.Errors);
        Assert.Equal(expectedPath, error.Path);
    }

    [Fact]
    public void Enum_requires_at_least_one_typed_value()
    {
        var empty = Validator.Validate(
            LeafSchema("string", """{"name":"enum","params":{"values":[]}}""")
        );
        Assert.Equal("root.generator.params.values", Assert.Single(empty.Errors).Path);

        var wrongType = Validator.Validate(
            LeafSchema("string", """{"name":"enum","params":{"values":["ok",1]}}""")
        );
        Assert.Equal("root.generator.params.values[1]", Assert.Single(wrongType.Errors).Path);
    }

    [Fact]
    public void Constant_value_must_match_the_node_type()
    {
        var result = Validator.Validate(
            LeafSchema("integer", """{"name":"constant","params":{"value":"7"}}""")
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal("root.generator.params.value", error.Path);
    }

    [Fact]
    public void Errors_are_keyed_by_dotted_path_for_the_api_contract()
    {
        const string json = """
            {"version":1,"root":{"type":"object","fields":[{"name":"x","node":{"type":"integer","generator":{"name":"randomInt","params":{"min":5,"max":1}}}}]}}
            """;

        var result = Validator.Validate(Deserialize(json));

        var errors = result.ToErrorDictionary();
        Assert.True(errors.ContainsKey("root.fields[0].node.generator.params.max"));
    }

    private static Schema LeafSchema(string type, string generator) =>
        Deserialize(
            """{"version":1,"root":{"type":"TYPE","generator":GENERATOR}}"""
                .Replace("TYPE", type, StringComparison.Ordinal)
                .Replace("GENERATOR", generator, StringComparison.Ordinal)
        );

    private static Schema Deserialize(string json) =>
        JsonSerializer.Deserialize<Schema>(json, Options)!;

    private static string Describe(SchemaValidationResult result) =>
        string.Join(
            Environment.NewLine,
            result.Errors.Select(error => $"{error.Path}: {error.Message}")
        );
}
