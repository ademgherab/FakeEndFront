using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MockApi.Data;
using MockApi.Data.Entities;
using MockApi.Data.Repositories;
using Npgsql;

namespace MockApi.IntegrationTests;

public sealed class DatabaseTests : IClassFixture<PostgresFixture>
{
    private const string SchemaJson = """
        {
          "version": 1,
          "root": {
            "type": "object",
            "fields": [
              { "name": "alpha", "type": "integer", "min": 1, "max": 9007199254740993 },
              { "name": "beta", "type": "number", "min": -1.5, "max": 12345678901234567890.12 },
              { "name": "gamma", "type": "boolean", "nullable": true },
              { "name": "delta", "type": "string", "enum": ["x", "y", "z"] }
            ]
          }
        }
        """;

    private const string SettingsJson =
        """{ "status": 201, "delay": { "minMs": 0, "maxMs": 100 } }""";

    private readonly PostgresFixture _fixture;

    public DatabaseTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Migration_creates_expected_schema()
    {
        await using var connection = await OpenConnectionAsync();

        var tables = await QueryStringsAsync(
            connection,
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public' AND tablename <> '__EFMigrationsHistory'
            ORDER BY tablename
            """
        );

        Assert.Equal(4, tables.Count);
        Assert.Contains("endpoints", tables);
        Assert.Contains("project_usage_daily", tables);
        Assert.Contains("projects", tables);
        Assert.Contains("request_logs", tables);

        var indexes = await QueryStringsAsync(
            connection,
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY indexname
            """
        );

        Assert.Contains("ix_projects_expires_at", indexes);
        Assert.Contains("ix_request_logs_project_id_id", indexes);
        Assert.Contains("uq_endpoints_route", indexes);

        var requestLogIndex = await ScalarStringAsync(
            connection,
            """
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'ix_request_logs_project_id_id'
            """
        );

        Assert.Contains("id", requestLogIndex, StringComparison.Ordinal);
        Assert.Contains("DESC", requestLogIndex, StringComparison.OrdinalIgnoreCase);

        var columns = await QueryStringsAsync(
            connection,
            """
            SELECT table_name || '.' || column_name || '|' || udt_name || '|' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('projects', 'endpoints', 'request_logs', 'project_usage_daily')
            """
        );

        Assert.Contains("projects.id|uuid|NO", columns);
        Assert.Contains("projects.edit_token_hash|bytea|NO", columns);
        Assert.Contains("projects.expires_at|timestamptz|NO", columns);
        Assert.Contains("projects.created_at|timestamptz|NO", columns);
        Assert.Contains("endpoints.method|varchar|NO", columns);
        Assert.Contains("endpoints.schema_json|jsonb|NO", columns);
        Assert.Contains("endpoints.settings_json|jsonb|NO", columns);
        Assert.Contains("request_logs.id|int8|NO", columns);
        Assert.Contains("request_logs.status|int2|NO", columns);
        Assert.Contains("request_logs.request_body|text|YES", columns);
        Assert.Contains("project_usage_daily.day|date|NO", columns);
        Assert.Contains("project_usage_daily.request_count|int4|NO", columns);

        var identity = await ScalarStringAsync(
            connection,
            """
            SELECT is_identity || '|' || identity_generation
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'request_logs'
              AND column_name = 'id'
            """
        );

        Assert.Equal("YES|ALWAYS", identity);

        var defaults = await QueryStringsAsync(
            connection,
            """
            SELECT table_name || '.' || column_name || '|' || column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_default IS NOT NULL
            """
        );

        Assert.Contains("projects.id|gen_random_uuid()", defaults);
        Assert.Contains("endpoints.id|gen_random_uuid()", defaults);
        Assert.Contains("endpoints.schema_version|1", defaults);
        Assert.Contains("projects.created_at|now()", defaults);
        Assert.Contains("endpoints.created_at|now()", defaults);
        Assert.Contains("endpoints.updated_at|now()", defaults);
        Assert.Contains("request_logs.injected_error|false", defaults);
        Assert.Contains("request_logs.delay_ms|0", defaults);
        Assert.Contains("request_logs.created_at|now()", defaults);
        Assert.Contains("project_usage_daily.request_count|0", defaults);

        var ipColumns = await QueryStringsAsync(
            connection,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND lower(column_name) IN ('ip', 'ip_address', 'client_ip', 'remote_ip')
            """
        );

        Assert.Empty(ipColumns);
    }

    [Fact]
    public async Task Migration_creates_expected_constraints()
    {
        await using var connection = await OpenConnectionAsync();

        var uniqueDefinition = await ScalarStringAsync(
            connection,
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conname = 'uq_endpoints_route' AND contype = 'u'
            """
        );

        Assert.Equal("UNIQUE (project_id, method, path_normalized)", uniqueDefinition);

        var methodCheck = await ScalarStringAsync(
            connection,
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conname = 'ck_endpoints_method' AND contype = 'c'
            """
        );

        Assert.Contains("'GET'", methodCheck);
        Assert.Contains("'POST'", methodCheck);
        Assert.Contains("'PUT'", methodCheck);
        Assert.Contains("'DELETE'", methodCheck);

        var endpointCascade = await ScalarStringAsync(
            connection,
            """
            SELECT confdeltype::text
            FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'endpoints'::regclass
              AND confrelid = 'projects'::regclass
            """
        );

        var logProjectCascade = await ScalarStringAsync(
            connection,
            """
            SELECT confdeltype::text
            FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'request_logs'::regclass
              AND confrelid = 'projects'::regclass
            """
        );

        var logEndpointSetNull = await ScalarStringAsync(
            connection,
            """
            SELECT confdeltype::text
            FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'request_logs'::regclass
              AND confrelid = 'endpoints'::regclass
            """
        );

        var usageCascade = await ScalarStringAsync(
            connection,
            """
            SELECT confdeltype::text
            FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'project_usage_daily'::regclass
              AND confrelid = 'projects'::regclass
            """
        );

        Assert.Equal("c", endpointCascade);
        Assert.Equal("c", logProjectCascade);
        Assert.Equal("n", logEndpointSetNull);
        Assert.Equal("c", usageCascade);
    }

    [Fact]
    public async Task Duplicate_route_is_rejected_by_database()
    {
        var project = CreateProject();
        var first = CreateEndpoint(project.Id);

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            context.Endpoints.Add(first);
            await context.SaveChangesAsync();
        }

        var duplicate = CreateEndpoint(project.Id);

        await using var duplicateContext = _fixture.CreateContext();
        duplicateContext.Endpoints.Add(duplicate);

        var exception = await Assert.ThrowsAsync<DbUpdateException>(() =>
            duplicateContext.SaveChangesAsync()
        );
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
        Assert.Equal("uq_endpoints_route", postgresException.ConstraintName);
    }

    [Fact]
    public async Task Method_check_constraint_is_enforced()
    {
        var project = CreateProject();
        var endpoint = CreateEndpoint(project.Id);
        endpoint.Method = "PATCH";

        await using var context = _fixture.CreateContext();
        context.Projects.Add(project);
        context.Endpoints.Add(endpoint);

        var exception = await Assert.ThrowsAsync<DbUpdateException>(() =>
            context.SaveChangesAsync()
        );
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.CheckViolation, postgresException.SqlState);
    }

    [Fact]
    public async Task Deleting_project_cascades_to_endpoints_logs_and_usage()
    {
        var project = CreateProject();
        var endpoint = CreateEndpoint(project.Id);
        var log = CreateRequestLog(project.Id, endpoint.Id);
        var usage = new ProjectUsageDaily
        {
            ProjectId = project.Id,
            Day = TodayUtc(),
            RequestCount = 1,
        };

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            context.Endpoints.Add(endpoint);
            context.RequestLogs.Add(log);
            context.ProjectUsageDaily.Add(usage);
            await context.SaveChangesAsync();
        }

        await using (var context = _fixture.CreateContext())
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM projects WHERE id = {project.Id}"
            );
        }

        await using var verifyConnection = await OpenConnectionAsync();
        Assert.Equal(0, await CountAsync(verifyConnection, "endpoints", project.Id));
        Assert.Equal(0, await CountAsync(verifyConnection, "request_logs", project.Id));
        Assert.Equal(0, await CountAsync(verifyConnection, "project_usage_daily", project.Id));
    }

    [Fact]
    public async Task Deleting_endpoint_nulls_log_endpoint_id()
    {
        var project = CreateProject();
        var endpoint = CreateEndpoint(project.Id);
        var log = CreateRequestLog(project.Id, endpoint.Id);

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            context.Endpoints.Add(endpoint);
            context.RequestLogs.Add(log);
            await context.SaveChangesAsync();
        }

        await using (var context = _fixture.CreateContext())
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM endpoints WHERE id = {endpoint.Id}"
            );
        }

        await using var verifyContext = _fixture.CreateContext();
        var storedLog = await verifyContext
            .RequestLogs.AsNoTracking()
            .SingleAsync(item => item.Id == log.Id);

        Assert.Null(storedLog.EndpointId);
        Assert.Equal(project.Id, storedLog.ProjectId);
    }

    [Fact]
    public async Task Edit_token_hash_round_trips_as_32_byte_bytea()
    {
        var project = CreateProject();
        var hash = RandomNumberGenerator.GetBytes(32);
        project.EditTokenHash = hash;

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            await context.SaveChangesAsync();
        }

        await using var verifyContext = _fixture.CreateContext();
        var stored = await verifyContext
            .Projects.AsNoTracking()
            .SingleAsync(item => item.Id == project.Id);

        Assert.Equal(32, stored.EditTokenHash.Length);
        Assert.Equal(hash, stored.EditTokenHash);
    }

    [Fact]
    public async Task Json_columns_preserve_field_order_and_numeric_values()
    {
        var project = CreateProject();
        var endpoint = CreateEndpoint(project.Id);
        endpoint.SchemaJson = SchemaJson;
        endpoint.SettingsJson = SettingsJson;

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            context.Endpoints.Add(endpoint);
            await context.SaveChangesAsync();
        }

        await using var verifyContext = _fixture.CreateContext();
        var stored = await verifyContext
            .Endpoints.AsNoTracking()
            .SingleAsync(item => item.Id == endpoint.Id);

        using var document = JsonDocument.Parse(stored.SchemaJson);
        var fields = document.RootElement.GetProperty("root").GetProperty("fields");

        Assert.Equal(JsonValueKind.Array, fields.ValueKind);

        var fieldList = fields.EnumerateArray().ToList();
        Assert.Equal(4, fieldList.Count);
        Assert.Equal("alpha", fieldList[0].GetProperty("name").GetString());
        Assert.Equal("beta", fieldList[1].GetProperty("name").GetString());
        Assert.Equal("gamma", fieldList[2].GetProperty("name").GetString());
        Assert.Equal("delta", fieldList[3].GetProperty("name").GetString());

        var alphaMin = fieldList[0].GetProperty("min");
        var alphaMax = fieldList[0].GetProperty("max");
        Assert.Equal(JsonValueKind.Number, alphaMin.ValueKind);
        Assert.Equal(1L, alphaMin.GetInt64());
        Assert.Equal(9007199254740993L, alphaMax.GetInt64());

        var betaMin = fieldList[1].GetProperty("min");
        var betaMax = fieldList[1].GetProperty("max");
        Assert.Equal(JsonValueKind.Number, betaMin.ValueKind);
        Assert.Equal(-1.5m, betaMin.GetDecimal());
        Assert.Equal(12345678901234567890.12m, betaMax.GetDecimal());

        var nullable = fieldList[2].GetProperty("nullable");
        Assert.Equal(JsonValueKind.True, nullable.ValueKind);
        Assert.True(nullable.GetBoolean());

        var enumValues = fieldList[3].GetProperty("enum").EnumerateArray().ToList();
        Assert.Equal(3, enumValues.Count);
        Assert.Equal("x", enumValues[0].GetString());
        Assert.Equal("y", enumValues[1].GetString());
        Assert.Equal("z", enumValues[2].GetString());

        using var settingsDocument = JsonDocument.Parse(stored.SettingsJson);
        Assert.Equal(201, settingsDocument.RootElement.GetProperty("status").GetInt32());
        Assert.Equal(
            100,
            settingsDocument.RootElement.GetProperty("delay").GetProperty("maxMs").GetInt32()
        );
    }

    [Fact]
    public async Task Project_repository_finds_by_slug_and_id()
    {
        var project = CreateProject();

        await using (var context = _fixture.CreateContext())
        {
            var repository = new ProjectRepository(context);
            repository.Add(project);
            await repository.SaveChangesAsync();
        }

        await using var verifyContext = _fixture.CreateContext();
        var verifyRepository = new ProjectRepository(verifyContext);

        var bySlug = await verifyRepository.FindBySlugAsync(project.Slug);
        var byId = await verifyRepository.FindByIdAsync(project.Id);

        Assert.NotNull(bySlug);
        Assert.NotNull(byId);
        Assert.Equal(project.Id, bySlug.Id);
        Assert.Equal(project.Slug, byId.Slug);
    }

    [Fact]
    public async Task Request_log_pagination_is_descending_by_id()
    {
        var project = CreateProject();
        var endpoint = CreateEndpoint(project.Id);

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            context.Endpoints.Add(endpoint);

            for (var index = 0; index < 5; index++)
            {
                context.RequestLogs.Add(CreateRequestLog(project.Id, endpoint.Id));
            }

            await context.SaveChangesAsync();
        }

        await using var verifyContext = _fixture.CreateContext();
        var repository = new RequestLogRepository(verifyContext);

        var firstPage = await repository.ListLogsAsync(project.Id, 2, null);
        Assert.Equal(2, firstPage.Count);
        Assert.True(firstPage[0].Id > firstPage[1].Id);

        var secondPage = await repository.ListLogsAsync(project.Id, 2, firstPage[1].Id);
        Assert.Equal(2, secondPage.Count);
        Assert.True(secondPage[0].Id < firstPage[1].Id);
        Assert.True(secondPage[0].Id > secondPage[1].Id);

        var thirdPage = await repository.ListLogsAsync(project.Id, 2, secondPage[1].Id);
        Assert.Single(thirdPage);
        Assert.True(thirdPage[0].Id < secondPage[1].Id);
    }

    [Fact]
    public async Task Usage_upsert_is_atomic_and_returns_updated_count()
    {
        var project = CreateProject();
        var day = TodayUtc();

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            await context.SaveChangesAsync();
        }

        await using (var context = _fixture.CreateContext())
        {
            var repository = new UsageRepository(context);

            var first = await repository.IncrementDailyAsync(project.Id, day, 1);
            var second = await repository.IncrementDailyAsync(project.Id, day, 2);

            Assert.Equal(1, first);
            Assert.Equal(3, second);
        }

        await using var verifyContext = _fixture.CreateContext();
        var usage = await verifyContext
            .ProjectUsageDaily.AsNoTracking()
            .SingleAsync(item => item.ProjectId == project.Id && item.Day == day);

        Assert.Equal(3, usage.RequestCount);
    }

    private static Project CreateProject()
    {
        return new Project
        {
            Id = Guid.NewGuid(),
            Slug = Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture)[..10],
            Name = "Integration test",
            EditTokenHash = RandomNumberGenerator.GetBytes(32),
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
        };
    }

    private static Endpoint CreateEndpoint(Guid projectId)
    {
        return new Endpoint
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Method = "GET",
            Path = "/items",
            PathNormalized = "/items",
            SchemaVersion = 1,
            SchemaJson = """{"version":1,"root":{"type":"object","fields":[]}}""",
            SettingsJson = """{"status":200}""",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }

    private static RequestLog CreateRequestLog(Guid projectId, Guid? endpointId)
    {
        return new RequestLog
        {
            ProjectId = projectId,
            EndpointId = endpointId,
            RequestId = Guid.NewGuid(),
            Method = "GET",
            Path = "/items",
            Query = "page=1",
            Status = 200,
            LatencyMs = 5,
            RequestContentType = "application/json",
            RequestBody = """{"hello":"world"}""",
            UserAgent = "integration-test",
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    private static DateOnly TodayUtc()
    {
        return DateOnly.FromDateTime(DateTime.UtcNow);
    }

    private async Task<NpgsqlConnection> OpenConnectionAsync()
    {
        var connection = new NpgsqlConnection(_fixture.ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task<List<string>> QueryStringsAsync(
        NpgsqlConnection connection,
        string sql
    )
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var results = new List<string>();

        while (await reader.ReadAsync())
        {
            results.Add(reader.GetString(0));
        }

        return results;
    }

    private static async Task<string> ScalarStringAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        var result = await command.ExecuteScalarAsync();

        return Assert.IsType<string>(result);
    }

    private static async Task<long> CountAsync(
        NpgsqlConnection connection,
        string table,
        Guid projectId
    )
    {
        var sql = table switch
        {
            "endpoints" => "SELECT count(*) FROM endpoints WHERE project_id = @project_id",
            "request_logs" => "SELECT count(*) FROM request_logs WHERE project_id = @project_id",
            "project_usage_daily" =>
                "SELECT count(*) FROM project_usage_daily WHERE project_id = @project_id",
            _ => throw new ArgumentOutOfRangeException(nameof(table)),
        };

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("project_id", projectId);
        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt64(result, CultureInfo.InvariantCulture);
    }
}
