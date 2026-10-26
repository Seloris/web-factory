using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Catalogue.Dtos;

public sealed record SpecDto(string Id, string Name, Role Role, string Icon);
