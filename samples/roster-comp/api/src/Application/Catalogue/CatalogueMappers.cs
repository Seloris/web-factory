using RosterComp.Application.Catalogue.Dtos;
using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Catalogue;

public static class CatalogueMappers
{
    extension(GameClass gameClass)
    {
        public ClassDto ToDto() => new(gameClass.Id, gameClass.Name, [.. gameClass.Specs.Select(s => s.ToDto())]);
    }

    extension(Spec spec)
    {
        public SpecDto ToDto() => new(spec.Id, spec.Name, spec.Role, spec.Icon);
    }

    extension(Raid raid)
    {
        public RaidDto ToDto() => new(raid.Id, raid.Name, raid.Size);
    }
}
