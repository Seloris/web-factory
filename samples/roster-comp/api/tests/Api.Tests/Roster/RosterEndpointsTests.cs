using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterComp.Api.Tests.Players;
using RosterComp.Application.Rosters;
using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Catalogue;
using RosterComp.Infrastructure.Data;

namespace RosterComp.Api.Tests.Roster;

public sealed class RosterEndpointsTests(ApiFactory api) : ApiTest(api)
{
    [Fact]
    public async Task GetRoster_Should_ReturnTheDefaultComposition_When_NothingWasSaved()
    {
        // Act
        var response = await Client.GetAsync("/roster", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<RosterDto>(CT))!;
        ShouldBeEmptyRoster(body, tanks: 2, heals: 4, dps: 14);
    }

    [Fact]
    public async Task GenerateRoster_Should_FillEveryPlaceBeforeMaximizingS_When_OnlyALowerChoiceLetsEveryoneIn()
    {
        // Arrange: one tank place, one heal place; Ylva's S tank would leave Grumdar out.
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var ylva = await Client.CreatePlayerAsync("Ylva", CT, ("paladin-protection", Rank.S), ("paladin-holy", Rank.A));
        await PutCompositionAsync(tanks: 1, heals: 1);

        // Act
        var body = await PostAsync("/roster/generate");

        // Assert
        body.IsGenerated.ShouldBeTrue();
        Placement(body, grumdar).ShouldBe(new PlacementDto(grumdar, "Grumdar", "warrior-protection", Role.Tank, Rank.S, 1, false));
        Placement(body, ylva).ShouldBe(new PlacementDto(ylva, "Ylva", "paladin-holy", Role.Heal, Rank.A, 2, false));
        body.UnplacedPlayerIds.ShouldBeEmpty();
        body.Buffs.Count.ShouldBe(32);
        body.Buffs.Single(b => b.Id == "battle-shout").Givers.ShouldBe([new BuffGiverDto(grumdar, "Grumdar", "warrior-protection")]);
        using var scope = Api.Services.CreateScope();
        var saved = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Rosters.SingleAsync(CT);
        saved.Placements.Count.ShouldBe(2);
    }

    [Fact]
    public async Task GenerateRoster_Should_ListASheetWithNoPlace_When_ItsRolesAreFull()
    {
        // Arrange
        await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await Client.CreatePlayerAsync("Aëlwen", CT, ("paladin-protection", Rank.S));
        await Client.CreatePlayerAsync("Tharok", CT, ("warrior-protection", Rank.S));
        await PutCompositionAsync(tanks: 2, heals: 4);

        // Act
        var body = await PostAsync("/roster/generate");

        // Assert
        body.Placements.Count.ShouldBe(2);
        body.UnplacedPlayerIds.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GenerateRoster_Should_KeepLockedPlayersOnTheirPlaceAndSpec_When_Reshuffled()
    {
        // Arrange: Aëlwen locked on her B heal; a reshuffle alone would move her to her S tank.
        await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var aelwen = await Client.CreatePlayerAsync("Aëlwen", CT, ("paladin-protection", Rank.S), ("paladin-holy", Rank.B));
        await PostAsync("/roster/generate");
        await PostAsync("/roster/placements", new PlacePlayer.Command(aelwen, Role.Heal, null));

        // Act
        var body = await PostAsync("/roster/generate");

        // Assert
        Placement(body, aelwen).ShouldBe(new PlacementDto(aelwen, "Aëlwen", "paladin-holy", Role.Heal, Rank.B, 2, true));
        body.Placements.Count.ShouldBe(2);
    }

    [Fact]
    public async Task UpdateComposition_Should_RegenerateKeepingLocks_When_TheRosterIsGenerated()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var tharok = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-protection", Rank.S), ("warrior-fury", Rank.A));
        await PostAsync("/roster/generate");
        await PutAsync($"/roster/placements/{grumdar}/lock", new SetPlacementLock.Command(true));

        // Act: one tank place left, Grumdar keeps it locked, Tharok moves to DPS.
        var body = await PutCompositionAsync(tanks: 1, heals: 4);

        // Assert
        body.Tanks.ShouldBe(1);
        body.Dps.ShouldBe(15);
        Placement(body, grumdar).IsLocked.ShouldBeTrue();
        Placement(body, grumdar).Role.ShouldBe(Role.Tank);
        Placement(body, tharok).SpecId.ShouldBe("warrior-fury");
    }

    [Fact]
    public async Task UpdateComposition_Should_SaveWithoutGenerating_When_NoRosterExists()
    {
        // Arrange
        await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));

        // Act
        var body = await PutCompositionAsync(tanks: 3, heals: 5);

        // Assert
        ShouldBeEmptyRoster(body, tanks: 3, heals: 5, dps: 12);
    }

    [Theory]
    [InlineData(2, 0)]
    [InlineData(0, 20)]
    public async Task UpdateComposition_Should_Return422BelowLockedPlayers_When_ARoleWouldHaveFewerPlacesThanItsLockedPlayers(int tanks, int heals)
    {
        // Arrange: a locked heal, and one locked DPS so that 20 heals leave no DPS place for him.
        var velyss = await Client.CreatePlayerAsync("Velyss", CT, ("priest-holy", Rank.S));
        var kaelis = await Client.CreatePlayerAsync("Kaëlis", CT, ("mage-frost", Rank.S));
        await PostAsync("/roster/placements", new PlacePlayer.Command(velyss, Role.Heal, null));
        await PostAsync("/roster/placements", new PlacePlayer.Command(kaelis, Role.Dps, null));

        // Act
        var response = await Client.PutAsJsonAsync("/roster/composition", new UpdateComposition.Command("hyjal", tanks, heals), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("below_locked_players");
    }

    [Fact]
    public async Task UpdateComposition_Should_Return422_When_TanksAndHealsExceedTheRaid()
    {
        // Act
        var response = await Client.PutAsJsonAsync("/roster/composition", new UpdateComposition.Command("hyjal", 12, 9), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("composition_too_large");
    }

    [Theory]
    [InlineData("naxxramas", 2, 4)]
    [InlineData("hyjal", -1, 4)]
    [InlineData("hyjal", 2, -1)]
    public async Task UpdateComposition_Should_Return400_When_TheCompositionIsMalformed(string raidId, int tanks, int heals)
    {
        // Act
        var response = await Client.PutAsJsonAsync("/roster/composition", new UpdateComposition.Command(raidId, tanks, heals), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeletePlayer_Should_FreeTheirPlace_When_TheyArePlaced()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var tharok = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-fury", Rank.S));
        await PostAsync("/roster/generate");

        // Act
        (await Client.DeleteAsync($"/players/{grumdar}", CT)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // Assert
        var body = await GetRosterAsync();
        body.Placements.Select(p => p.PlayerId).ShouldBe([tharok]);
    }

    [Fact]
    public async Task UpdatePlayer_Should_KeepTheirPlace_When_ThePlacedChoiceStillExists()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await PostAsync("/roster/generate");

        // Act
        await Client.PutAsJsonAsync($"/players/{grumdar}", PlayerRequests.Sheet("Grumdar", ("warrior-fury", Rank.S), ("warrior-protection", Rank.A)), CT);

        // Assert
        Placement(await GetRosterAsync(), grumdar).ShouldBe(new PlacementDto(grumdar, "Grumdar", "warrior-protection", Role.Tank, Rank.A, 2, false));
    }

    [Fact]
    public async Task UpdatePlayer_Should_FreeTheirPlace_When_ThePlacedChoiceIsGone()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await PostAsync("/roster/generate");

        // Act
        await Client.PutAsJsonAsync($"/players/{grumdar}", PlayerRequests.Sheet("Grumdar", ("warrior-fury", Rank.S)), CT);

        // Assert
        var body = await GetRosterAsync();
        body.Placements.ShouldBeEmpty();
        body.UnplacedPlayerIds.ShouldBe([grumdar]);
    }

    [Fact]
    public async Task PlacePlayer_Should_PutTheBestChoiceOfTheRoleLocked_When_ASheetIsDroppedOnAFreePlace()
    {
        // Arrange
        var seraphine = await Client.CreatePlayerAsync(
            "Séraphine", CT, ("paladin-holy", Rank.S), ("priest-discipline", Rank.A), ("paladin-retribution", Rank.A));

        // Act
        var body = await PostAsync("/roster/placements", new PlacePlayer.Command(seraphine, Role.Dps, null));

        // Assert
        Placement(body, seraphine).ShouldBe(new PlacementDto(seraphine, "Séraphine", "paladin-retribution", Role.Dps, Rank.A, 3, true));
        body.IsGenerated.ShouldBeTrue();
    }

    [Fact]
    public async Task PlacePlayer_Should_Return422RoleNotChosen_When_NoneOfTheirChoicesHasTheRole()
    {
        // Arrange
        var kaelis = await Client.CreatePlayerAsync("Kaëlis", CT, ("mage-frost", Rank.S));

        // Act
        var response = await Client.PostAsJsonAsync("/roster/placements", new PlacePlayer.Command(kaelis, Role.Tank, null), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("role_not_chosen");
    }

    [Fact]
    public async Task PlacePlayer_Should_Return422RoleFull_When_EveryPlaceOfTheRoleIsTaken()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var tharok = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-protection", Rank.S));
        await PutCompositionAsync(tanks: 1, heals: 4);
        await PostAsync("/roster/placements", new PlacePlayer.Command(grumdar, Role.Tank, null));

        // Act
        var response = await Client.PostAsJsonAsync("/roster/placements", new PlacePlayer.Command(tharok, Role.Tank, null), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("role_full");
    }

    [Fact]
    public async Task PlacePlayer_Should_SwapTwoPlacedPlayers_When_EachFitsTheOthersRole()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S), ("warrior-fury", Rank.B));
        var tharok = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-fury", Rank.S), ("warrior-protection", Rank.A));
        await PutCompositionAsync(tanks: 1, heals: 4);
        await PostAsync("/roster/generate");

        // Act: Tharok dropped on Grumdar's tank place.
        var body = await PostAsync("/roster/placements", new PlacePlayer.Command(tharok, Role.Tank, grumdar));

        // Assert
        Placement(body, tharok).ShouldBe(new PlacementDto(tharok, "Tharok", "warrior-protection", Role.Tank, Rank.A, 2, true));
        Placement(body, grumdar).ShouldBe(new PlacementDto(grumdar, "Grumdar", "warrior-fury", Role.Dps, Rank.B, 2, true));
    }

    [Fact]
    public async Task PlacePlayer_Should_TakeTheOccupantOut_When_ASheetIsDroppedOnAnOccupiedPlace()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await PutCompositionAsync(tanks: 1, heals: 4);
        await PostAsync("/roster/generate");
        var aelwen = await Client.CreatePlayerAsync("Aëlwen", CT, ("paladin-protection", Rank.S));

        // Act
        var body = await PostAsync("/roster/placements", new PlacePlayer.Command(aelwen, Role.Tank, grumdar));

        // Assert
        body.Placements.Select(p => p.PlayerId).ShouldBe([aelwen]);
        body.UnplacedPlayerIds.ShouldBe([grumdar]);
    }

    [Fact]
    public async Task PlacePlayer_Should_TakeTheOccupantOut_When_TheOccupantDoesNotFitTheRoleLeft()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var tharok = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-fury", Rank.S), ("warrior-protection", Rank.A));
        await PutCompositionAsync(tanks: 1, heals: 4);
        await PostAsync("/roster/generate");

        // Act
        var body = await PostAsync("/roster/placements", new PlacePlayer.Command(tharok, Role.Tank, grumdar));

        // Assert
        body.Placements.Select(p => p.PlayerId).ShouldBe([tharok]);
        body.UnplacedPlayerIds.ShouldBe([grumdar]);
    }

    [Fact]
    public async Task PlacePlayer_Should_Return404_When_ThePlayerDoesNotExist()
    {
        // Act
        var response = await Client.PostAsJsonAsync("/roster/placements", new PlacePlayer.Command(99, Role.Tank, null), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemovePlacement_Should_FreeThePlace_When_APlacedPlayerIsDraggedOut()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await PostAsync("/roster/generate");

        // Act
        var response = await Client.DeleteAsync($"/roster/placements/{grumdar}", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<RosterDto>(CT))!;
        body.Placements.ShouldBeEmpty();
        body.UnplacedPlayerIds.ShouldBe([grumdar]);
    }

    [Fact]
    public async Task RemovePlacement_Should_Return404_When_ThePlayerIsNotPlaced()
    {
        // Act
        var response = await Client.DeleteAsync("/roster/placements/99", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetPlacementLock_Should_LockThenUnlock_When_ThePlayerIsPlaced()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await PostAsync("/roster/generate");

        // Act
        var locked = await PutAsync($"/roster/placements/{grumdar}/lock", new SetPlacementLock.Command(true));
        var unlocked = await PutAsync($"/roster/placements/{grumdar}/lock", new SetPlacementLock.Command(false));

        // Assert
        Placement(locked, grumdar).IsLocked.ShouldBeTrue();
        Placement(unlocked, grumdar).IsLocked.ShouldBeFalse();
    }

    [Fact]
    public async Task UnlockAll_Should_UnlockEveryPlacedPlayer_When_SomeAreLocked()
    {
        // Arrange
        var grumdar = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var velyss = await Client.CreatePlayerAsync("Velyss", CT, ("priest-holy", Rank.S));
        await PostAsync("/roster/placements", new PlacePlayer.Command(grumdar, Role.Tank, null));
        await PostAsync("/roster/placements", new PlacePlayer.Command(velyss, Role.Heal, null));

        // Act
        var body = await PostAsync("/roster/unlock-all");

        // Assert
        body.Placements.ShouldAllBe(p => !p.IsLocked);
        body.Placements.Count.ShouldBe(2);
    }

    private static PlacementDto Placement(RosterDto roster, int playerId) => roster.Placements.Single(p => p.PlayerId == playerId);

    private static void ShouldBeEmptyRoster(RosterDto roster, int tanks, int heals, int dps)
    {
        (roster.RaidId, roster.Tanks, roster.Heals, roster.Dps, roster.IsGenerated).ShouldBe(("hyjal", tanks, heals, dps, false));
        roster.Placements.ShouldBeEmpty();
        roster.UnplacedPlayerIds.ShouldBeEmpty();
        roster.Buffs.ShouldBeEmpty();
    }

    private Task<RosterDto> PutCompositionAsync(int tanks, int heals) =>
        PutAsync("/roster/composition", new UpdateComposition.Command("hyjal", tanks, heals));

    private async Task<RosterDto> GetRosterAsync() => (await Client.GetFromJsonAsync<RosterDto>("/roster", CT))!;

    private async Task<RosterDto> PostAsync(string url, object? body = null)
    {
        var response = await Client.PostAsJsonAsync(url, body, CT);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<RosterDto>(CT))!;
    }

    private async Task<RosterDto> PutAsync(string url, object body)
    {
        var response = await Client.PutAsJsonAsync(url, body, CT);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<RosterDto>(CT))!;
    }
}
