using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

public static class DeletePlayer
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task HandleAsync(int id, CancellationToken cancellationToken)
        {
            var player = await db.Players.FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                ?? throw new NotFoundException(nameof(Player), id);
            var roster = await db.Rosters.OrderBy(r => r.Id).FirstOrDefaultAsync(cancellationToken);
            roster?.OnPlayerDeleted(id);
            db.Players.Remove(player);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
