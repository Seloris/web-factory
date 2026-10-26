using RosterComp.Application.Players;

namespace RosterComp.Api.Features.Players;

public static class PlayersEndpoints
{
    public static IEndpointRouteBuilder MapPlayers(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/players").WithTags("Players");

        group.MapGet("/", async (GetPlayers.Handler handler, CancellationToken ct) => TypedResults.Ok(await handler.HandleAsync(ct)))
            .WithName("GetPlayers")
            .WithSummary("Every sheet, in creation order");

        group.MapPost("/", async (SavePlayer.Command command, CreatePlayer.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(command, ct)))
            .WithName("CreatePlayer")
            .WithSummary("Add a sheet")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapPut("/{id:int}", async (int id, SavePlayer.Command command, UpdatePlayer.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(id, command, ct)))
            .WithName("UpdatePlayer")
            .WithSummary("Edit a sheet; its place holds while the choice it plays there exists")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapDelete("/{id:int}", async (int id, DeletePlayer.Handler handler, CancellationToken ct) =>
            {
                await handler.HandleAsync(id, ct);
                return TypedResults.NoContent();
            })
            .WithName("DeletePlayer")
            .WithSummary("Delete a sheet; its place frees")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }
}
