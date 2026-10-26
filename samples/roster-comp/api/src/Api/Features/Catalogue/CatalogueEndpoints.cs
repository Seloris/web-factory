using RosterComp.Application.Catalogue;

namespace RosterComp.Api.Features.Catalogue;

public static class CatalogueEndpoints
{
    public static IEndpointRouteBuilder MapCatalogue(this IEndpointRouteBuilder app)
    {
        app.MapGet("/catalogue", (GetCatalogue.Handler handler) => TypedResults.Ok(handler.Handle()))
            .WithTags("Catalogue")
            .WithName("GetCatalogue")
            .WithSummary("Classes, specs and raids of the game");
        return app;
    }
}
