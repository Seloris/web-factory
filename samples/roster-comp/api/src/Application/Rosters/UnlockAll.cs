using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;

namespace RosterComp.Application.Rosters;

public static class UnlockAll
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<RosterDto> HandleAsync(CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            roster.UnlockAll();
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, await db.Players.AsNoTracking().ToListAsync(cancellationToken));
        }
    }
}
