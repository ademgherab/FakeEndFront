using Microsoft.EntityFrameworkCore;
using MockApi.Data;
using Testcontainers.PostgreSql;

namespace MockApi.IntegrationTests;

public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("mockapi")
        .WithUsername("mockapi")
        .WithPassword("mockapi_dev")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        await using var context = CreateContext();
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }

    public MockApiDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MockApiDbContext>()
            .UseNpgsql(
                ConnectionString,
                npgsql =>
                    npgsql.MigrationsAssembly(typeof(MockApiDbContext).Assembly.GetName().Name!)
            )
            .UseSnakeCaseNamingConvention()
            .Options;

        return new MockApiDbContext(options);
    }
}
