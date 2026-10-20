using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MockApi.Core.Generation;
using MockApi.Core.Inference;
using MockApi.Core.Schemas;
using MockApi.Core.Serialization;

namespace MockApi.UnitTests.Generation;

public sealed class JsonGeneratorTests
{
    private static readonly JsonSerializerOptions Options = JsonDefaults.Create();
    private static readonly JsonGenerator Generator = new();
    private static readonly SchemaValidator Validator = new();

    public static TheoryData<string, string, JsonValueKind> CoreGenerators =>
        new()
        {
            { "integer", """{"name":"autoId","params":{"start":1}}""", JsonValueKind.Number },
            {
                "integer",
                """{"name":"randomInt","params":{"min":1,"max":10}}""",
                JsonValueKind.Number
            },
            {
                "number",
                """{"name":"randomDecimal","params":{"min":1,"max":10,"precision":2}}""",
                JsonValueKind.Number
            },
            { "number", """{"name":"price","params":{"min":1,"max":100}}""", JsonValueKind.Number },
            { "string", """{"name":"price","params":{"min":1,"max":100}}""", JsonValueKind.String },
            {
                "boolean",
                """{"name":"randomBool","params":{"trueProbability":0.5}}""",
                JsonValueKind.True
            },
            { "null", """{"name":"nullValue"}""", JsonValueKind.Null },
            { "string", """{"name":"uuid"}""", JsonValueKind.String },
            { "string", """{"name":"email"}""", JsonValueKind.String },
            { "string", """{"name":"fullName"}""", JsonValueKind.String },
            { "string", """{"name":"firstName"}""", JsonValueKind.String },
            { "string", """{"name":"lastName"}""", JsonValueKind.String },
            { "string", """{"name":"username"}""", JsonValueKind.String },
            { "string", """{"name":"phone"}""", JsonValueKind.String },
            { "string", """{"name":"city"}""", JsonValueKind.String },
            { "string", """{"name":"country"}""", JsonValueKind.String },
            { "string", """{"name":"company"}""", JsonValueKind.String },
            { "string", """{"name":"url"}""", JsonValueKind.String },
            { "string", """{"name":"words","params":{"min":1,"max":3}}""", JsonValueKind.String },
            {
                "string",
                """{"name":"sentence","params":{"minWords":3,"maxWords":8}}""",
                JsonValueKind.String
            },
            { "string", """{"name":"paragraph","params":{"sentences":3}}""", JsonValueKind.String },
            {
                "string",
                """{"name":"dateTime","params":{"kind":"past","rangeDays":365,"format":"iso-datetime"}}""",
                JsonValueKind.String
            },
            {
                "string",
                """{"name":"date","params":{"kind":"past","rangeDays":365}}""",
                JsonValueKind.String
            },
            {
                "string",
                """{"name":"enum","params":{"values":["active","blocked"]}}""",
                JsonValueKind.String
            },
            { "integer", """{"name":"enum","params":{"values":[1,2]}}""", JsonValueKind.Number },
            {
                "string",
                """{"name":"constant","params":{"value":"fixed"}}""",
                JsonValueKind.String
            },
            { "integer", """{"name":"constant","params":{"value":7}}""", JsonValueKind.Number },
            { "number", """{"name":"constant","params":{"value":7.5}}""", JsonValueKind.Number },
            { "boolean", """{"name":"constant","params":{"value":true}}""", JsonValueKind.True },
            { "null", """{"name":"constant","params":{"value":null}}""", JsonValueKind.Null },
        };

    [Theory]
    [MemberData(nameof(CoreGenerators))]
    public void Every_core_generator_emits_the_node_type(
        string type,
        string generator,
        JsonValueKind expected
    )
    {
        var schema = LeafSchema(type, generator);
        Assert.True(Validator.Validate(schema).IsValid);

        var result = Generator.Generate(schema);
        var actual = result?.GetValueKind() ?? JsonValueKind.Null;

        if (expected == JsonValueKind.True)
        {
            Assert.True(actual is JsonValueKind.True or JsonValueKind.False);
        }
        else
        {
            Assert.Equal(expected, actual);
        }
    }

    [Fact]
    public void Random_bool_honours_zero_and_one_probability()
    {
        var alwaysFalse = Generator.Generate(
            LeafSchema("boolean", """{"name":"randomBool","params":{"trueProbability":0}}""")
        )!;
        var alwaysTrue = Generator.Generate(
            LeafSchema("boolean", """{"name":"randomBool","params":{"trueProbability":1}}""")
        )!;

        Assert.False(alwaysFalse.GetValue<bool>());
        Assert.True(alwaysTrue.GetValue<bool>());
    }

    [Fact]
    public void Random_int_stays_within_the_inclusive_range()
    {
        var schema = LeafSchema("integer", """{"name":"randomInt","params":{"min":5,"max":7}}""");

        for (var iteration = 0; iteration < 100; iteration++)
        {
            var value = Generator.Generate(schema)!.GetValue<int>();
            Assert.InRange(value, 5, 7);
        }
    }

    [Fact]
    public void Random_decimal_honours_precision()
    {
        var schema = LeafSchema(
            "number",
            """{"name":"randomDecimal","params":{"min":1,"max":2,"precision":2}}"""
        );

        for (var iteration = 0; iteration < 50; iteration++)
        {
            var value = Generator.Generate(schema)!.GetValue<double>();
            Assert.InRange(value, 1, 2);
            Assert.Equal(Math.Round(value, 2, MidpointRounding.AwayFromZero), value, precision: 10);
        }
    }

    [Fact]
    public void Price_is_a_string_on_a_string_node_and_a_number_on_a_number_node()
    {
        var stringValue = Generator.Generate(
            LeafSchema("string", """{"name":"price","params":{"min":1,"max":100}}""")
        )!;
        var numberValue = Generator.Generate(
            LeafSchema("number", """{"name":"price","params":{"min":1,"max":100}}""")
        )!;

        Assert.Equal(JsonValueKind.String, stringValue.GetValueKind());
        Assert.Equal(JsonValueKind.Number, numberValue.GetValueKind());
        Assert.True(
            decimal.TryParse(
                stringValue.GetValue<string>(),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out _
            )
        );
    }

    [Fact]
    public void Object_field_order_matches_the_fields_array()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"z","node":{"type":"string","generator":{"name":"uuid"}}},
              {"name":"a","node":{"type":"string","generator":{"name":"email"}}},
              {"name":"m","node":{"type":"boolean","generator":{"name":"randomBool"}}}
            ]}}
            """
        );

        var json = Generator.Generate(schema)!.ToJsonString();
        using var document = JsonDocument.Parse(json);
        var names = document
            .RootElement.EnumerateObject()
            .Select(property => property.Name)
            .ToArray();

        Assert.Equal(["z", "a", "m"], names);
    }

    [Fact]
    public void Auto_id_uses_the_list_index_in_a_root_array()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"array","item":{"type":"object","fields":[
              {"name":"id","node":{"type":"integer","generator":{"name":"autoId","params":{"start":5}}}},
              {"name":"name","node":{"type":"string","generator":{"name":"fullName"}}}
            ]}}}
            """
        );

        var result = Generator
            .Generate(schema, new GenerationOptions { ListMin = 3, ListMax = 3 })!
            .AsArray();

        Assert.Equal(3, result.Count);
        Assert.Equal([5L, 6L, 7L], result.Select(item => item!["id"]!.GetValue<long>()));
    }

    [Fact]
    public void Auto_id_continues_from_the_pagination_offset()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"array","item":{"type":"object","fields":[
              {"name":"id","node":{"type":"integer","generator":{"name":"autoId","params":{"start":5}}}}
            ]}}}
            """
        );

        var result = Generator
            .Generate(
                schema,
                new GenerationOptions
                {
                    ListMin = 2,
                    ListMax = 2,
                    ListIndexOffset = 10,
                }
            )!
            .AsArray();

        Assert.Equal([15L, 16L], result.Select(item => item!["id"]!.GetValue<long>()));
    }

    [Fact]
    public void Auto_id_outside_a_list_is_a_random_value()
    {
        var schema = LeafSchema("integer", """{"name":"autoId","params":{"start":5}}""");

        var value = Generator.Generate(schema)!.GetValue<int>();

        Assert.InRange(value, 1, 100_000);
    }

    [Fact]
    public void Root_array_length_comes_from_options_when_provided()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"array","length":{"min":2,"max":2},"item":{"type":"integer","generator":{"name":"randomInt","params":{"min":1,"max":3}}}}}
            """
        );

        var withOptions = Generator
            .Generate(schema, new GenerationOptions { ListMin = 4, ListMax = 4 })!
            .AsArray();
        var withNodeLength = Generator.Generate(schema)!.AsArray();

        Assert.Equal(4, withOptions.Count);
        Assert.Equal(2, withNodeLength.Count);
    }

    [Fact]
    public void Nested_array_length_comes_from_the_node()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"tags","node":{"type":"array","length":{"min":2,"max":2},"item":{"type":"string","generator":{"name":"words","params":{"min":1,"max":1}}}}}
            ]}}
            """
        );

        var result = Generator.Generate(schema)!;

        Assert.Equal(2, result["tags"]!.AsArray().Count);
    }

    [Fact]
    public void Null_and_omit_probabilities_are_applied()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"alwaysNull","nullProbability":1,"node":{"type":"string","generator":{"name":"email"}}},
              {"name":"alwaysOmitted","omitProbability":1,"node":{"type":"string","generator":{"name":"email"}}},
              {"name":"kept","node":{"type":"string","generator":{"name":"email"}}}
            ]}}
            """
        );

        var result = Generator.Generate(schema)!.AsObject();

        Assert.Equal(2, result.Count);
        Assert.True(result.ContainsKey("alwaysNull"));
        Assert.Null(result["alwaysNull"]);
        Assert.False(result.ContainsKey("alwaysOmitted"));
        Assert.NotNull(result["kept"]);
    }

    [Fact]
    public void Dates_are_utc_and_use_the_requested_formats()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"createdAt","node":{"type":"string","generator":{"name":"dateTime","params":{"kind":"past","rangeDays":1,"format":"iso-datetime"}}}},
              {"name":"updatedAt","node":{"type":"string","generator":{"name":"dateTime","params":{"kind":"future","rangeDays":1,"format":"iso-datetime-ms"}}}},
              {"name":"birthday","node":{"type":"string","generator":{"name":"date","params":{"kind":"past","rangeDays":10}}}}
            ]}}
            """
        );
        var reference = DateTimeOffset.Parse("2026-10-20T12:00:00Z", CultureInfo.InvariantCulture);

        var result = Generator.Generate(
            schema,
            new GenerationOptions { ReferenceTime = reference }
        )!;

        var createdAt = result["createdAt"]!.GetValue<string>();
        var updatedAt = result["updatedAt"]!.GetValue<string>();
        var birthday = result["birthday"]!.GetValue<string>();

        Assert.Matches(new Regex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"), createdAt);
        Assert.Matches(new Regex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"), updatedAt);
        Assert.Matches(new Regex(@"^\d{4}-\d{2}-\d{2}$"), birthday);
        Assert.True(DateTimeOffset.Parse(createdAt, CultureInfo.InvariantCulture) <= reference);
        Assert.True(DateTimeOffset.Parse(updatedAt, CultureInfo.InvariantCulture) >= reference);
    }

    [Fact]
    public void Strings_are_escaped_correctly()
    {
        const string value = "quote \" newline\ncontrol \u0001 and unicode 日本";
        var schema = new Schema
        {
            Version = 1,
            Root = new LeafNode(
                SchemaNodeType.String,
                new GeneratorSpec
                {
                    Name = "constant",
                    Params = new JsonObject { ["value"] = value },
                }
            ),
        };

        var json = Generator.Generate(schema)!.ToJsonString();
        using var document = JsonDocument.Parse(json);

        Assert.Equal(value, document.RootElement.GetString());
    }

    [Fact]
    public void Value_cap_is_enforced_during_generation()
    {
        var schema = Deserialize(
            """
            {"version":1,"root":{"type":"array","length":{"min":10,"max":10},"item":{"type":"object","fields":[
              {"name":"a","node":{"type":"string","generator":{"name":"uuid"}}},
              {"name":"b","node":{"type":"string","generator":{"name":"email"}}},
              {"name":"c","node":{"type":"string","generator":{"name":"firstName"}}}
            ]}}}
            """
        );

        Assert.Throws<ResponseTooLargeException>(() =>
            Generator.Generate(schema, new GenerationOptions { MaxValues = 5 })
        );
    }

    [Fact]
    public void Estimator_matches_the_worst_case_shape()
    {
        var leaf = new LeafNode(SchemaNodeType.String, new GeneratorSpec { Name = "uuid" });
        var schema = new Schema
        {
            Version = 1,
            Root = new ObjectNode
            {
                Fields =
                [
                    new SchemaField { Name = "a", Node = leaf },
                    new SchemaField { Name = "b", Node = leaf },
                ],
            },
        };

        Assert.Equal(2, Generator.EstimateValueCount(schema));

        var list = new Schema
        {
            Version = 1,
            Root = new ArrayNode { Item = schema.Root, Length = new ArrayLength(1, 5) },
        };

        Assert.Equal(
            10,
            Generator.EstimateValueCount(list, new GenerationOptions { ListMin = 5, ListMax = 5 })
        );
    }

    [Fact]
    public void Inferred_schemas_always_generate_parseable_json()
    {
        var inferrer = new SampleInferrer();
        var samples = new[]
        {
            """{"id":1,"name":"Ahmed","tags":["a","b"],"meta":{"active":true}}""",
            """[{"id":1,"price":19.99},{"id":2,"price":4.5}]""",
            """{"data":[{"name":"A"}],"page":1,"total":10}""",
            """{"empty":[],"nothing":null}""",
            """{"created_at":"2026-01-15T10:30:00Z","unknown":{"deep":[1,2,3]}}""",
        };

        foreach (var sample in samples)
        {
            var schema = inferrer.Infer(sample).Schema;
            Assert.True(Validator.Validate(schema).IsValid);

            var json = Generator
                .Generate(schema, new GenerationOptions { ListMin = 2, ListMax = 2 })!
                .ToJsonString();

            using var document = JsonDocument.Parse(json);
            Assert.True(
                document.RootElement.ValueKind is JsonValueKind.Object or JsonValueKind.Array
            );
        }
    }

    private static Schema LeafSchema(string type, string generator) =>
        Deserialize(
            """{"version":1,"root":{"type":"TYPE","generator":GENERATOR}}"""
                .Replace("TYPE", type, StringComparison.Ordinal)
                .Replace("GENERATOR", generator, StringComparison.Ordinal)
        );

    private static Schema Deserialize(string json) =>
        JsonSerializer.Deserialize<Schema>(json, Options)!;
}
