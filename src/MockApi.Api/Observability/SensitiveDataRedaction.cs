using Microsoft.AspNetCore.Http;
using Serilog.Core;
using Serilog.Events;

namespace MockApi.Api.Observability;

internal static class SensitiveDataRedaction
{
    public const string Redacted = "[REDACTED]";

    public static bool IsSensitive(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        var normalized = name.Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        return normalized.Contains("authorization", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("password", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("secret", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("token", StringComparison.OrdinalIgnoreCase)
            || normalized.EndsWith("token", StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Prevents header values from being written to logs. Header values are never useful in
/// structured logs and may contain credentials, so every value is replaced with a marker.
/// </summary>
public sealed class SensitiveDataDestructuringPolicy : IDestructuringPolicy
{
    public bool TryDestructure(
        object value,
        ILogEventPropertyValueFactory propertyValueFactory,
        out LogEventPropertyValue result
    )
    {
        if (value is not IHeaderDictionary headers)
        {
            result = null!;
            return false;
        }

        var entries = headers.Select(header =>
            (LogEventPropertyValue)
                new StructureValue([
                    new LogEventProperty("Name", new ScalarValue(header.Key)),
                    new LogEventProperty("Value", new ScalarValue(SensitiveDataRedaction.Redacted)),
                ])
        );

        result = new SequenceValue(entries);
        return true;
    }
}

/// <summary>
/// Recursively replaces property values whose name looks like a credential. This covers
/// structured objects such as <c>{@Request}</c> as well as direct template properties such
/// as <c>{EditToken}</c>.
/// </summary>
public sealed class SensitiveDataEnricher : ILogEventEnricher
{
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        ArgumentNullException.ThrowIfNull(logEvent);

        foreach (var property in logEvent.Properties.ToArray())
        {
            logEvent.AddOrUpdateProperty(
                new LogEventProperty(property.Key, Redact(property.Key, property.Value))
            );
        }
    }

    private static LogEventPropertyValue Redact(string name, LogEventPropertyValue value)
    {
        if (SensitiveDataRedaction.IsSensitive(name))
        {
            return new ScalarValue(SensitiveDataRedaction.Redacted);
        }

        return value switch
        {
            StructureValue structure => new StructureValue(
                structure
                    .Properties.Select(property => new LogEventProperty(
                        property.Name,
                        Redact(property.Name, property.Value)
                    ))
                    .ToArray(),
                structure.TypeTag
            ),
            SequenceValue sequence => new SequenceValue(
                sequence.Elements.Select(element => Redact(string.Empty, element))
            ),
            DictionaryValue dictionary => new DictionaryValue(
                dictionary.Elements.Select(element => new KeyValuePair<
                    ScalarValue,
                    LogEventPropertyValue
                >(
                    element.Key,
                    Redact(element.Key.Value?.ToString() ?? string.Empty, element.Value)
                ))
            ),
            _ => value,
        };
    }
}
