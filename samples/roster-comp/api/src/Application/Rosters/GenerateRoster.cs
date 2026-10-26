using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;

namespace RosterComp.Application.Rosters;

public static class GenerateRoster
{
    public sealed class Handler(IAppDbContext db, Random random)
    {
        public async Task<RosterDto> HandleAsync(CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            var players = await db.Players.ToListAsync(cancellationToken);
            roster.Generate(players, random);
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, players);
        }
    }
}
