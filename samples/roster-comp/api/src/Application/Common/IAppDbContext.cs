namespace RosterComp.Application.Common;

/// <summary>
/// The database as the handlers see it: one <c>DbSet</c> per entity, implemented in Infrastructure.
/// </summary>
public interface IAppDbContext
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
