using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MockApi.Api.OpenApi;

/// <summary>
/// Applies the Bearer edit token to project-scoped management operations. Creating a project
/// (<c>POST /api/v1/projects</c>) stays anonymous because that call returns the token.
/// </summary>
internal sealed class ProjectSecurityDocumentFilter : IDocumentFilter
{
    private const string SchemeId = "Bearer";

    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(swaggerDoc);

        foreach (var (path, pathItem) in swaggerDoc.Paths)
        {
            if (!IsProjectScoped(path))
            {
                continue;
            }

            foreach (var operation in pathItem.Operations.Values)
            {
                operation.Security ??= [];
                operation.Security.Add(
                    new OpenApiSecurityRequirement
                    {
                        [
                            new OpenApiSecurityScheme
                            {
                                Reference = new OpenApiReference
                                {
                                    Type = ReferenceType.SecurityScheme,
                                    Id = SchemeId,
                                },
                            }
                        ] = Array.Empty<string>(),
                    }
                );
            }
        }
    }

    private static bool IsProjectScoped(string path) =>
        path.StartsWith("/api/v1/projects/", StringComparison.OrdinalIgnoreCase);
}
