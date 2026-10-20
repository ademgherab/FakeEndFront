using Microsoft.AspNetCore.Builder;

namespace MockApi.Core.Errors;

public static class ApplicationBuilderExtensions
{
    /// <summary>
    /// Adds the outermost correlation middleware. It must be registered before any middleware that
    /// can write an error. T03's request logging middleware belongs between this and
    /// <see cref="UseMockApiErrorHandling"/>.
    /// </summary>
    public static IApplicationBuilder UseMockApiRequestContext(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.UseMiddleware<RequestContextMiddleware>();
    }

    public static IApplicationBuilder UseMockApiErrorHandling(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.UseMiddleware<ErrorHandlingMiddleware>();
    }

    public static IApplicationBuilder UseMockApiManagementTransport(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.UseMiddleware<ManagementTransportMiddleware>();
    }
}
