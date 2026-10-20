namespace MockApi.Core.Schemas;

public sealed record SchemaValidationError(string Path, string Message);

public sealed class SchemaValidationResult
{
    public SchemaValidationResult(IReadOnlyList<SchemaValidationError> errors)
    {
        Errors = errors;
    }

    public IReadOnlyList<SchemaValidationError> Errors { get; }

    public bool IsValid => Errors.Count == 0;

    public static SchemaValidationResult Success { get; } = new([]);

    public IReadOnlyDictionary<string, string[]> ToErrorDictionary() =>
        Errors
            .GroupBy(error => error.Path, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Message).ToArray(),
                StringComparer.Ordinal
            );
}
