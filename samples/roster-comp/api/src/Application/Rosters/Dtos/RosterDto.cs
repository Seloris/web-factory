namespace RosterComp.Application.Rosters.Dtos;

/// <summary>
/// The roster: its composition, the placed players in sheet order, the sheets left with no place and the buffs recap.
/// Before the first generation, no place is held and the recap is empty.
/// </summary>
public sealed record RosterDto(
    string RaidId,
    int Tanks,
    int Heals,
    int Dps,
    bool IsGenerated,
    IReadOnlyList<PlacementDto> Placements,
    IReadOnlyList<int> UnplacedPlayerIds,
    IReadOnlyList<BuffDto> Buffs);
