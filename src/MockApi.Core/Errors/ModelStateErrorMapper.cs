using System.Text.Json;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace MockApi.Core.Errors;

/// <summary>
/// Maps MVC model-state entries to safe, dotted body paths and generic messages. The raw
/// model-state messages are never returned because they include C# type names and binder
/// internals.
/// </summary>
public static class ModelStateErrorMapper
{
    public static Dictionary<string, string[]> Map(ModelStateDictionary modelState)
    {
        ArgumentNullException.ThrowIfNull(modelState);

        var result = new Dictionary<string, string[]>(StringComparer.Ordinal);

        foreach (var entry in modelState)
        {
            var path = ErrorPaths.Normalize(entry.Key);
            var messages = new List<string>();

            foreach (var error in entry.Value.Errors)
            {
                if (
                    error.Exception is JsonException { Path: not null } jsonException
                    && !string.IsNullOrEmpty(jsonException.Path)
                )
                {
                    path = ErrorPaths.Normalize(jsonException.Path);
                }

                messages.Add(Sanitize(error.ErrorMessage, error.Exception));
            }

            if (messages.Count == 0)
            {
                continue;
            }

            var distinct = messages.Distinct(StringComparer.Ordinal).ToArray();

            result[path] = result.TryGetValue(path, out var existing)
                ? existing.Concat(distinct).Distinct(StringComparer.Ordinal).ToArray()
                : distinct;
        }

        return result;
    }

    private static string Sanitize(string? message, Exception? exception)
    {
        if (
            exception is JsonException jsonException
            && jsonException.Message.Contains("could not be mapped", StringComparison.Ordinal)
        )
        {
            return "Unknown property.";
        }

        if (message is null)
        {
            return "The value is invalid.";
        }

        if (message.Contains("could not be mapped", StringComparison.Ordinal))
        {
            return "Unknown property.";
        }

        if (
            message.Contains("required", StringComparison.OrdinalIgnoreCase)
            && !message.Contains("System.", StringComparison.Ordinal)
        )
        {
            return "The value is required.";
        }

        return "The value is invalid.";
    }
}
