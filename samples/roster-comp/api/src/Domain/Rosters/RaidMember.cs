using RosterComp.Domain.Catalogue;

namespace RosterComp.Domain.Rosters;

/// <summary>A player on the roster, as the buffs recap sees them.</summary>
public sealed record RaidMember(int PlayerId, string Pseudo, Spec Spec);
