namespace MockApi.Data.Entities;

public sealed class ProjectUsageDaily
{
    public Guid ProjectId { get; set; }

    public DateOnly Day { get; set; }

    public int RequestCount { get; set; }

    public Project Project { get; set; } = null!;
}
