using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MockApi.Data.Configuration;
using Npgsql;

namespace MockApi.Api.Observability;

public sealed class PostgresReadinessHealthCheck(
    IOptions<DatabaseOptions> databaseOptions,
    IOptions<HealthProbeOptions> probeOptions
) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    )
    {
        var connectionString = databaseOptions.Value.Default;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return HealthCheckResult.Unhealthy("PostgreSQL is not configured.");
        }

        var timeoutSeconds = Math.Max(1, probeOptions.Value.TimeoutSeconds);

        try
        {
            var connectionStringBuilder = new NpgsqlConnectionStringBuilder(connectionString)
            {
                Timeout = timeoutSeconds,
                CommandTimeout = timeoutSeconds,
            };

            await using var connection = new NpgsqlConnection(
                connectionStringBuilder.ConnectionString
            );
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

            await using var command = new NpgsqlCommand("SELECT 1", connection)
            {
                CommandTimeout = timeoutSeconds,
            };

            var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);

            return Convert.ToInt32(result, System.Globalization.CultureInfo.InvariantCulture) == 1
                ? HealthCheckResult.Healthy("PostgreSQL is reachable.")
                : HealthCheckResult.Unhealthy(
                    "PostgreSQL readiness query returned an unexpected result."
                );
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL readiness check was cancelled.");
        }
        catch (Exception)
        {
            // Deliberately omit exception details and the connection string: probes are public.
            return HealthCheckResult.Unhealthy("PostgreSQL is not reachable.");
        }
    }
}
