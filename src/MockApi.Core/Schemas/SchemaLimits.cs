using MockApi.Core.Configuration;

namespace MockApi.Core.Schemas;

/// <summary>
/// Structural limits from spec §6.1 and §10.4. The defaults match the shipped configuration;
/// hosts should use <see cref="From"/> so the validator and the rest of the API stay aligned.
/// </summary>
public sealed record SchemaLimits(
    int MaxNodes = 2_000,
    int MaxDepth = 10,
    int MaxFieldsPerObject = 100,
    int MaxFieldNameLength = 100,
    int MaxEnumValues = 50
)
{
    public static SchemaLimits Default { get; } = new();

    public static SchemaLimits From(LimitsOptions limits)
    {
        ArgumentNullException.ThrowIfNull(limits);

        return new SchemaLimits(
            limits.MaxSchemaNodes,
            limits.MaxSchemaDepth,
            limits.MaxFieldsPerObject,
            limits.MaxFieldNameLength,
            limits.MaxEnumValues
        );
    }
}
