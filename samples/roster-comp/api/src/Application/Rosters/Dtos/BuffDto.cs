using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Rosters.Dtos;

/// <summary>
/// A buff of the recap: covered when it has givers. Its class and specs (none: any spec) say what it lacks;
/// <see cref="NeededCount"/>, the players of its class its pool needs; <see cref="ExcludedById"/>, the buff cancelling it.
/// </summary>
public sealed record BuffDto(
    string Id,
    string Name,
    BuffGroup Group,
    string ClassId,
    IReadOnlyList<string> SpecIds,
    string? Pool,
    IReadOnlyList<BuffGiverDto> Givers,
    int? NeededCount,
    string? ExcludedById);
