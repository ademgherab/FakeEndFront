using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using MockApi.Core.Errors;

namespace MockApi.IntegrationTests.TestSupport;

[ApiController]
[Route("api/v1/test")]
public sealed class ErrorContractController : ControllerBase
{
    [HttpPost("echo")]
    public IActionResult Echo([FromBody] EchoRequest request) => Ok(request);

    [HttpGet("success")]
    public IActionResult Success() => Ok(new { ok = true });

    [HttpGet("boom")]
    public IActionResult Boom() =>
        throw new InvalidOperationException(
            "ConnectionStrings:Default=Host=db;Username=sa;Password=super-secret; "
                + "System.InvalidOperationException details must never leak."
        );

    [HttpGet("api-error")]
    public IActionResult ApiError(
        [FromQuery] int status = 400,
        [FromQuery] string code = ErrorCodes.ValidationFailed,
        [FromQuery] int? retry = null
    ) => throw new ApiException(status, code, "Synthetic failure.", retryAfterSeconds: retry);

    [HttpGet("no-body-401")]
    public IActionResult NoBodyUnauthorized() => StatusCode(401);

    [HttpGet("only-get")]
    public IActionResult OnlyGet() => Ok();

    [HttpGet("runtime-injected")]
    public Task RuntimeInjected() =>
        HttpContext
            .RequestServices.GetRequiredService<RuntimeErrorFactory>()
            .WriteInjectedAsync(HttpContext, 503);
}

public sealed class EchoRequest
{
    public string? Name { get; init; }

    public List<EchoEndpoint>? Endpoints { get; init; }
}

public sealed class EchoEndpoint
{
    public EchoSettings? Settings { get; init; }
}

public sealed class EchoSettings
{
    public EchoDelay? Delay { get; init; }
}

public sealed class EchoDelay
{
    public int MinMs { get; init; }
}
