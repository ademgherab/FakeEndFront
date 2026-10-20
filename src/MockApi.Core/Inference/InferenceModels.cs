using MockApi.Core.Configuration;
using MockApi.Core.Schemas;

namespace MockApi.Core.Inference;

public sealed record InferenceWarning(string Code, string Path, string Message);

public static class InferenceWarningCodes
{
    public const string MixedTypes = "mixed_types";
    public const string EmptyArray = "empty_array";
    public const string NullTypeUnknown = "null_type_unknown";
    public const string EnumFromSample = "enum_from_sample";
}

public sealed class InferenceSuggestions
{
    public ListSuggestion? List { get; init; }

    public PaginationSuggestion? Pagination { get; init; }
}

public sealed class ListSuggestion
{
    public string? Path { get; init; }
}

public sealed class PaginationSuggestion
{
    public PaginationBindings Bindings { get; init; } = new();
}

public sealed class PaginationBindings
{
    public string? Page { get; init; }

    public string? Limit { get; init; }

    public string? Total { get; init; }

    public string? TotalPages { get; init; }

    public string? HasNext { get; init; }

    public string? HasPrev { get; init; }
}

public sealed class InferenceResult
{
    public required Schema Schema { get; init; }

    public IReadOnlyList<InferenceWarning> Warnings { get; init; } = [];

    public InferenceSuggestions Suggestions { get; init; } = new();
}

public sealed class InferenceOptions
{
    public bool WrapInList { get; init; }

    public string? EndpointPath { get; init; }

    public InferenceLimits Limits { get; init; } = InferenceLimits.Default;
}

/// <summary>
/// Sample limits from spec §6.1. <see cref="From"/> keeps inference aligned with the configured
/// schema and body limits; the defaults match the shipped configuration.
/// </summary>
public sealed record InferenceLimits(
    int MaxSampleBytes = 102_400,
    int MaxDepth = 10,
    int MaxFieldsPerObject = 100,
    int MaxNodes = 2_000
)
{
    public static InferenceLimits Default { get; } = new();

    public static InferenceLimits From(LimitsOptions limits)
    {
        ArgumentNullException.ThrowIfNull(limits);

        return new InferenceLimits(
            limits.MaxSampleBytes,
            limits.MaxSchemaDepth,
            limits.MaxFieldsPerObject,
            limits.MaxSchemaNodes
        );
    }
}

public sealed class SampleInferenceException : Exception
{
    public SampleInferenceException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }

    public static SampleInferenceException Invalid(string message) =>
        new("sample_invalid", message);

    public static SampleInferenceException TooComplex(string message) =>
        new("sample_too_complex", message);
}
