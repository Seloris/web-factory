using RosterComp.Domain.Catalogue;

namespace RosterComp.Domain.Rosters;

/// <summary>A player on a place of the roster, with the spec of the choice they play there.</summary>
public sealed class RosterPlacement
{
    private RosterPlacement()
    {
        SpecId = string.Empty;
    }

    public RosterPlacement(int playerId, string specId, bool isLocked)
    {
        PlayerId = playerId;
        SpecId = specId;
        IsLocked = isLocked;
    }

    public int PlayerId { get; private set; }

    public string SpecId { get; private set; }

    public bool IsLocked { get; private set; }

    public Role Role => GameCatalogue.GetSpec(SpecId).Role;

    public void SetLocked(bool isLocked) => IsLocked = isLocked;
}
