namespace RosterComp.Api.Features.Health;

public static class HealthEndpoints
{
    // Public: no sign-in on this route.
    public static IEndpointRouteBuilder MapHealth(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", (TimeProvider time) => TypedResults.Ok(new HealthResponse("ok", time.GetUtcNow())))
            .WithTags("Health")
            .WithName("GetHealth")
            .WithSummary("Liveness of the API");
        return app;
    }
}
