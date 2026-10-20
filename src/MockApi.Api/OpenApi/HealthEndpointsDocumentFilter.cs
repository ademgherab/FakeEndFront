using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MockApi.Api.OpenApi;

/// <summary>
/// Adds the health probes to the management contract. They are mapped with
/// <c>MapHealthChecks</c> and therefore carry no MVC metadata for ApiExplorer to discover.
/// </summary>
internal sealed class HealthEndpointsDocumentFilter : IDocumentFilter
{
    private const string HealthReportSchemaId = "HealthReport";

    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(swaggerDoc);

        AddHealthReportSchema(swaggerDoc);

        AddProbe(
            swaggerDoc,
            "/health/live",
            "Liveness probe",
            "Returns 200 while the process is running. Requires no database.",
            includeUnavailable: false
        );

        AddProbe(
            swaggerDoc,
            "/health/ready",
            "Readiness probe",
            "Returns 200 when PostgreSQL is reachable and 503 otherwise.",
            includeUnavailable: true
        );
    }

    private static void AddProbe(
        OpenApiDocument swaggerDoc,
        string path,
        string summary,
        string description,
        bool includeUnavailable
    )
    {
        if (swaggerDoc.Paths.ContainsKey(path))
        {
            return;
        }

        var responses = new OpenApiResponses
        {
            ["200"] = new OpenApiResponse
            {
                Description = "Healthy.",
                Content = { ["application/json"] = CreateJsonContent() },
            },
        };

        if (includeUnavailable)
        {
            responses["503"] = new OpenApiResponse
            {
                Description = "Unhealthy.",
                Content = { ["application/json"] = CreateJsonContent() },
            };
        }

        swaggerDoc.Paths.Add(
            path,
            new OpenApiPathItem
            {
                Operations =
                {
                    [OperationType.Get] = new OpenApiOperation
                    {
                        Tags = [new OpenApiTag { Name = "Health" }],
                        Summary = summary,
                        Description = description,
                        Responses = responses,
                    },
                },
            }
        );
    }

    private static OpenApiMediaType CreateJsonContent() =>
        new()
        {
            Schema = new OpenApiSchema
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.Schema,
                    Id = HealthReportSchemaId,
                },
            },
        };

    private static void AddHealthReportSchema(OpenApiDocument swaggerDoc)
    {
        swaggerDoc.Components ??= new OpenApiComponents();
        swaggerDoc.Components.Schemas ??= new Dictionary<string, OpenApiSchema>(
            StringComparer.Ordinal
        );

        swaggerDoc.Components.Schemas[HealthReportSchemaId] = new OpenApiSchema
        {
            Type = "object",
            Description = "Aggregated health report.",
            Required = new HashSet<string>(StringComparer.Ordinal) { "status", "checks" },
            Properties = new Dictionary<string, OpenApiSchema>(StringComparer.Ordinal)
            {
                ["status"] = new OpenApiSchema
                {
                    Type = "string",
                    Enum =
                    [
                        new OpenApiString("Healthy"),
                        new OpenApiString("Degraded"),
                        new OpenApiString("Unhealthy"),
                    ],
                },
                ["checks"] = new OpenApiSchema
                {
                    Type = "array",
                    Items = new OpenApiSchema
                    {
                        Type = "object",
                        Required = new HashSet<string>(StringComparer.Ordinal) { "name", "status" },
                        Properties = new Dictionary<string, OpenApiSchema>(StringComparer.Ordinal)
                        {
                            ["name"] = new OpenApiSchema { Type = "string" },
                            ["status"] = new OpenApiSchema { Type = "string" },
                        },
                    },
                },
            },
        };
    }
}
