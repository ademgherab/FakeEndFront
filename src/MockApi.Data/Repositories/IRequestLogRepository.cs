using MockApi.Data.Entities;

namespace MockApi.Data.Repositories;

public interface IRequestLogRepository
{
    Task<IReadOnlyList<RequestLog>> ListLogsAsync(
        Guid projectId,
        int limit,
        long? beforeId,
        CancellationToken cancellationToken = default
    );
}
