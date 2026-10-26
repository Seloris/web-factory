namespace RosterComp.Application.Catalogue.Dtos;

public sealed record ClassDto(string Id, string Name, IReadOnlyList<SpecDto> Specs);
