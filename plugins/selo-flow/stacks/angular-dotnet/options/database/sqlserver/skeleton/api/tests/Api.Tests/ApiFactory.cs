using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using {{namespace}}.Infrastructure.Data;

namespace {{namespace}}.Api.Tests;

/// <summary>
/// The API in process, on a database of its own on the local SQL Server, migrated at start and dropped at the end, with the test clock. One per test class.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    // The server of appsettings.json's connection string; each factory names its own database on it.
    private const string SqlServer = "{{sql_server}}";

    public TestTimeProvider Time { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", $"Server={SqlServer};Database={{namespace}}_Test_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True");
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
        var tables = db.Model.GetEntityTypes()
            .Where(t => t.GetTableName() is not null)
            .Select(t => $"[{t.GetSchema() ?? "dbo"}].[{t.GetTableName()}]")
            .Distinct()
            .ToList();
#pragma warning disable EF1003 // the table names come from the EF model, never from input
        foreach (var table in tables)
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE " + table + " NOCHECK CONSTRAINT ALL", cancellationToken);
        }
        foreach (var table in tables)
        {
            await db.Database.ExecuteSqlRawAsync("DELETE FROM " + table, cancellationToken);
        }
        foreach (var table in tables)
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE " + table + " WITH CHECK CHECK CONSTRAINT ALL", cancellationToken);
        }
#pragma warning restore EF1003
    }

    public override async ValueTask DisposeAsync()
    {
        await using (var scope = Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        }
        await base.DisposeAsync();
    }
}
