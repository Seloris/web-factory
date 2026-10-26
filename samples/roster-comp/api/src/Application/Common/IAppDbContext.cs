using Microsoft.EntityFrameworkCore;
using RosterComp.Domain.Players;
using RosterComp.Domain.Rosters;

namespace RosterComp.Application.Common;

/// <summary>
/// The database as the handlers see it: one <c>DbSet</c> per entity, implemented in Infrastructure.
/// </summary>
public interface IAppDbContext
{
    DbSet<Player> Players { get; }

    DbSet<Roster> Rosters { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
