using RosterComp.Domain.Catalogue;

namespace RosterComp.Domain.Players;

/// <summary>A spec a player wants to play, with its rank; <see cref="Position"/> is its place in the sheet, from 1.</summary>
public sealed class PlayerChoice
{
    private PlayerChoice()
    {
        SpecId = string.Empty;
    }

    public PlayerChoice(int position, string specId, Rank rank)
    {
        Position = position;
        SpecId = specId;
        Rank = rank;
    }

    public int Position { get; private set; }

    public string SpecId { get; private set; }

    public Rank Rank { get; private set; }

    public Role Role => GameCatalogue.GetSpec(SpecId).Role;
}
