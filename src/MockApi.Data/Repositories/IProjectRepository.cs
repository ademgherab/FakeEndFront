using MockApi.Data.Entities;

namespace MockApi.Data.Repositories;

public interface IProjectRepository
{
    Task<Project?> FindBySlugAsync(string slug, CancellationToken cancellationToken = default);

    Task<Project?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);

    void Add(Project project);

    void Remove(Project project);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
