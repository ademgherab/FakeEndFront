using System.Text.Json;
using System.Text.Json.Nodes;
using MockApi.Core.Schemas;
using MockApi.Core.Serialization;

namespace MockApi.UnitTests.Schemas;

public sealed class SchemaModelTests
{
    private static readonly JsonSerializerOptions Options = JsonDefaults.Create();

    public const string SpecExample = """
        {
          "version": 1,
          "root": {
            "type": "object",
            "fields": [
              { "name": "id",         "node": { "type": "integer", "generator": { "name": "autoId", "params": { "start": 1 } } } },
              { "name": "name",       "node": { "type": "string",  "generator": { "name": "fullName" } } },
              { "name": "email",      "node": { "type": "string",  "generator": { "name": "email" } } },
              { "name": "age",        "node": { "type": "integer", "generator": { "name": "randomInt", "params": { "min": 18, "max": 80 } } } },
              { "name": "created_at", "node": { "type": "string",  "generator": { "name": "dateTime", "params": { "kind": "past", "rangeDays": 365, "format": "iso-datetime" } } } }
            ]
          }
        }
        """;

    [Fact]
    public void Spec_example_round_trips_to_the_exact_shape()
    {
        var schema = Deserialize(SpecExample);

        var json = JsonSerializer.Serialize(schema, Options);
        var expected = JsonNode.Parse(SpecExample);
        var actual = JsonNode.Parse(json);

        Assert.True(JsonNode.DeepEquals(expected, actual), json);
        Assert.Contains("\"fields\":[", json, StringComparison.Ordinal);
    }

    [Fact]
    public void Field_order_is_preserved_when_serializing()
    {
        var schema = Deserialize(SpecExample);

        var json = JsonSerializer.Serialize(schema, Options);
        var root = JsonNode.Parse(json)!.AsObject()["root"]!.AsObject();
        var names = root["fields"]!
            .AsArray()
            .Select(field => field!.AsObject()["name"]!.GetValue<string>())
            .ToArray();

        Assert.Equal(["id", "name", "email", "age", "created_at"], names);
    }

    [Fact]
    public void Deeply_nested_nodes_round_trip()
    {
        const string json = """
            {
              "version": 1,
              "root": {
                "type": "array",
                "length": { "min": 1, "max": 4 },
                "item": {
                  "type": "object",
                  "fields": [
                    {
                      "name": "profile",
                      "nullProbability": 0.25,
                      "omitProbability": 0.1,
                      "node": {
                        "type": "object",
                        "fields": [
                          {
                            "name": "tags",
                            "node": {
                              "type": "array",
                              "item": { "type": "string", "generator": { "name": "words", "params": { "min": 1, "max": 2 } } }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            }
            """;

        var schema = Deserialize(json);
        var serialized = JsonSerializer.Serialize(schema, Options);

        Assert.True(JsonNode.DeepEquals(JsonNode.Parse(json), JsonNode.Parse(serialized)));
    }

    [Theory]
    [InlineData("""{"version":1,"root":{"type":"object","fields":[],"extra":true}}""")]
    [InlineData("""{"version":1,"root":{"type":"wat"}}""")]
    [InlineData(
        """{"version":1,"root":{"type":"array","item":{"type":"string","generator":{"name":"email"}},"bogus":1}}"""
    )]
    [InlineData(
        """{"version":1,"root":{"type":"object","fields":[{"name":"x","node":{"type":"string","generator":{"name":"email"}},"extra":1}]}}"""
    )]
    [InlineData(
        """{"version":1,"root":{"type":"string","generator":{"name":"email","params":[]}}}"""
    )]
    [InlineData("""{"version":1,"root":{"type":"object","fields":{} }}""")]
    public void Malformed_schema_json_is_rejected(string json)
    {
        Assert.Throws<JsonException>(() => Deserialize(json));
    }

    [Fact]
    public void Missing_version_is_not_silently_defaulted()
    {
        var schema = Deserialize("""{"root":{"type":"null","generator":{"name":"nullValue"}}}""");

        Assert.Equal(0, schema.Version);
    }

    private static Schema Deserialize(string json) =>
        JsonSerializer.Deserialize<Schema>(json, Options)
        ?? throw new InvalidOperationException("Schema did not deserialize.");
}
