using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterComp.Application.Players;
using RosterComp.Application.Players.Dtos;
using RosterComp.Domain.Catalogue;
using RosterComp.Infrastructure.Data;

namespace RosterComp.Api.Tests.Players;

public sealed class PlayersEndpointsTests(ApiFactory api) : ApiTest(api)
{
    [Fact]
    public async Task CreatePlayer_Should_SaveTheSheetWithItsChoicesInOrder_When_Valid()
    {
        // Arrange
        var sheet = PlayerRequests.Sheet("  Séraphine ", ("paladin-holy", Rank.S), ("paladin-retribution", Rank.A), ("priest-discipline", Rank.A));

        // Act
        var response = await Client.PostAsJsonAsync("/players", sheet, CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<PlayerDto>(CT))!;
        body.Pseudo.ShouldBe("Séraphine");
        body.Choices.ShouldBe([new("paladin-holy", Rank.S), new("paladin-retribution", Rank.A), new("priest-discipline", Rank.A)]);
        using var scope = Api.Services.CreateScope();
        var saved = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Players.SingleAsync(CT);
        saved.Id.ShouldBe(body.Id);
        saved.PseudoKey.ShouldBe("SÉRAPHINE");
        saved.Choices.Select(c => (c.Position, c.SpecId)).ShouldBe([(1, "paladin-holy"), (2, "paladin-retribution"), (3, "priest-discipline")]);
    }

    [Theory]
    [InlineData("", "paladin-holy", "Pseudo")]
    [InlineData("   ", "paladin-holy", "Pseudo")]
    [InlineData("AVeryLongPseudoOfMoreThan24", "paladin-holy", "Pseudo")]
    [InlineData("Séraphine", "paladin-shadow", "Choices[0].SpecId")]
    [InlineData("Séraphine", null, "Choices")]
    public async Task CreatePlayer_Should_Return400WithTheField_When_TheSheetIsMalformed(string pseudo, string? specId, string field)
    {
        // Arrange
        var sheet = specId is null ? PlayerRequests.Sheet(pseudo) : PlayerRequests.Sheet(pseudo, (specId, Rank.S));

        // Act
        var response = await Client.PostAsJsonAsync("/players", sheet, CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = (await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>(CT))!;
        problem.Errors.ShouldContainKey(field);
    }

    [Fact]
    public async Task CreatePlayer_Should_Return409PseudoTaken_When_TheSamePseudoExistsInAnotherCase()
    {
        // Arrange
        await Client.CreatePlayerAsync("Séraphine", CT, ("paladin-holy", Rank.S));

        // Act
        var response = await Client.PostAsJsonAsync("/players", PlayerRequests.Sheet("SÉRAPHINE", ("priest-holy", Rank.S)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.CodeOfAsync(CT)).ShouldBe("pseudo_taken");
    }

    [Fact]
    public async Task CreatePlayer_Should_Return422DuplicateSpec_When_TheSheetHoldsASpecTwice()
    {
        // Act
        var response = await Client.PostAsJsonAsync(
            "/players", PlayerRequests.Sheet("Séraphine", ("paladin-holy", Rank.S), ("paladin-holy", Rank.B)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("duplicate_spec");
    }

    [Fact]
    public async Task CreatePlayer_Should_Return422TooManyPlayers_When_TwentySheetsExist()
    {
        // Arrange
        for (var i = 1; i <= 20; i++)
        {
            await Client.CreatePlayerAsync($"Joueur{i}", CT, ("mage-frost", Rank.S));
        }

        // Act
        var response = await Client.PostAsJsonAsync("/players", PlayerRequests.Sheet("Joueur21", ("mage-fire", Rank.S)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.CodeOfAsync(CT)).ShouldBe("too_many_players");
        using var scope = Api.Services.CreateScope();
        (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Players.CountAsync(CT)).ShouldBe(20);
    }

    [Fact]
    public async Task GetPlayers_Should_ReturnTheSheetsInCreationOrder_When_SheetsExist()
    {
        // Arrange
        await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        await Client.CreatePlayerAsync("Aëlwen", CT, ("paladin-protection", Rank.S), ("paladin-holy", Rank.B));

        // Act
        var response = await Client.GetAsync("/players", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<List<PlayerDto>>(CT))!;
        body.Select(p => p.Pseudo).ShouldBe(["Grumdar", "Aëlwen"]);
        body[1].Choices.Count.ShouldBe(2);
    }

    [Fact]
    public async Task UpdatePlayer_Should_ReplaceThePseudoAndChoices_When_Valid()
    {
        // Arrange
        var id = await Client.CreatePlayerAsync("Seraphine", CT, ("paladin-holy", Rank.S));

        // Act
        var response = await Client.PutAsJsonAsync(
            $"/players/{id}", PlayerRequests.Sheet("SERAPHINE", ("priest-discipline", Rank.A), ("paladin-holy", Rank.B)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var scope = Api.Services.CreateScope();
        var saved = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Players.SingleAsync(CT);
        saved.Pseudo.ShouldBe("SERAPHINE");
        saved.Choices.OrderBy(c => c.Position).Select(c => (c.SpecId, c.Rank)).ShouldBe([("priest-discipline", Rank.A), ("paladin-holy", Rank.B)]);
    }

    [Fact]
    public async Task UpdatePlayer_Should_Return409PseudoTaken_When_AnotherSheetHasThePseudo()
    {
        // Arrange
        await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));
        var id = await Client.CreatePlayerAsync("Tharok", CT, ("warrior-fury", Rank.S));

        // Act
        var response = await Client.PutAsJsonAsync($"/players/{id}", PlayerRequests.Sheet("grumdar", ("warrior-fury", Rank.S)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.CodeOfAsync(CT)).ShouldBe("pseudo_taken");
    }

    [Fact]
    public async Task UpdatePlayer_Should_Return404_When_TheSheetDoesNotExist()
    {
        // Act
        var response = await Client.PutAsJsonAsync("/players/99", PlayerRequests.Sheet("Grumdar", ("warrior-fury", Rank.S)), CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.CodeOfAsync(CT)).ShouldBe("not_found");
    }

    [Fact]
    public async Task DeletePlayer_Should_RemoveTheSheet_When_ItExists()
    {
        // Arrange
        var id = await Client.CreatePlayerAsync("Grumdar", CT, ("warrior-protection", Rank.S));

        // Act
        var response = await Client.DeleteAsync($"/players/{id}", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var scope = Api.Services.CreateScope();
        (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Players.AnyAsync(CT)).ShouldBeFalse();
    }

    [Fact]
    public async Task DeletePlayer_Should_Return404_When_TheSheetDoesNotExist()
    {
        // Act
        var response = await Client.DeleteAsync("/players/99", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
