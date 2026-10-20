using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MockApi.Data;

public sealed class MockApiDbContextFactory : IDesignTimeDbContextFactory<MockApiDbContext>
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=mockapi_design;Username=mockapi;Password=mockapi_dev";

    public MockApiDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("MOCKAPI_DESIGN_CONNECTION")
            ?? DefaultConnectionString;

        var options = new DbContextOptionsBuilder<MockApiDbContext>()
            .UseNpgsql(
                connectionString,
                npgsql =>
                    npgsql.MigrationsAssembly(typeof(MockApiDbContext).Assembly.GetName().Name!)
            )
            .UseSnakeCaseNamingConvention()
            .Options;

        return new MockApiDbContext(options);
    }
}
