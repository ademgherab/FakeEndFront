using Microsoft.EntityFrameworkCore;
using MockApi.Data.Entities;

namespace MockApi.Data.Repositories;

public sealed class ProjectRepository : IProjectRepository
{
    private readonly MockApiDbContext _context;

    public ProjectRepository(MockApiDbContext context)
    {
        _context = context;
    }

    public Task<Project?> FindBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);

        return _context.Projects.FirstOrDefaultAsync(
            project => project.Slug == slug,
            cancellationToken
        );
    }

    public Task<Project?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return _context.Projects.FirstOrDefaultAsync(
            project => project.Id == id,
            cancellationToken
        );
    }

    public void Add(Project project)
    {
        ArgumentNullException.ThrowIfNull(project);

        _context.Projects.Add(project);
    }

    public void Remove(Project project)
    {
        ArgumentNullException.ThrowIfNull(project);

        _context.Projects.Remove(project);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
