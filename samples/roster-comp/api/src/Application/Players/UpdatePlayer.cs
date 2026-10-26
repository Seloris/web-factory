using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Players.Dtos;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

public static class UpdatePlayer
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<PlayerDto> HandleAsync(int id, SavePlayer.Command command, CancellationToken cancellationToken)
        {
            var player = await db.Players.FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                ?? throw new NotFoundException(nameof(Player), id);
            await PseudoPolicy.EnsureFreeAsync(db, command.Pseudo, id, cancellationToken);
            player.Update(command.Pseudo, command.ToChoices());
            var roster = await db.Rosters.OrderBy(r => r.Id).FirstOrDefaultAsync(cancellationToken);
            roster?.OnPlayerEdited(player);
            await db.SaveChangesAsync(cancellationToken);
            return player.ToDto();
        }
    }
}
