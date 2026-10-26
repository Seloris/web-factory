using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Rosters.Dtos;

/// <summary>A placed player: the choice they play, its rank and its position in their sheet (1 for the first choice).</summary>
public sealed record PlacementDto(int PlayerId, string Pseudo, string SpecId, Role Role, Rank Rank, int ChoicePosition, bool IsLocked);
