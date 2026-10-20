namespace MockApi.Data.Entities;

public sealed class Project
{
    public Guid Id { get; set; }

    public string Slug { get; set; } = string.Empty;

    public string? Name { get; set; }

    public byte[] EditTokenHash { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? LastRequestAt { get; set; }

    public ICollection<Endpoint> Endpoints { get; } = [];

    public ICollection<RequestLog> RequestLogs { get; } = [];

    public ICollection<ProjectUsageDaily> UsageDaily { get; } = [];
}
