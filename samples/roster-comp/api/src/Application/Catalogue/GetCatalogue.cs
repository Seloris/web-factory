using RosterComp.Application.Catalogue.Dtos;
using RosterComp.Domain.Catalogue;

namespace RosterComp.Application.Catalogue;

public static class GetCatalogue
{
    public sealed class Handler
    {
        public CatalogueDto Handle() =>
            new([.. GameCatalogue.Classes.Select(c => c.ToDto())], [.. GameCatalogue.Raids.Select(r => r.ToDto())]);
    }
}
