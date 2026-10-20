using Serilog;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace MockApi.Api.Observability;

public static class LoggingExtensions
{
    public static WebApplicationBuilder AddMockApiLogging(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.Host.UseSerilog(
            (context, services, loggerConfiguration) =>
            {
                loggerConfiguration
                    .MinimumLevel.Is(
                        context.HostingEnvironment.IsDevelopment()
                            ? LogEventLevel.Debug
                            : LogEventLevel.Information
                    )
                    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
                    .MinimumLevel.Override("System", LogEventLevel.Warning)
                    .Enrich.FromLogContext()
                    .Enrich.With<RequestCorrelationEnricher>()
                    .Enrich.With<SensitiveDataEnricher>()
                    .Destructure.With<SensitiveDataDestructuringPolicy>();

                if (context.HostingEnvironment.IsDevelopment())
                {
                    loggerConfiguration.WriteTo.Console(
                        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
                    );
                }
                else
                {
                    loggerConfiguration.WriteTo.Console(new CompactJsonFormatter());
                }

                foreach (var sink in services.GetServices<ILogEventSink>())
                {
                    loggerConfiguration.WriteTo.Sink(sink);
                }
            },
            preserveStaticLogger: true
        );

        return builder;
    }
}
