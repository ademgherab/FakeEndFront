using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MockApi.Api.OpenApi;

/// <summary>
/// Publishes the OpenAPI contract and Swagger UI. The mock runtime under <c>/m/{slug}</c> is
/// intentionally not part of the management document; it is described in the integration docs.
/// </summary>
public static class SwaggerExtensions
{
    public const string DocumentName = "v1";

    public const string RoutePrefix = "swagger";

    public static IServiceCollection AddMockApiSwagger(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(
                DocumentName,
                new OpenApiInfo
                {
                    Title = "MockAPI",
                    Version = DocumentName,
                    Description =
                        "Management API for creating and editing mock endpoints. "
                        + "Project-scoped routes use the edit token returned by "
                        + "POST /api/v1/projects.",
                }
            );

            options.AddSecurityDefinition(
                "Bearer",
                new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    In = ParameterLocation.Header,
                    Name = "Authorization",
                    Description = "Edit token in the form 'Bearer et_<token>'.",
                }
            );

            options.DocumentFilter<HealthEndpointsDocumentFilter>();
            options.DocumentFilter<ProjectSecurityDocumentFilter>();
            options.SupportNonNullableReferenceTypes();
            options.DescribeAllParametersInCamelCase();
        });

        return services;
    }

    public static IApplicationBuilder UseMockApiSwagger(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseSwagger(options =>
            options.RouteTemplate = $"{RoutePrefix}/{{documentName}}/swagger.json"
        );

        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = RoutePrefix;
            options.DocumentTitle = "MockAPI";
            options.SwaggerEndpoint($"/{RoutePrefix}/{DocumentName}/swagger.json", "MockAPI v1");
            options.DisplayRequestDuration();
        });

        return app;
    }
}
