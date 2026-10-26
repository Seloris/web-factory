using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RosterComp.Application.Common;
using RosterComp.Infrastructure.Data;

namespace RosterComp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        // An in-memory SQLite database (the demo's, the tests') lives while one connection to it stays open: this one, for the app's lifetime.
        services.AddSingleton(_ => new SqliteConnection(connectionString));
        services.TryAddSingleton(TimeProvider.System);
        // The roster generation's tie-breaker: injected like the clock, so the tests can pin it.
        services.TryAddSingleton(Random.Shared);
        return services;
    }

    public static async Task MigrateDatabaseAsync(this IServiceProvider services, bool seedDemo)
    {
        await services.GetRequiredService<SqliteConnection>().OpenAsync();
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        if (seedDemo)
        {
            await DemoSeeder.SeedAsync(db, services.GetRequiredService<TimeProvider>());
        }
    }
}
