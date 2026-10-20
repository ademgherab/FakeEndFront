using System.Text.Json;
using System.Text.Json.Serialization;
using MockApi.Core.Schemas;

namespace MockApi.Core.Serialization;

/// <summary>
/// Single source of truth for the JSON contract of the Management API and the mock runtime
/// (spec §3 and §11.3): camelCase names, string enums, a bounded depth, and strict rejection
/// of unknown members.
/// </summary>
public static class JsonDefaults
{
    public const int MaxDepth = 32;

    public static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Configure(options);
        return options;
    }

    public static void Configure(JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = true;
        options.MaxDepth = MaxDepth;
        options.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        options.NumberHandling = JsonNumberHandling.Strict;

        if (!options.Converters.Any(converter => converter is StrictStringEnumConverterFactory))
        {
            options.Converters.Insert(0, new StrictStringEnumConverterFactory());
        }

        if (!options.Converters.Any(converter => converter is SchemaNodeJsonConverter))
        {
            options.Converters.Add(new SchemaNodeJsonConverter());
        }
    }
}
