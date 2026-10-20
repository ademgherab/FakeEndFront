namespace MockApi.Core.Schemas;

public enum GeneratorParameterKind
{
    Integer,
    Number,
    Boolean,
    String,
    Enum,
    EnumValues,
    JsonValue,
}

public sealed record GeneratorParameter(
    string Name,
    GeneratorParameterKind Kind,
    bool Required = false,
    double? Minimum = null,
    double? Maximum = null,
    IReadOnlyList<string>? AllowedValues = null
);

public sealed record GeneratorDefinition(
    string Name,
    IReadOnlyList<SchemaNodeType> NodeTypes,
    IReadOnlyList<GeneratorParameter> Parameters
)
{
    public bool Supports(SchemaNodeType type) => NodeTypes.Contains(type);
}

/// <summary>
/// The core generator catalog used by schema validation, inference and generation. Generators
/// removed by the sprint override are deliberately absent, so they are rejected as unknown.
/// </summary>
public static class GeneratorCatalog
{
    private static readonly IReadOnlyList<GeneratorParameter> NoParameters = [];

    private static readonly IReadOnlyDictionary<string, GeneratorDefinition> ByName =
        BuildDefinitions().ToDictionary(definition => definition.Name, StringComparer.Ordinal);

    public static IReadOnlyList<GeneratorDefinition> Definitions { get; } = ByName.Values.ToArray();

    public static bool TryGet(string? name, out GeneratorDefinition definition)
    {
        if (name is not null && ByName.TryGetValue(name, out var found))
        {
            definition = found;
            return true;
        }

        definition = null!;
        return false;
    }

    public static GeneratorDefinition Get(string name) =>
        TryGet(name, out var definition)
            ? definition
            : throw new KeyNotFoundException($"Unknown generator '{name}'.");

    private static IEnumerable<GeneratorDefinition> BuildDefinitions()
    {
        yield return Generator(
            "autoId",
            [SchemaNodeType.Integer],
            new GeneratorParameter("start", GeneratorParameterKind.Integer)
        );

        yield return Generator(
            "randomInt",
            [SchemaNodeType.Integer],
            new GeneratorParameter("min", GeneratorParameterKind.Integer, Required: true),
            new GeneratorParameter("max", GeneratorParameterKind.Integer, Required: true)
        );

        yield return Generator(
            "randomDecimal",
            [SchemaNodeType.Number],
            new GeneratorParameter("min", GeneratorParameterKind.Number, Required: true),
            new GeneratorParameter("max", GeneratorParameterKind.Number, Required: true),
            new GeneratorParameter(
                "precision",
                GeneratorParameterKind.Integer,
                Minimum: 0,
                Maximum: 6
            )
        );

        yield return Generator(
            "price",
            [SchemaNodeType.Number, SchemaNodeType.String],
            new GeneratorParameter("min", GeneratorParameterKind.Number, Minimum: 0),
            new GeneratorParameter("max", GeneratorParameterKind.Number, Minimum: 0)
        );

        yield return Generator(
            "randomBool",
            [SchemaNodeType.Boolean],
            new GeneratorParameter(
                "trueProbability",
                GeneratorParameterKind.Number,
                Minimum: 0,
                Maximum: 1
            )
        );

        yield return Generator("nullValue", [SchemaNodeType.Null]);

        yield return Generator("uuid", [SchemaNodeType.String]);
        yield return Generator("email", [SchemaNodeType.String]);
        yield return Generator("fullName", [SchemaNodeType.String]);
        yield return Generator("firstName", [SchemaNodeType.String]);
        yield return Generator("lastName", [SchemaNodeType.String]);
        yield return Generator("username", [SchemaNodeType.String]);
        yield return Generator("phone", [SchemaNodeType.String]);
        yield return Generator("city", [SchemaNodeType.String]);
        yield return Generator("country", [SchemaNodeType.String]);
        yield return Generator("company", [SchemaNodeType.String]);
        yield return Generator("url", [SchemaNodeType.String]);

        yield return Generator(
            "words",
            [SchemaNodeType.String],
            new GeneratorParameter("min", GeneratorParameterKind.Integer, Minimum: 1),
            new GeneratorParameter("max", GeneratorParameterKind.Integer, Minimum: 1)
        );

        yield return Generator(
            "sentence",
            [SchemaNodeType.String],
            new GeneratorParameter("minWords", GeneratorParameterKind.Integer, Minimum: 1),
            new GeneratorParameter("maxWords", GeneratorParameterKind.Integer, Minimum: 1)
        );

        yield return Generator(
            "paragraph",
            [SchemaNodeType.String],
            new GeneratorParameter("sentences", GeneratorParameterKind.Integer, Minimum: 1)
        );

        yield return Generator(
            "dateTime",
            [SchemaNodeType.String],
            new GeneratorParameter(
                "kind",
                GeneratorParameterKind.Enum,
                AllowedValues: ["past", "future", "recent"]
            ),
            new GeneratorParameter("rangeDays", GeneratorParameterKind.Integer, Minimum: 0),
            new GeneratorParameter(
                "format",
                GeneratorParameterKind.Enum,
                AllowedValues: ["iso-datetime", "iso-datetime-ms"]
            )
        );

        yield return Generator(
            "date",
            [SchemaNodeType.String],
            new GeneratorParameter(
                "kind",
                GeneratorParameterKind.Enum,
                AllowedValues: ["past", "future", "recent"]
            ),
            new GeneratorParameter("rangeDays", GeneratorParameterKind.Integer, Minimum: 0),
            new GeneratorParameter("minDaysAgo", GeneratorParameterKind.Integer, Minimum: 0)
        );

        yield return Generator(
            "enum",
            [SchemaNodeType.String, SchemaNodeType.Integer],
            new GeneratorParameter("values", GeneratorParameterKind.EnumValues, Required: true)
        );

        yield return Generator(
            "constant",
            [
                SchemaNodeType.String,
                SchemaNodeType.Integer,
                SchemaNodeType.Number,
                SchemaNodeType.Boolean,
                SchemaNodeType.Null,
            ],
            new GeneratorParameter("value", GeneratorParameterKind.JsonValue, Required: true)
        );
    }

    private static GeneratorDefinition Generator(
        string name,
        IReadOnlyList<SchemaNodeType> nodeTypes,
        params GeneratorParameter[] parameters
    ) => new(name, nodeTypes, parameters.Length == 0 ? NoParameters : parameters);
}
