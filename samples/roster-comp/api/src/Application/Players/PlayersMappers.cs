using RosterComp.Application.Players.Dtos;
using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

public static class PlayersMappers
{
    extension(Player player)
    {
        public PlayerDto ToDto() =>
            new(player.Id, player.Pseudo, [.. player.Choices.OrderBy(c => c.Position).Select(c => new ChoiceDto(c.SpecId, c.Rank))]);
    }

    extension(SavePlayer.Command command)
    {
        public IReadOnlyList<(string SpecId, Rank Rank)> ToChoices() => [.. command.Choices.Select(c => (c.SpecId, c.Rank))];
    }
}
