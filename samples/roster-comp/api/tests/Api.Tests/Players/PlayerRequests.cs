using System.Net.Http.Json;
using System.Text.Json;
using RosterComp.Application.Players;
using RosterComp.Application.Players.Dtos;
using RosterComp.Domain.Catalogue;

namespace RosterComp.Api.Tests.Players;

/// <summary>The calls the players and roster tests share: a sheet created through the endpoint, a problem's code.</summary>
internal static class PlayerRequests
{
    public static SavePlayer.Command Sheet(string pseudo, params (string SpecId, Rank Rank)[] choices) =>
        new(pseudo, [.. choices.Select(c => new SavePlayer.Choice(c.SpecId, c.Rank))]);

    public static async Task<int> CreatePlayerAsync(
        this HttpClient client, string pseudo, CancellationToken cancellationToken, params (string SpecId, Rank Rank)[] choices)
    {
        var response = await client.PostAsJsonAsync("/players", Sheet(pseudo, choices), cancellationToken);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PlayerDto>(cancellationToken))!.Id;
    }

    public static async Task<string?> CodeOfAsync(this HttpResponseMessage response, CancellationToken cancellationToken)
    {
        using var body = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        return body.RootElement.GetProperty("code").GetString();
    }
}
