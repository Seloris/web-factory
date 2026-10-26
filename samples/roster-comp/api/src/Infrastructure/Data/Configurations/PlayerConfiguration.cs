using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RosterComp.Domain.Players;

namespace RosterComp.Infrastructure.Data.Configurations;

public sealed class PlayerConfiguration : IEntityTypeConfiguration<Player>
{
    public void Configure(EntityTypeBuilder<Player> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Pseudo).HasMaxLength(Player.PseudoMaxLength).IsRequired();
        builder.Property(p => p.PseudoKey).HasMaxLength(Player.PseudoMaxLength).IsRequired();
        builder.HasIndex(p => p.PseudoKey).IsUnique();
        builder.OwnsMany(p => p.Choices, choice =>
        {
            choice.ToTable("PlayerChoices");
            choice.WithOwner().HasForeignKey("PlayerId");
            choice.Property<int>("Id");
            choice.HasKey("Id");
            choice.Property(c => c.SpecId).HasMaxLength(40).IsRequired();
            choice.Property(c => c.Rank).HasConversion<string>().HasMaxLength(1);
        });
        builder.Navigation(p => p.Choices).HasField("choices").UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
