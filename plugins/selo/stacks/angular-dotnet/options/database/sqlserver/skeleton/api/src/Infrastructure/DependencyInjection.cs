using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using {{namespace}}.Application.Common;
using {{namespace}}.Infrastructure.Data;

namespace {{namespace}}.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        var slotConnectionString = ForSlot(connectionString);
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(slotConnectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }

    public static async Task MigrateDatabaseAsync(this IServiceProvider services, bool seedDemo)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (seedDemo)
        {
            // The demo starts from its seed alone at each start, like an in-memory database would.
            await db.Database.EnsureDeletedAsync();
        }
        await db.Database.MigrateAsync();
        if (seedDemo)
        {
            await DemoSeeder.SeedAsync(db, services.GetRequiredService<TimeProvider>());
        }
    }

    // Two runs of the app on two slots (two worktrees) share the SQL Server instance: slot n > 0 gets databases of its own.
    private static string ForSlot(string connectionString)
    {
        var slot = Environment.GetEnvironmentVariable("SELO_SLOT");
        if (string.IsNullOrEmpty(slot) || slot == "0")
        {
            return connectionString;
        }
        var builder = new SqlConnectionStringBuilder(connectionString);
        builder.InitialCatalog = $"{builder.InitialCatalog}_Slot{slot}";
        return builder.ConnectionString;
    }
}
