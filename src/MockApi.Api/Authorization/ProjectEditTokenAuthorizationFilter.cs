using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;
using MockApi.Core.Errors;
using MockApi.Core.Security;
using MockApi.Data.Repositories;

namespace MockApi.Api.Authorization;

/// <summary>
/// Marks a project-scoped management controller or action. The route must contain a
/// <c>{slug}</c> value. The filter runs the checks in the documented order:
/// project exists (404) -> Bearer header present (401) -> token matches (403) -> not expired (410).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireProjectEditTokenAttribute : Attribute, IFilterFactory
{
    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider)
    {
        ArgumentNullException.ThrowIfNull(serviceProvider);

        return serviceProvider.GetRequiredService<ProjectEditTokenAuthorizationFilter>();
    }
}

/// <summary>
/// Shared authorization filter for project-scoped management routes. On success the loaded
/// <c>Project</c> is available through <see cref="ProjectAuthorizationContext"/>. The filter never
/// logs the token, the header, or the stored hash.
/// </summary>
public sealed class ProjectEditTokenAuthorizationFilter : IAsyncAuthorizationFilter
{
    private readonly IProjectRepository _projects;
    private readonly EditTokenService _tokens;

    public ProjectEditTokenAuthorizationFilter(IProjectRepository projects, EditTokenService tokens)
    {
        _projects = projects;
        _tokens = tokens;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var httpContext = context.HttpContext;
        var slug = ReadSlug(context);

        if (slug is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, ErrorCodes.ProjectNotFound);
        }

        var project = await _projects.FindBySlugAsync(slug, httpContext.RequestAborted);
        if (project is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, ErrorCodes.ProjectNotFound);
        }

        var token = ReadBearerToken(httpContext.Request);
        if (token is null)
        {
            throw new ApiException(StatusCodes.Status401Unauthorized, ErrorCodes.MissingToken);
        }

        if (!_tokens.Verify(token, project.EditTokenHash))
        {
            throw new ApiException(StatusCodes.Status403Forbidden, ErrorCodes.InvalidToken);
        }

        if (DateTimeOffset.UtcNow > project.ExpiresAt)
        {
            throw new ApiException(StatusCodes.Status410Gone, ErrorCodes.ProjectExpired);
        }

        ProjectAuthorizationContext.SetProject(httpContext, project);
    }

    private static string? ReadSlug(AuthorizationFilterContext context)
    {
        var value = context.RouteData.Values["slug"];

        return value is string slug && !string.IsNullOrWhiteSpace(slug) ? slug : null;
    }

    private static string? ReadBearerToken(HttpRequest request)
    {
        if (
            !request.Headers.TryGetValue(HeaderNames.Authorization, out var values)
            || values.Count != 1
        )
        {
            return null;
        }

        var header = values[0];
        if (
            string.IsNullOrWhiteSpace(header)
            || !AuthenticationHeaderValue.TryParse(header, out var parsed)
            || !string.Equals(parsed.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(parsed.Parameter)
        )
        {
            return null;
        }

        return parsed.Parameter;
    }
}
