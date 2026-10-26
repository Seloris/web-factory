using RosterComp.Domain.Catalogue;

namespace RosterComp.Domain.Rosters;

/// <summary>
/// A buff and the players giving it, none when it lacks. <see cref="NeededCount"/>: the players of its class a pool
/// buff needs when the roster has too few of them; <see cref="IsExcluded"/>: cancelled by its excluding buff.
/// </summary>
public sealed record BuffCoverage(Buff Buff, IReadOnlyList<RaidMember> Givers, int? NeededCount, bool IsExcluded)
{
    public bool IsCovered => Givers.Count > 0;
}
