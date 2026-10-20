using System.Text.Json;
using MockApi.Core.Configuration;
using MockApi.Core.Schemas;
using MockApi.Core.Serialization;
using MockApi.Core.Settings;

namespace MockApi.UnitTests.Settings;

internal static class SettingsTestSupport
{
    private static readonly JsonSerializerOptions Json = JsonDefaults.Create();

    public static MockApiOptions Options(int maxGeneratedValues = 100_000) =>
        new()
        {
            Limits = new LimitsOptions
            {
                MaxDelayMs = 10_000,
                MaxListSize = 1_000,
                MaxPaginationTotalItems = 10_000,
                MaxPaginationLimit = 100,
                MaxErrorStatusCodes = 10,
                MaxGeneratedValuesPerResponse = maxGeneratedValues,
            },
        };

    public static Schema RootArrayListSchema() =>
        Schema(
            """
            {"version":1,"root":{"type":"array","item":{"type":"object","fields":[
              {"name":"id","node":{"type":"integer","generator":{"name":"autoId","params":{"start":1}}}},
              {"name":"name","node":{"type":"string","generator":{"name":"fullName"}}}
            ]}}}
            """
        );

    public static Schema ObjectWithDataAndMetaSchema() =>
        Schema(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"data","node":{"type":"array","item":{"type":"object","fields":[
                {"name":"id","node":{"type":"integer","generator":{"name":"autoId"}}}
              ]}}},
              {"name":"meta","node":{"type":"object","fields":[
                {"name":"page","node":{"type":"integer","generator":{"name":"randomInt","params":{"min":1,"max":5}}}},
                {"name":"limit","node":{"type":"integer","generator":{"name":"randomInt","params":{"min":1,"max":5}}}},
                {"name":"total","node":{"type":"integer","generator":{"name":"randomInt","params":{"min":1,"max":5}}}},
                {"name":"totalPages","node":{"type":"integer","generator":{"name":"randomInt","params":{"min":1,"max":5}}}},
                {"name":"hasNext","node":{"type":"boolean","generator":{"name":"randomBool"}}},
                {"name":"hasPrev","node":{"type":"boolean","generator":{"name":"randomBool"}}}
              ]}}
            ]}}
            """
        );

    public static Schema ObjectWithoutDataSchema() =>
        Schema(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"items","node":{"type":"array","item":{"type":"integer","generator":{"name":"randomInt"}}}}
            ]}}
            """
        );

    public static Schema Schema(string json) =>
        JsonSerializer.Deserialize<Schema>(json, Json)
        ?? throw new InvalidOperationException("The test schema is invalid.");

    public static EndpointSettings? Settings(string json) =>
        JsonSerializer.Deserialize<EndpointSettings>(json, Json);

    public static ResolvedEndpointSettings Resolve(
        string settingsJson,
        string method,
        Schema schema,
        int maxValues = 100_000,
        MockApiOptions? options = null
    ) =>
        EndpointSettingsService.ResolveAndValidate(
            Settings(settingsJson),
            method,
            schema,
            options ?? Options(),
            maxValues
        );
}
