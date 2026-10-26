using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RosterComp.Domain.Players;
using RosterComp.Domain.Rosters;

namespace RosterComp.Infrastructure.Data.Configurations;

public sealed class RosterConfiguration : IEntityTypeConfiguration<Roster>
{
    public void Configure(EntityTypeBuilder<Roster> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.RaidId).HasMaxLength(40).IsRequired();
        builder.OwnsMany(r => r.Placements, placement =>
        {
            placement.ToTable("RosterPlacements");
            placement.WithOwner().HasForeignKey("RosterId");
            placement.Property<int>("Id");
            placement.HasKey("Id");
            placement.Property(p => p.SpecId).HasMaxLength(40).IsRequired();
            placement.HasOne<Player>().WithMany().HasForeignKey(p => p.PlayerId).OnDelete(DeleteBehavior.Cascade);
            placement.HasIndex(p => p.PlayerId).IsUnique();
        });
        builder.Navigation(r => r.Placements).HasField("placements").UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
