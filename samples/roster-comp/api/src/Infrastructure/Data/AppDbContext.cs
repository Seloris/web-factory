using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Domain.Players;
using RosterComp.Domain.Rosters;

namespace RosterComp.Infrastructure.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Player> Players => Set<Player>();

    public DbSet<Roster> Rosters => Set<Roster>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
