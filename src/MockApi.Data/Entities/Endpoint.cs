namespace MockApi.Data.Entities;

public sealed class Endpoint
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public string Method { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;

    public string PathNormalized { get; set; } = string.Empty;

    public short SchemaVersion { get; set; }

    public string SchemaJson { get; set; } = string.Empty;

    public string SettingsJson { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public Project Project { get; set; } = null!;

    public ICollection<RequestLog> RequestLogs { get; } = [];
}
