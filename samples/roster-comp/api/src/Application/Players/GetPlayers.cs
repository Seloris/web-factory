using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Players.Dtos;

namespace RosterComp.Application.Players;

public static class GetPlayers
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<IReadOnlyList<PlayerDto>> HandleAsync(CancellationToken cancellationToken)
        {
            var players = await db.Players.AsNoTracking().OrderBy(p => p.Id).ToListAsync(cancellationToken);
            return [.. players.Select(p => p.ToDto())];
        }
    }
}
