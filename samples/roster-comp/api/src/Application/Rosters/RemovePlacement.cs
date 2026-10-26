using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;

namespace RosterComp.Application.Rosters;

/// <summary>A placed player taken out of the roster: their place frees.</summary>
public static class RemovePlacement
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<RosterDto> HandleAsync(int playerId, CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            roster.Free(playerId);
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, await db.Players.AsNoTracking().ToListAsync(cancellationToken));
        }
    }
}
