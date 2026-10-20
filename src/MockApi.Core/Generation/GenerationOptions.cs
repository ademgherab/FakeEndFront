namespace MockApi.Core.Generation;

/// <summary>
/// Runtime knobs passed to <see cref="JsonGenerator"/>. List sizes are optional: when they are
/// absent the schema node's own <c>length</c> is used. <see cref="ListIndexOffset"/> lets the
/// caller continue autoId numbering across pagination pages.
/// </summary>
public sealed record GenerationOptions
{
    public int? ListMin { get; init; }

    public int? ListMax { get; init; }

    /// <summary>Zero-based list index of the first generated item (pagination offset).</summary>
    public int ListIndexOffset { get; init; }

    public int MaxValues { get; init; } = 100_000;

    public DateTimeOffset? ReferenceTime { get; init; }
}

public sealed class ResponseTooLargeException : Exception
{
    public ResponseTooLargeException(int maxValues)
        : base($"Generation exceeded the {maxValues} generated-value limit.")
    {
        MaxValues = maxValues;
    }

    public int MaxValues { get; }
}
