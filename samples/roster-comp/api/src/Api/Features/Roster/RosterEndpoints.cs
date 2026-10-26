using RosterComp.Application.Rosters;

namespace RosterComp.Api.Features.Roster;

/// <summary>The one shared roster: every change answers the whole roster, buffs recap included.</summary>
public static class RosterEndpoints
{
    public static IEndpointRouteBuilder MapRoster(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/roster").WithTags("Roster");

        group.MapGet("/", async (GetRoster.Handler handler, CancellationToken ct) => TypedResults.Ok(await handler.HandleAsync(ct)))
            .WithName("GetRoster")
            .WithSummary("The composition, the placed players and the buffs recap");

        group.MapPut("/composition", async (UpdateComposition.Command command, UpdateComposition.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(command, ct)))
            .WithName("UpdateComposition")
            .WithSummary("Set the raid, the tanks and the heals; a generated roster is generated again, locks kept")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapPost("/generate", async (GenerateRoster.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(ct)))
            .WithName("GenerateRoster")
            .WithSummary("Generate the roster again, locked players kept");

        group.MapPost("/placements", async (PlacePlayer.Command command, PlacePlayer.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(command, ct)))
            .WithName("PlacePlayer")
            .WithSummary("Put a player on a place of a role by hand, locked")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapDelete("/placements/{playerId:int}", async (int playerId, RemovePlacement.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(playerId, ct)))
            .WithName("RemovePlacement")
            .WithSummary("Take a player out of the roster; their place frees")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPut("/placements/{playerId:int}/lock", async (int playerId, SetPlacementLock.Command command, SetPlacementLock.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(playerId, command, ct)))
            .WithName("SetPlacementLock")
            .WithSummary("Lock or unlock a placed player")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/unlock-all", async (UnlockAll.Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(ct)))
            .WithName("UnlockAll")
            .WithSummary("Unlock every placed player");

        return app;
    }
}
