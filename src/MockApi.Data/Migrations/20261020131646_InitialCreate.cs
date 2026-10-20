using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MockApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    slug = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    edit_token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()"),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    last_request_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_projects", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "endpoints",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    path_normalized = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    schema_version = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)1),
                    schema_json = table.Column<string>(type: "jsonb", nullable: false),
                    settings_json = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_endpoints", x => x.id);
                    table.UniqueConstraint("uq_endpoints_route", x => new { x.project_id, x.method, x.path_normalized });
                    table.CheckConstraint("ck_endpoints_method", "method IN ('GET', 'POST', 'PUT', 'DELETE')");
                    table.ForeignKey(
                        name: "fk_endpoints_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_usage_daily",
                columns: table => new
                {
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    request_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_usage_daily", x => new { x.project_id, x.day });
                    table.ForeignKey(
                        name: "fk_project_usage_daily_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "request_logs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    endpoint_id = table.Column<Guid>(type: "uuid", nullable: true),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    path = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    query = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<short>(type: "smallint", nullable: false),
                    injected_error = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    delay_ms = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    latency_ms = table.Column<int>(type: "integer", nullable: false),
                    request_content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    request_body = table.Column<string>(type: "text", nullable: true),
                    user_agent = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_request_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_request_logs_endpoints_endpoint_id",
                        column: x => x.endpoint_id,
                        principalTable: "endpoints",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_request_logs_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_projects_expires_at",
                table: "projects",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_projects_slug",
                table: "projects",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_request_logs_endpoint_id",
                table: "request_logs",
                column: "endpoint_id");

            migrationBuilder.Sql(
                "CREATE INDEX ix_request_logs_project_id_id ON request_logs (project_id, id DESC);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_usage_daily");

            migrationBuilder.DropTable(
                name: "request_logs");

            migrationBuilder.DropTable(
                name: "endpoints");

            migrationBuilder.DropTable(
                name: "projects");
        }
    }
}
