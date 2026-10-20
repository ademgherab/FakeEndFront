using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MockApi.Core.Configuration;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Binds <see cref="MockApiOptions"/> from the <c>MockApi</c> configuration section and
    /// fails the host at startup when a required value is missing or invalid.
    /// </summary>
    public static IServiceCollection AddMockApiOptions(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services
            .AddOptions<MockApiOptions>()
            .Bind(configuration.GetSection(MockApiOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        return services;
    }
}
