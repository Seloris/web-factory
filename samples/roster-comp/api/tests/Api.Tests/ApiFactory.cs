using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterComp.Infrastructure.Data;

namespace RosterComp.Api.Tests;

/// <summary>
/// The API in process, on its own in-memory SQLite database migrated at start, with the test clock. One per test class.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public TestTimeProvider Time { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", $"Data Source=test-{Guid.NewGuid():N};Mode=Memory;Cache=Shared");
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Time));
    }

    /// <summary>
    /// Empties every table and puts the clock back at the epoch: each test starts on the migrated, empty database.
    /// </summary>
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        Time.Set(TestTimeProvider.Epoch);
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.OpenConnectionAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF", cancellationToken);
        foreach (var table in db.Model.GetEntityTypes().Select(t => t.GetTableName()).OfType<string>().Distinct())
        {
#pragma warning disable EF1003 // the table names come from the EF model, never from input
            await db.Database.ExecuteSqlRawAsync("DELETE FROM \"" + table + "\"", cancellationToken);
#pragma warning restore EF1003
        }
        await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON", cancellationToken);
    }
}
