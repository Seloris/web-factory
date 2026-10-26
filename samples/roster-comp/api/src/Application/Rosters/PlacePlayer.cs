using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Rosters;

/// <summary>A player put on a place of a role by hand; <c>TargetPlayerId</c>: the occupant of the place, when it has one; <c>SpecId</c>: the choice picked, their best one of the role when absent.</summary>
public static class PlacePlayer
{
    public sealed record Command(int PlayerId, Role Role, int? TargetPlayerId, string? SpecId = null);

    public sealed class Validator : AbstractValidator<Command>
    {
        public Validator()
        {
            RuleFor(c => c.Role).IsInEnum();
        }
    }

    public sealed class Handler(IAppDbContext db)
    {
        public async Task<RosterDto> HandleAsync(Command command, CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            var players = await db.Players.ToListAsync(cancellationToken);
            var player = players.FirstOrDefault(p => p.Id == command.PlayerId)
                ?? throw new NotFoundException(nameof(Player), command.PlayerId);
            roster.Place(player, command.Role, command.TargetPlayerId, command.SpecId, players);
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, players);
        }
    }
}
