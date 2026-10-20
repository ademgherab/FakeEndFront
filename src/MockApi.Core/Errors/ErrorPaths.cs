namespace MockApi.Core.Errors;

/// <summary>
/// Converts System.Text.Json / MVC model-state paths into the dotted/indexed body paths used by
/// the Management API error contract (for example <c>endpoints[0].settings.delay.maxMs</c>).
/// Never surfaces C# type names or a raw model-state dump.
/// </summary>
public static class ErrorPaths
{
    public const string Root = "$";

    public static string Normalize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return Root;
        }

        var normalized = path.Trim();

        if (normalized == Root)
        {
            return Root;
        }

        if (normalized.StartsWith("$.", StringComparison.Ordinal))
        {
            normalized = normalized[2..];
        }
        else if (normalized.StartsWith("$[", StringComparison.Ordinal))
        {
            normalized = normalized[1..];
        }
        else if (normalized.StartsWith('$'))
        {
            normalized = normalized[1..];
        }

        if (normalized.StartsWith('/'))
        {
            normalized = normalized.TrimStart('/').Replace('/', '.');
        }

        return string.IsNullOrEmpty(normalized) ? Root : normalized;
    }
}
