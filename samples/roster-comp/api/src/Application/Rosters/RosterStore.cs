using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;
using RosterComp.Domain.Rosters;

namespace RosterComp.Application.Rosters;

/// <summary>The one roster, loaded for a change (created with the default composition the first time), and its response.</summary>
internal static class RosterStore
{
    public static async Task<Roster> LoadAsync(IAppDbContext db, CancellationToken cancellationToken)
    {
        var roster = await db.Rosters.OrderBy(r => r.Id).FirstOrDefaultAsync(cancellationToken);
        if (roster is null)
        {
            roster = Roster.CreateDefault();
            db.Rosters.Add(roster);
        }
        return roster;
    }

    public static RosterDto ToResponse(Roster roster, IReadOnlyList<Player> players)
    {
        var byId = players.ToDictionary(p => p.Id);
        var placed = roster.Placements
            .OrderBy(p => p.PlayerId)
            .Select(p => (Placement: p, Player: byId[p.PlayerId], Choice: byId[p.PlayerId].ChoiceOf(p.SpecId)!))
            .ToList();
        var placedIds = placed.Select(p => p.Player.Id).ToHashSet();
        var members = placed.Select(p => new RaidMember(p.Player.Id, p.Player.Pseudo, GameCatalogue.GetSpec(p.Placement.SpecId))).ToList();
        return new RosterDto(
            roster.RaidId,
            roster.Tanks,
            roster.Heals,
            roster.PlacesFor(Role.Dps),
            roster.IsGenerated,
            [.. placed.Select(p => new PlacementDto(
                p.Player.Id, p.Player.Pseudo, p.Choice.SpecId, p.Choice.Role, p.Choice.Rank, p.Choice.Position, p.Placement.IsLocked))],
            roster.IsGenerated ? [.. players.Where(p => !placedIds.Contains(p.Id)).OrderBy(p => p.Id).Select(p => p.Id)] : [],
            roster.IsGenerated ? [.. BuffCalculator.Compute(members).Select(c => c.ToDto())] : []);
    }
}
