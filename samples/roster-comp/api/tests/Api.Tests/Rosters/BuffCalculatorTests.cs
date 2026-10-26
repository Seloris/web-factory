using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Rosters;

namespace RosterComp.Api.Tests.Rosters;

public sealed class BuffCalculatorTests
{
    private static readonly (string Pseudo, string SpecId)[] PlateOne =
    [
        ("Grumdar", "warrior-protection"), ("Aëlwen", "paladin-protection"), ("Velyss", "priest-holy"),
        ("Thalrion", "druid-restoration"), ("Mokoa", "shaman-restoration"), ("Lunéa", "paladin-holy"),
        ("Tharok", "warrior-fury"), ("Séraphine", "paladin-retribution"), ("Ombrelune", "priest-shadow"),
        ("Elyndra", "druid-balance"), ("Fendrak", "druid-feral-cat"), ("Brakmor", "shaman-enhancement"),
        ("Kaëlis", "mage-frost"), ("Isolde", "mage-fire"), ("Zorgrim", "warlock-destruction"),
        ("Morwen", "warlock-affliction"), ("Nyxa", "rogue-combat"), ("Varkas", "rogue-assassination"),
        ("Sylvanor", "hunter-marksmanship"), ("Garrosk", "hunter-beast-mastery"),
    ];

    private static readonly string[] AbsentFromPlateTwo = ["Mokoa", "Séraphine", "Brakmor", "Sylvanor", "Garrosk"];

    [Fact]
    public void Compute_Should_CountThirtyOfThirtyTwo_When_PlateOneRoster()
    {
        // Act
        var coverages = BuffCalculator.Compute(Members(PlateOne));

        // Assert
        coverages.Count.ShouldBe(32);
        CoveredByGroup(coverages).ShouldBe([(BuffGroup.Raid, 8, 8), (BuffGroup.Totems, 7, 8), (BuffGroup.Debuffs, 11, 11), (BuffGroup.Utility, 4, 5)]);
    }

    [Fact]
    public void Compute_Should_CountTwentyFourOfThirtyTwo_When_PlateTwoRoster()
    {
        // Act
        var coverages = BuffCalculator.Compute(Members(PlateOne.Where(m => !AbsentFromPlateTwo.Contains(m.Pseudo))));

        // Assert
        CoveredByGroup(coverages).ShouldBe([(BuffGroup.Raid, 7, 8), (BuffGroup.Totems, 3, 8), (BuffGroup.Debuffs, 10, 11), (BuffGroup.Utility, 4, 5)]);
    }

    [Fact]
    public void Compute_Should_GiveOneBlessingPerPaladin_When_TwoPaladins()
    {
        // Act
        var coverages = BuffCalculator.Compute(Members([("Aëlwen", "paladin-protection"), ("Lunéa", "paladin-holy")]));

        // Assert
        Givers(coverages, "blessing-of-kings").ShouldBe(["Aëlwen"]);
        Givers(coverages, "blessing-of-might").ShouldBe(["Lunéa"]);
        var wisdom = coverages.Single(c => c.Buff.Id == "blessing-of-wisdom");
        wisdom.IsCovered.ShouldBeFalse();
        wisdom.NeededCount.ShouldBe(3);
        Givers(coverages, "blessing-of-salvation").ShouldBe(["Aëlwen", "Lunéa"]);
    }

    [Fact]
    public void Compute_Should_ExcludeFlametongue_When_WindfuryIsCovered()
    {
        // Act
        var coverages = BuffCalculator.Compute(Members([("Mokoa", "shaman-restoration"), ("Brakmor", "shaman-enhancement")]));

        // Assert
        Givers(coverages, "windfury-totem").ShouldBe(["Brakmor"]);
        Givers(coverages, "grace-of-air-totem").ShouldBe(["Mokoa"]);
        var flametongue = coverages.Single(c => c.Buff.Id == "flametongue-totem");
        flametongue.IsExcluded.ShouldBeTrue();
        flametongue.IsCovered.ShouldBeFalse();
    }

    [Fact]
    public void Compute_Should_LeaveNeededCountEmpty_When_TheClassIsAbsent()
    {
        // Act
        var coverages = BuffCalculator.Compute([]);

        // Assert
        coverages.ShouldAllBe(c => !c.IsCovered && c.NeededCount == null && !c.IsExcluded);
    }

    private static List<RaidMember> Members(IEnumerable<(string Pseudo, string SpecId)> members) =>
        [.. members.Select((m, i) => new RaidMember(i + 1, m.Pseudo, GameCatalogue.GetSpec(m.SpecId)))];

    private static List<(BuffGroup, int, int)> CoveredByGroup(IReadOnlyList<BuffCoverage> coverages) =>
        [.. coverages.GroupBy(c => c.Buff.Group).Select(g => (g.Key, g.Count(c => c.IsCovered), g.Count()))];

    private static List<string> Givers(IReadOnlyList<BuffCoverage> coverages, string buffId) =>
        [.. coverages.Single(c => c.Buff.Id == buffId).Givers.Select(g => g.Pseudo)];
}
