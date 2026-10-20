using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MockApi.Core.Configuration;

namespace MockApi.Core.Errors;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the error catalog contract: options, ProblemDetails/runtime factories, and the
    /// MVC invalid-model-state response. Does not add any endpoint or middleware to the pipeline.
    /// </summary>
    public static IServiceCollection AddMockApiErrors(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services
            .AddOptions<ErrorsOptions>()
            .Bind(configuration.GetSection(ErrorsOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.TryAddSingleton<ManagementProblemDetailsFactory>();
        services.TryAddSingleton<RuntimeErrorFactory>();

        services.PostConfigure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = actionContext =>
                actionContext
                    .HttpContext.RequestServices.GetRequiredService<ManagementProblemDetailsFactory>()
                    .ModelStateResult(actionContext);

            // Status-only results must reach ErrorHandlingMiddleware so every 4xx/5xx uses the
            // single ProblemDetails contract instead of MVC's generic client-error mapping.
            options.SuppressMapClientErrors = true;
        });

        return services;
    }
}
