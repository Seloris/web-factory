using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Rosters;

public static class UpdateComposition
{
    public sealed record Command(string RaidId, int Tanks, int Heals);

    public sealed class Validator : AbstractValidator<Command>
    {
        public Validator()
        {
            RuleFor(c => c.RaidId).Must(id => id is not null && GameCatalogue.FindRaid(id) is not null).WithMessage("Unknown raid.");
            RuleFor(c => c.Tanks).GreaterThanOrEqualTo(0);
            RuleFor(c => c.Heals).GreaterThanOrEqualTo(0);
        }
    }

    public sealed class Handler(IAppDbContext db, Random random)
    {
        public async Task<RosterDto> HandleAsync(Command command, CancellationToken cancellationToken)
        {
            var roster = await RosterStore.LoadAsync(db, cancellationToken);
            var players = await db.Players.ToListAsync(cancellationToken);
            roster.SetComposition(command.RaidId, command.Tanks, command.Heals, players, random);
            await db.SaveChangesAsync(cancellationToken);
            return RosterStore.ToResponse(roster, players);
        }
    }
}
