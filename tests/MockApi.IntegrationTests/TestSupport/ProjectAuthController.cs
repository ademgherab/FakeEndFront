using Microsoft.AspNetCore.Mvc;
using MockApi.Api.Authorization;

namespace MockApi.IntegrationTests.TestSupport;

[ApiController]
[Route("api/v1/test-auth/projects/{slug}")]
[RequireProjectEditToken]
public sealed class ProjectAuthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var project = ProjectAuthorizationContext.GetRequiredProject(HttpContext);

        return Ok(new { slug = project.Slug, name = project.Name });
    }
}
