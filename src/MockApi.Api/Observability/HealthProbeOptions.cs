namespace MockApi.Api.Observability;

public sealed class HealthProbeOptions
{
    public const string SectionName = "MockApi:Health";

    public int TimeoutSeconds { get; init; } = 2;
}
