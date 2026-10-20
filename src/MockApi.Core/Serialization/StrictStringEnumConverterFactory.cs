using System.Text.Json;
using System.Text.Json.Serialization;

namespace MockApi.Core.Serialization;

/// <summary>
/// Writes enums as their member name and only accepts string tokens on input. Numeric enum
/// values are rejected, which is the contract required by spec §3 ("enums are strings, never
/// numbers").
/// </summary>
public sealed class StrictStringEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(typeToConvert);

        var converterType = typeof(StrictStringEnumConverter<>).MakeGenericType(typeToConvert);
        return (JsonConverter)Activator.CreateInstance(converterType)!;
    }

    private sealed class StrictStringEnumConverter<TEnum> : JsonConverter<TEnum>
        where TEnum : struct, Enum
    {
        public override TEnum Read(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException(
                    $"Expected a string value for enum '{typeof(TEnum).Name}', "
                        + $"but found '{reader.TokenType}'."
                );
            }

            var value = reader.GetString();

            if (
                string.IsNullOrWhiteSpace(value)
                || int.TryParse(value, out _)
                || !Enum.TryParse<TEnum>(value, ignoreCase: true, out var parsed)
                || !Enum.IsDefined(parsed)
            )
            {
                throw new JsonException(
                    $"'{value}' is not a valid value for enum '{typeof(TEnum).Name}'."
                );
            }

            return parsed;
        }

        public override void Write(
            Utf8JsonWriter writer,
            TEnum value,
            JsonSerializerOptions options
        )
        {
            ArgumentNullException.ThrowIfNull(writer);

            if (!Enum.IsDefined(value))
            {
                throw new JsonException(
                    $"'{value}' is not a defined value for enum '{typeof(TEnum).Name}'."
                );
            }

            writer.WriteStringValue(value.ToString());
        }
    }
}
