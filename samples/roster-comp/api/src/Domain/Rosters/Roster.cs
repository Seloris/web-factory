using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Domain.Rosters;

/// <summary>The one shared roster: its composition (a raid, its tanks and heals, the DPS the rest) and who holds which place.</summary>
public sealed class Roster
{
    public const int DefaultTanks = 2;

    public const int DefaultHeals = 4;

    private readonly List<RosterPlacement> placements = [];

    private Roster()
    {
        RaidId = string.Empty;
    }

    public Roster(string raidId, int tanks, int heals)
    {
        RaidId = raidId;
        Tanks = tanks;
        Heals = heals;
    }

    public int Id { get; private set; }

    public string RaidId { get; private set; }

    public int Tanks { get; private set; }

    public int Heals { get; private set; }

    public bool IsGenerated { get; private set; }

    public IReadOnlyList<RosterPlacement> Placements => placements;

    public static Roster CreateDefault() => new(GameCatalogue.DefaultRaidId, DefaultTanks, DefaultHeals);

    public int PlacesFor(Role role) => role switch
    {
        Role.Tank => Tanks,
        Role.Heal => Heals,
        _ => RaidOf(RaidId).Size - Tanks - Heals,
    };

    public void SetComposition(string raidId, int tanks, int heals, IReadOnlyList<Player> players, Random random)
    {
        var size = RaidOf(raidId).Size;
        if (tanks < 0 || heals < 0 || tanks + heals > size)
        {
            throw new DomainException("composition_too_large", $"Tanks and heals exceed the raid's {size} places");
        }
        if (tanks < LockedCount(Role.Tank) || heals < LockedCount(Role.Heal) || size - tanks - heals < LockedCount(Role.Dps))
        {
            throw new DomainException("below_locked_players", "A role cannot have fewer places than its locked players");
        }
        RaidId = raidId;
        Tanks = tanks;
        Heals = heals;
        if (IsGenerated)
        {
            Generate(players, random);
        }
    }

    /// <summary>Places every sheet that is not locked again, the locked players kept on their place and spec.</summary>
    public void Generate(IReadOnlyList<Player> players, Random random)
    {
        placements.RemoveAll(p => !p.IsLocked);
        var lockedIds = placements.Select(p => p.PlayerId).ToHashSet();
        var places = Enum.GetValues<Role>()
            .SelectMany(role => Enumerable.Repeat(role, PlacesFor(role) - LockedCount(role)))
            .ToList();
        var candidates = players.Where(p => !lockedIds.Contains(p.Id)).ToList();
        foreach (var (player, choice) in RosterGenerator.Assign(candidates, places, random))
        {
            placements.Add(new RosterPlacement(player.Id, choice.SpecId, isLocked: false));
        }
        IsGenerated = true;
    }

    /// <summary>
    /// Puts a player on a place of a role by hand, on their best choice of that role, locked. On an occupied place
    /// (<paramref name="targetPlayerId"/>), a placed player swaps with the occupant when the occupant fits the role they leave;
    /// otherwise the occupant leaves the roster.
    /// </summary>
    public void Place(Player player, Role role, int? targetPlayerId, IReadOnlyList<Player> players)
    {
        var choice = player.BestChoiceFor(role)
            ?? throw new DomainException("role_not_chosen", $"{player.Pseudo} has no {role} choice");
        var target = targetPlayerId is { } targetId && targetId != player.Id
            ? Find(targetId) ?? throw new NotFoundException("Placement", targetId)
            : null;
        if (target is not null && target.Role != role)
        {
            throw new DomainException("target_role_mismatch", $"Player {target.PlayerId} is not on a {role} place");
        }
        var moved = Find(player.Id);
        if (moved is not null)
        {
            placements.Remove(moved);
        }
        if (target is not null)
        {
            placements.Remove(target);
            if (moved is not null && players.First(p => p.Id == target.PlayerId).BestChoiceFor(moved.Role) is { } back)
            {
                placements.Add(new RosterPlacement(target.PlayerId, back.SpecId, isLocked: true));
            }
        }
        else if (placements.Count(p => p.Role == role) >= PlacesFor(role))
        {
            throw new DomainException("role_full", $"Every {role} place is taken");
        }
        placements.Add(new RosterPlacement(player.Id, choice.SpecId, isLocked: true));
        IsGenerated = true;
    }

    public void Free(int playerId) =>
        placements.Remove(Find(playerId) ?? throw new NotFoundException("Placement", playerId));

    public void SetLocked(int playerId, bool isLocked) =>
        (Find(playerId) ?? throw new NotFoundException("Placement", playerId)).SetLocked(isLocked);

    public void UnlockAll() => placements.ForEach(p => p.SetLocked(false));

    /// <summary>An edited sheet keeps its place while the choice it plays there still exists.</summary>
    public void OnPlayerEdited(Player player)
    {
        if (Find(player.Id) is { } placement && player.ChoiceOf(placement.SpecId) is null)
        {
            placements.Remove(placement);
        }
    }

    public void OnPlayerDeleted(int playerId) => placements.RemoveAll(p => p.PlayerId == playerId);

    private int LockedCount(Role role) => placements.Count(p => p.IsLocked && p.Role == role);

    private RosterPlacement? Find(int playerId) => placements.FirstOrDefault(p => p.PlayerId == playerId);

    private static Raid RaidOf(string raidId) =>
        GameCatalogue.FindRaid(raidId) ?? throw new DomainException("unknown_raid", $"Raid {raidId} is not in the catalogue");
}
