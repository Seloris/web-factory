using FluentValidation;
using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

/// <summary>The body of a sheet's creation and update: the pseudo and the choices, from the most wanted.</summary>
public static class SavePlayer
{
    public sealed record Command(string Pseudo, IReadOnlyList<Choice> Choices);

    public sealed record Choice(string SpecId, Rank Rank);

    public sealed class Validator : AbstractValidator<Command>
    {
        public Validator()
        {
            RuleFor(c => c.Pseudo)
                .Must(p => !string.IsNullOrWhiteSpace(p)).WithMessage("The pseudo is required.")
                .MaximumLength(Player.PseudoMaxLength);
            RuleFor(c => c.Choices).NotEmpty();
            RuleForEach(c => c.Choices).ChildRules(choice =>
            {
                choice.RuleFor(c => c.SpecId)
                    .Must(id => id is not null && GameCatalogue.FindSpec(id) is not null).WithMessage("Unknown spec.");
                choice.RuleFor(c => c.Rank).IsInEnum();
            });
        }
    }
}
