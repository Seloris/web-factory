using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;
using RosterComp.Domain.Rosters;

namespace RosterComp.Api.Tests.Rosters;

public sealed class RosterGeneratorTests
{
    [Fact]
    public void Assign_Should_FillEveryPlaceBeforeMaximizingS_When_OnlyALowerChoiceLetEveryoneIn()
    {
        // Arrange: one tank place, one heal place; Ylva's S tank would leave Grumdar out.
        var grumdar = new Player("Grumdar", [("warrior-protection", Rank.S)]);
        var ylva = new Player("Ylva", [("paladin-protection", Rank.S), ("paladin-holy", Rank.A)]);

        // Act
        var result = RosterGenerator.Assign([grumdar, ylva], [Role.Tank, Role.Heal], new Random(1));

        // Assert
        result.Count.ShouldBe(2);
        result.Single(r => r.Player == grumdar).Choice.SpecId.ShouldBe("warrior-protection");
        result.Single(r => r.Player == ylva).Choice.SpecId.ShouldBe("paladin-holy");
    }

    [Fact]
    public void Assign_Should_PlaceEverySheetOnItsS_When_PlateTwoFifteenSheetsMeetTwentyPlaces()
    {
        // Arrange: plate 2 of the mockup, 2 tanks, 4 heals, 14 DPS.
        var players = PlateTwoSheets();
        var places = Places(tanks: 2, heals: 4, dps: 14);

        // Act
        var result = RosterGenerator.Assign(players, places, new Random(7));

        // Assert
        result.Count.ShouldBe(15);
        result.ShouldAllBe(r => r.Choice.Rank == Rank.S);
        result.Count(r => r.Choice.Role == Role.Heal).ShouldBe(3);
        result.Count(r => r.Choice.Role == Role.Tank).ShouldBe(2);
    }

    [Fact]
    public void Assign_Should_LeaveASheetOut_When_NoneOfItsRolesHasAFreePlace()
    {
        // Arrange
        var grumdar = new Player("Grumdar", [("warrior-protection", Rank.S)]);
        var aelwen = new Player("Aëlwen", [("paladin-protection", Rank.A)]);

        // Act
        var result = RosterGenerator.Assign([grumdar, aelwen], [Role.Tank, Role.Dps], new Random(3));

        // Assert
        result.ShouldHaveSingleItem().Player.ShouldBe(grumdar);
    }

    [Fact]
    public void Assign_Should_PreferARankAOverTwoRanksB_When_OnlyOneSheetCanTakeItsBestChoice()
    {
        // Arrange: one heal place, one DPS place; Velyss heal A + Kaelis DPS B beats Velyss DPS B + Kaelis heal B.
        var velyss = new Player("Velyss", [("priest-holy", Rank.A), ("priest-shadow", Rank.B)]);
        var kaelis = new Player("Kaëlis", [("mage-frost", Rank.B), ("druid-restoration", Rank.B)]);

        // Act
        var result = RosterGenerator.Assign([velyss, kaelis], [Role.Heal, Role.Dps], new Random(5));

        // Assert
        result.Single(r => r.Player == velyss).Choice.SpecId.ShouldBe("priest-holy");
        result.Single(r => r.Player == kaelis).Choice.SpecId.ShouldBe("mage-frost");
    }

    private static List<Role> Places(int tanks, int heals, int dps) =>
    [
        .. Enumerable.Repeat(Role.Tank, tanks),
        .. Enumerable.Repeat(Role.Heal, heals),
        .. Enumerable.Repeat(Role.Dps, dps),
    ];

    private static List<Player> PlateTwoSheets() =>
    [
        new("Grumdar", [("warrior-protection", Rank.S), ("warrior-fury", Rank.A)]),
        new("Aëlwen", [("paladin-protection", Rank.S), ("paladin-holy", Rank.B)]),
        new("Velyss", [("priest-holy", Rank.S), ("priest-shadow", Rank.B)]),
        new("Thalrion", [("druid-restoration", Rank.S), ("druid-balance", Rank.A)]),
        new("Lunéa", [("paladin-holy", Rank.S)]),
        new("Tharok", [("warrior-fury", Rank.S), ("warrior-protection", Rank.A)]),
        new("Ombrelune", [("priest-shadow", Rank.S), ("priest-discipline", Rank.C)]),
        new("Elyndra", [("druid-balance", Rank.S)]),
        new("Kaëlis", [("mage-frost", Rank.S), ("mage-fire", Rank.A)]),
        new("Isolde", [("mage-fire", Rank.S)]),
        new("Zorgrim", [("warlock-destruction", Rank.S)]),
        new("Morwen", [("warlock-affliction", Rank.S), ("warlock-demonology", Rank.B)]),
        new("Nyxa", [("rogue-combat", Rank.S)]),
        new("Varkas", [("rogue-assassination", Rank.S), ("rogue-combat", Rank.A)]),
        new("Fendrak", [("druid-feral-cat", Rank.S), ("druid-feral-bear", Rank.B)]),
    ];
}
