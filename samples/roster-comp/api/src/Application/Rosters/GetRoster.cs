using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Rosters;

namespace RosterComp.Application.Rosters;

public static class GetRoster
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<RosterDto> HandleAsync(CancellationToken cancellationToken)
        {
            var roster = await db.Rosters.AsNoTracking().OrderBy(r => r.Id).FirstOrDefaultAsync(cancellationToken) ?? Roster.CreateDefault();
            var players = await db.Players.AsNoTracking().ToListAsync(cancellationToken);
            return RosterStore.ToResponse(roster, players);
        }
    }
}
