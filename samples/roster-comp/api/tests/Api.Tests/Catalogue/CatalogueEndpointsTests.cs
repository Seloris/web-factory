using System.Net;
using System.Net.Http.Json;
using RosterComp.Application.Catalogue.Dtos;
using RosterComp.Domain.Catalogue;

namespace RosterComp.Api.Tests.Catalogue;

public sealed class CatalogueEndpointsTests(ApiFactory api) : ApiTest(api)
{
    [Fact]
    public async Task GetCatalogue_Should_ReturnNineClassesTwentyEightSpecsAndHyjal_When_Called()
    {
        // Act
        var response = await Client.GetAsync("/catalogue", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<CatalogueDto>(CT))!;
        body.Classes.Count.ShouldBe(9);
        body.Classes.Sum(c => c.Specs.Count).ShouldBe(28);
        body.Classes.Single(c => c.Id == "druid").Specs.Single(s => s.Id == "druid-feral-bear")
            .ShouldBe(new SpecDto("druid-feral-bear", "Farouche (ours)", Role.Tank, "ability_racial_bearform"));
        body.Raids.ShouldBe([new RaidDto("hyjal", "Sommet d’Hyjal — 20 joueurs", 20)]);
    }
}
