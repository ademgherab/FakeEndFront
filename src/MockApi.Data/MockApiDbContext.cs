using Microsoft.EntityFrameworkCore;
using MockApi.Data.Entities;

namespace MockApi.Data;

public sealed class MockApiDbContext : DbContext
{
    public MockApiDbContext(DbContextOptions<MockApiDbContext> options)
        : base(options) { }

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<Endpoint> Endpoints => Set<Endpoint>();

    public DbSet<RequestLog> RequestLogs => Set<RequestLog>();

    public DbSet<ProjectUsageDaily> ProjectUsageDaily => Set<ProjectUsageDaily>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        ConfigureProject(modelBuilder);
        ConfigureEndpoint(modelBuilder);
        ConfigureRequestLog(modelBuilder);
        ConfigureProjectUsageDaily(modelBuilder);
    }

    private static void ConfigureProject(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<Project>();

        entity.ToTable("projects");
        entity.HasKey(project => project.Id);
        entity.Property(project => project.Id).HasDefaultValueSql("gen_random_uuid()");
        entity.Property(project => project.Slug).HasMaxLength(16).IsRequired();
        entity.Property(project => project.Name).HasMaxLength(60);
        entity.Property(project => project.EditTokenHash).HasColumnType("bytea").IsRequired();
        entity
            .Property(project => project.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("now()");
        entity.Property(project => project.ExpiresAt).HasColumnType("timestamptz");
        entity.Property(project => project.LastRequestAt).HasColumnType("timestamptz");
        entity.HasIndex(project => project.Slug).IsUnique();
        entity.HasIndex(project => project.ExpiresAt).HasDatabaseName("ix_projects_expires_at");
    }

    private static void ConfigureEndpoint(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<Endpoint>();

        entity.ToTable(
            "endpoints",
            table =>
                table.HasCheckConstraint(
                    "ck_endpoints_method",
                    "method IN ('GET', 'POST', 'PUT', 'DELETE')"
                )
        );
        entity.HasKey(endpoint => endpoint.Id);
        entity.Property(endpoint => endpoint.Id).HasDefaultValueSql("gen_random_uuid()");
        entity.Property(endpoint => endpoint.Method).HasMaxLength(6).IsRequired();
        entity.Property(endpoint => endpoint.Path).HasMaxLength(200).IsRequired();
        entity.Property(endpoint => endpoint.PathNormalized).HasMaxLength(200).IsRequired();
        entity.Property(endpoint => endpoint.SchemaVersion).HasDefaultValue((short)1);
        entity.Property(endpoint => endpoint.SchemaJson).HasColumnType("jsonb").IsRequired();
        entity.Property(endpoint => endpoint.SettingsJson).HasColumnType("jsonb").IsRequired();
        entity
            .Property(endpoint => endpoint.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("now()");
        entity
            .Property(endpoint => endpoint.UpdatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("now()");
        entity
            .HasOne(endpoint => endpoint.Project)
            .WithMany(project => project.Endpoints)
            .HasForeignKey(endpoint => endpoint.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
        entity
            .HasAlternateKey(endpoint => new
            {
                endpoint.ProjectId,
                endpoint.Method,
                endpoint.PathNormalized,
            })
            .HasName("uq_endpoints_route");
    }

    private static void ConfigureRequestLog(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<RequestLog>();

        entity.ToTable("request_logs");
        entity.HasKey(log => log.Id);
        entity.Property(log => log.Id).UseIdentityAlwaysColumn();
        entity.Property(log => log.RequestId).IsRequired();
        entity.Property(log => log.Method).HasMaxLength(8).IsRequired();
        entity.Property(log => log.Path).HasMaxLength(300).IsRequired();
        entity.Property(log => log.Query).HasMaxLength(500);
        entity.Property(log => log.Status).IsRequired();
        entity.Property(log => log.InjectedError).HasDefaultValue(false);
        entity.Property(log => log.DelayMs).HasDefaultValue(0);
        entity.Property(log => log.LatencyMs).IsRequired();
        entity.Property(log => log.RequestContentType).HasMaxLength(100);
        entity.Property(log => log.RequestBody).HasColumnType("text");
        entity.Property(log => log.UserAgent).HasMaxLength(200);
        entity
            .Property(log => log.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("now()");
        entity
            .HasOne(log => log.Project)
            .WithMany(project => project.RequestLogs)
            .HasForeignKey(log => log.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
        entity
            .HasOne(log => log.Endpoint)
            .WithMany(endpoint => endpoint.RequestLogs)
            .HasForeignKey(log => log.EndpointId)
            .OnDelete(DeleteBehavior.SetNull);
        entity
            .HasIndex(log => new { log.ProjectId, log.Id })
            .IsDescending(false, true)
            .HasDatabaseName("ix_request_logs_project_id_id");
    }

    private static void ConfigureProjectUsageDaily(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ProjectUsageDaily>();

        entity.ToTable("project_usage_daily");
        entity.HasKey(usage => new { usage.ProjectId, usage.Day });
        entity.Property(usage => usage.Day).HasColumnType("date");
        entity.Property(usage => usage.RequestCount).HasDefaultValue(0);
        entity
            .HasOne(usage => usage.Project)
            .WithMany(project => project.UsageDaily)
            .HasForeignKey(usage => usage.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
