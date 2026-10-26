namespace RosterComp.Application.Players.Dtos;

/// <summary>A sheet, its choices in the sheet's order, from the most wanted.</summary>
public sealed record PlayerDto(int Id, string Pseudo, IReadOnlyList<ChoiceDto> Choices);
