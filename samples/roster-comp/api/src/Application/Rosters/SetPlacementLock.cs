using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;

namespace RosterComp.Application.Rosters;

public static class SetPlacementLock
{
    public sealed record Command(bool IsLocked);

    public sealed class Handler(IAppDbContext db)
    {
        public async Task<RosterDto> HandleAsync(int playerId, Command command, CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            roster.SetLocked(playerId, command.IsLocked);
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, await db.Players.AsNoTracking().ToListAsync(cancellationToken));
        }
    }
}
