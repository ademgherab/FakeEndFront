namespace MockApi.Data.Entities;

public sealed class RequestLog
{
    public long Id { get; set; }

    public Guid ProjectId { get; set; }

    public Guid? EndpointId { get; set; }

    public Guid RequestId { get; set; }

    public string Method { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;

    public string? Query { get; set; }

    public short Status { get; set; }

    public bool InjectedError { get; set; }

    public int DelayMs { get; set; }

    public int LatencyMs { get; set; }

    public string? RequestContentType { get; set; }

    public string? RequestBody { get; set; }

    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public Project Project { get; set; } = null!;

    public Endpoint? Endpoint { get; set; }
}
