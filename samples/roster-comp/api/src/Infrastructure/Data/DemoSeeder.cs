namespace RosterComp.Infrastructure.Data;

/// <summary>
/// The demo's data, inserted at each start of the demo: each feature adds the rows its browser tests need,
/// so the demo shows every screen with something on it.
/// </summary>
public static class DemoSeeder
{
    public static Task SeedAsync(AppDbContext db, TimeProvider time, CancellationToken cancellationToken = default)
    {
        _ = db;
        _ = time;
        _ = cancellationToken;
        return Task.CompletedTask;
    }
}
