namespace MockApi.Data.Repositories;

public interface IUsageRepository
{
    Task<int> IncrementDailyAsync(
        Guid projectId,
        DateOnly day,
        int delta,
        CancellationToken cancellationToken = default
    );
}
