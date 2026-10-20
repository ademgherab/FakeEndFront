using System.Text.Json;
using System.Text.Json.Serialization;
using MockApi.Core.Serialization;

namespace MockApi.UnitTests.Serialization;

public sealed class JsonDefaultsTests
{
    private static readonly JsonSerializerOptions Options = JsonDefaults.Create();

    [Fact]
    public void Property_names_are_camel_case()
    {
        var json = JsonSerializer.Serialize(new SampleDto { DisplayName = "Ada" }, Options);

        Assert.Equal("""{"displayName":"Ada"}""", json);
    }

    [Fact]
    public void Enum_values_are_written_as_strings()
    {
        var json = JsonSerializer.Serialize(new { method = SampleMethod.Get }, Options);

        Assert.Equal("""{"method":"Get"}""", json);
    }

    [Fact]
    public void Enum_strings_are_read_case_insensitively()
    {
        var dto = JsonSerializer.Deserialize<Envelope>("""{"method":"post"}""", Options);

        Assert.NotNull(dto);
        Assert.Equal(SampleMethod.Post, dto.Method);
    }

    [Fact]
    public void Numeric_enum_values_are_rejected()
    {
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<Envelope>("""{"method":1}""", Options)
        );
    }

    [Fact]
    public void Unknown_properties_are_rejected()
    {
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<SampleDto>("""{"displayName":"Ada","typo":true}""", Options)
        );
    }

    [Fact]
    public void Maximum_depth_is_bounded()
    {
        Assert.Equal(32, Options.MaxDepth);
        Assert.Equal(JsonUnmappedMemberHandling.Disallow, Options.UnmappedMemberHandling);
        Assert.Equal(JsonNamingPolicy.CamelCase, Options.PropertyNamingPolicy);
    }

    private sealed class SampleDto
    {
        public string DisplayName { get; init; } = string.Empty;
    }

    private sealed class Envelope
    {
        public SampleMethod Method { get; init; }
    }

    private enum SampleMethod
    {
        Get,
        Post,
    }
}
