using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MockApi.Core.Security;

namespace MockApi.Api.Authorization;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers edit-token generation/verification and the project authorization filter used by
    /// <see cref="RequireProjectEditTokenAttribute"/>. Project repositories come from
    /// <c>AddMockApiData</c>.
    /// </summary>
    public static IServiceCollection AddMockApiProjectAuthorization(
        this IServiceCollection services
    )
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddSingleton<EditTokenService>();
        services.TryAddTransient<ProjectEditTokenAuthorizationFilter>();

        return services;
    }
}
