using MockApi.Api.Authorization;
using MockApi.Api.Observability;
using MockApi.Api.OpenApi;
using MockApi.Core.Configuration;
using MockApi.Core.Errors;
using MockApi.Core.Serialization;
using MockApi.Data.Configuration;

var builder = WebApplication.CreateBuilder(args);

builder.AddMockApiLogging();

builder.WebHost.ConfigureKestrel(
    (context, options) =>
    {
        var maxRequestBodyBytes = context.Configuration.GetValue<long?>(
            $"{MockApiOptions.SectionName}:{nameof(MockApiOptions.Limits)}:{nameof(LimitsOptions.MaxRequestBodyBytes)}"
        );

        if (maxRequestBodyBytes is > 0)
        {
            options.Limits.MaxRequestBodySize = maxRequestBodyBytes;
        }
    }
);

builder.Services.AddMockApiDatabaseOptions(builder.Configuration);
builder.Services.AddMockApiData(builder.Configuration);
builder.Services.AddMockApiOptions(builder.Configuration);
builder.Services.AddMockApiErrors(builder.Configuration);
builder.Services.AddMockApiProjectAuthorization();

builder
    .Services.AddControllers()
    .AddJsonOptions(options => JsonDefaults.Configure(options.JsonSerializerOptions));

builder.Services.ConfigureHttpJsonOptions(options =>
    JsonDefaults.Configure(options.SerializerOptions)
);

builder.Services.AddMockApiHealthChecks();
builder.Services.AddMockApiSwagger();

var app = builder.Build();

app.UseMockApiRequestContext();
app.UseMockApiRequestLogging();
app.UseMockApiErrorHandling();
app.UseMockApiManagementTransport();
app.UseMockApiSwagger();

app.MapMockApiHealthChecks();
app.MapControllers();

app.Run();

public partial class Program;
