using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Players.Dtos;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

public static class CreatePlayer
{
    public sealed class Handler(IAppDbContext db)
    {
        public async Task<PlayerDto> HandleAsync(SavePlayer.Command command, CancellationToken cancellationToken)
        {
            if (await db.Players.CountAsync(cancellationToken) >= Player.MaxCount)
            {
                throw new DomainException("too_many_players", $"At most {Player.MaxCount} sheets exist");
            }
            await PseudoPolicy.EnsureFreeAsync(db, command.Pseudo, playerId: null, cancellationToken);
            var player = new Player(command.Pseudo, command.ToChoices());
            db.Players.Add(player);
            await db.SaveChangesAsync(cancellationToken);
            return player.ToDto();
        }
    }
}
