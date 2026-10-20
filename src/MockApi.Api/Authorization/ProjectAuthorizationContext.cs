using Microsoft.AspNetCore.Http;
using MockApi.Data.Entities;

namespace MockApi.Api.Authorization;

/// <summary>
/// Exposes the project loaded and validated by <see cref="ProjectEditTokenAuthorizationFilter"/> so
/// later filters and controllers do not have to query it again for the same request.
/// </summary>
public static class ProjectAuthorizationContext
{
    private const string ItemKey = "MockApi.AuthorizedProject";

    public static Project? GetProject(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return context.Items.TryGetValue(ItemKey, out var value) ? value as Project : null;
    }

    public static Project GetRequiredProject(HttpContext context) =>
        GetProject(context)
        ?? throw new InvalidOperationException(
            "No authorized project is available. Apply RequireProjectEditToken to the controller "
                + "or action."
        );

    internal static void SetProject(HttpContext context, Project project)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(project);

        context.Items[ItemKey] = project;
    }
}
