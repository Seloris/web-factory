namespace RosterComp.Application.Catalogue.Dtos;

public sealed record CatalogueDto(IReadOnlyList<ClassDto> Classes, IReadOnlyList<RaidDto> Raids);
