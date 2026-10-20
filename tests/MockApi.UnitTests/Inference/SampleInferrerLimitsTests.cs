using System.Text.Json.Nodes;
using MockApi.Core.Inference;
using MockApi.Core.Schemas;

namespace MockApi.UnitTests.Inference;

public sealed class SampleInferrerLimitsTests
{
    private static readonly SampleInferrer Inferrer = new();
    private static readonly SchemaValidator Validator = new();

    [Fact]
    public void Sample_bytes_are_limited()
    {
        var options = new InferenceOptions { Limits = new InferenceLimits(MaxSampleBytes: 10) };

        var exception = Assert.Throws<SampleInferenceException>(() =>
            Inferrer.Infer(new string('a', 11), options)
        );

        Assert.Equal("sample_too_complex", exception.Code);
    }

    [Fact]
    public void Depth_exactly_at_the_limit_is_allowed_and_one_more_is_rejected()
    {
        var atLimit = Inferrer.Infer(NestedArrays(9));
        Assert.True(Validator.Validate(atLimit.Schema).IsValid);

        var exception = Assert.Throws<SampleInferenceException>(() =>
            Inferrer.Infer(NestedArrays(10))
        );

        Assert.Equal("sample_too_complex", exception.Code);
    }

    [Fact]
    public void Field_count_exactly_at_the_limit_is_allowed_and_one_more_is_rejected()
    {
        var atLimit = Inferrer.Infer(ObjectWithFields(100));
        Assert.True(Validator.Validate(atLimit.Schema).IsValid);

        var exception = Assert.Throws<SampleInferenceException>(() =>
            Inferrer.Infer(ObjectWithFields(101))
        );

        Assert.Equal("sample_too_complex", exception.Code);
    }

    [Fact]
    public void Node_count_is_limited()
    {
        var sample = WideSample();

        var exception = Assert.Throws<SampleInferenceException>(() => Inferrer.Infer(sample));

        Assert.Equal("sample_too_complex", exception.Code);
    }

    [Fact]
    public void Custom_node_limit_is_checked_inclusively()
    {
        var limits = new InferenceOptions { Limits = new InferenceLimits(MaxNodes: 3) };

        Assert.True(Validator.Validate(Inferrer.Infer("""{"a":1,"b":2}""", limits).Schema).IsValid);

        Assert.Throws<SampleInferenceException>(() =>
            Inferrer.Infer("""{"a":1,"b":2,"c":3}""", limits)
        );
    }

    [Fact]
    public void Random_samples_within_limits_always_validate()
    {
        var random = new Random(20261020);

        for (var iteration = 0; iteration < 50; iteration++)
        {
            var sample = RandomObject(random, depth: 3);
            var result = Inferrer.Infer(sample);

            Assert.True(
                Validator.Validate(result.Schema).IsValid,
                $"Iteration {iteration}: {sample.ToJsonString()}"
            );
        }
    }

    private static string NestedArrays(int arrays)
    {
        var json = "\"value\"";

        for (var index = 0; index < arrays; index++)
        {
            json = $"[{json}]";
        }

        return json;
    }

    private static string ObjectWithFields(int fields) =>
        "{"
        + string.Join(',', Enumerable.Range(0, fields).Select(index => $"\"f{index}\":{index}"))
        + "}";

    private static string WideSample()
    {
        var fields = new List<string>();

        for (var field = 0; field < 100; field++)
        {
            var nested = string.Join(
                ',',
                Enumerable.Range(0, 20).Select(index => $"\"v{index}\":\"text\"")
            );

            fields.Add($"\"f{field}\":[{{{nested}}}]");
        }

        return "{" + string.Join(',', fields) + "}";
    }

    private static JsonObject RandomObject(Random random, int depth)
    {
        var result = new JsonObject();

        for (var index = 0; index < random.Next(1, 5); index++)
        {
            var name = $"field{index}";
            result[name] = RandomValue(random, depth);
        }

        return result;
    }

    private static JsonNode? RandomValue(Random random, int depth)
    {
        if (depth <= 0)
        {
            return RandomScalar(random);
        }

        return random.Next(0, 5) switch
        {
            0 => RandomScalar(random),
            1 => new JsonArray(
                Enumerable
                    .Range(0, random.Next(0, 3))
                    .Select(_ => RandomValue(random, depth - 1))
                    .ToArray()
            ),
            2 => RandomObject(random, depth - 1),
            _ => RandomScalar(random),
        };
    }

    private static JsonNode? RandomScalar(Random random) =>
        random.Next(0, 6) switch
        {
            0 => JsonValue.Create(random.Next(-10, 100)),
            1 => JsonValue.Create(Math.Round(random.NextDouble() * 100, 2)),
            2 => JsonValue.Create(random.Next(0, 2) == 0),
            3 => JsonValue.Create($"text {random.Next(0, 10)}"),
            4 => null,
            _ => JsonValue.Create(random.Next(0, 2) == 0 ? "active" : "blocked"),
        };
}
