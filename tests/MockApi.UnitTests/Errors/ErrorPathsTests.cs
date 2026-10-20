using Microsoft.AspNetCore.Mvc.ModelBinding;
using MockApi.Core.Errors;

namespace MockApi.UnitTests.Errors;

public sealed class ErrorPathsTests
{
    [Theory]
    [InlineData("$.foo", "foo")]
    [InlineData("foo", "foo")]
    [InlineData("$.endpoints[0].settings.delay.maxMs", "endpoints[0].settings.delay.maxMs")]
    [InlineData("$[0].name", "[0].name")]
    [InlineData("$", "$")]
    [InlineData("", "$")]
    [InlineData(null, "$")]
    [InlineData("/endpoints/0/name", "endpoints.0.name")]
    public void Normalize_produces_dotted_body_paths(string? input, string expected)
    {
        Assert.Equal(expected, ErrorPaths.Normalize(input));
    }

    [Fact]
    public void Model_state_unknown_property_is_safe_and_uses_dotted_path()
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(
            "$.endpoints[0].settings.delay.maxMs",
            "The JSON property 'maxMs' could not be mapped to any .NET member contained in type 'Demo.DelaySettings'."
        );

        var errors = ModelStateErrorMapper.Map(modelState);

        var pair = Assert.Single(errors);
        Assert.Equal("endpoints[0].settings.delay.maxMs", pair.Key);
        Assert.Equal(new[] { "Unknown property." }, pair.Value);
        Assert.DoesNotContain(
            errors.Values.SelectMany(value => value),
            message => message.Contains("Demo.", StringComparison.Ordinal)
        );
    }

    [Fact]
    public void Model_state_messages_do_not_leak_csharp_type_names()
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(
            "endpoints[0].settings.delay.maxMs",
            "The JSON value could not be converted to System.Int32."
        );

        var errors = ModelStateErrorMapper.Map(modelState);

        var pair = Assert.Single(errors);
        Assert.Equal("endpoints[0].settings.delay.maxMs", pair.Key);
        Assert.Equal(new[] { "The value is invalid." }, pair.Value);
    }
}
