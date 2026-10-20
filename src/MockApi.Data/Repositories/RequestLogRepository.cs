using Microsoft.EntityFrameworkCore;
using MockApi.Data.Entities;

namespace MockApi.Data.Repositories;

public sealed class RequestLogRepository : IRequestLogRepository
{
    private readonly MockApiDbContext _context;

    public RequestLogRepository(MockApiDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<RequestLog>> ListLogsAsync(
        Guid projectId,
        int limit,
        long? beforeId,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(limit);

        var query = _context.RequestLogs.AsNoTracking().Where(log => log.ProjectId == projectId);

        if (beforeId.HasValue)
        {
            var cursor = beforeId.Value;
            query = query.Where(log => log.Id < cursor);
        }

        return await query
            .OrderByDescending(log => log.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }
}
