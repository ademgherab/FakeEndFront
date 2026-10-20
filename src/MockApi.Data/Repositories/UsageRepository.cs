using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using NpgsqlTypes;

namespace MockApi.Data.Repositories;

public sealed class UsageRepository : IUsageRepository
{
    private const string UpsertSql = """
        INSERT INTO project_usage_daily (project_id, day, request_count)
        VALUES (@project_id, @day, @delta)
        ON CONFLICT (project_id, day) DO UPDATE
        SET request_count = project_usage_daily.request_count + @delta
        RETURNING request_count
        """;

    private readonly MockApiDbContext _context;

    public UsageRepository(MockApiDbContext context)
    {
        _context = context;
    }

    public async Task<int> IncrementDailyAsync(
        Guid projectId,
        DateOnly day,
        int delta,
        CancellationToken cancellationToken = default
    )
    {
        var connection = _context.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;

        if (openedHere)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = _context.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = UpsertSql;
            command.Parameters.Add(
                new NpgsqlParameter("project_id", NpgsqlDbType.Uuid) { Value = projectId }
            );
            command.Parameters.Add(new NpgsqlParameter("day", NpgsqlDbType.Date) { Value = day });
            command.Parameters.Add(
                new NpgsqlParameter("delta", NpgsqlDbType.Integer) { Value = delta }
            );

            var result = await command.ExecuteScalarAsync(cancellationToken);

            return Convert.ToInt32(result, CultureInfo.InvariantCulture);
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
        }
    }
}
