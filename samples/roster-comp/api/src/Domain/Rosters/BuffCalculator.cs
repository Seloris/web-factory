using RosterComp.Domain.Catalogue;

namespace RosterComp.Domain.Rosters;

/// <summary>
/// Which catalogue buffs a roster covers: a buff of a pool (a paladin's blessing, a shaman's air totem, a warlock's curse)
/// takes one player of its class each, in the catalogue's order; an excluded buff lacks while its excluding one is covered.
/// </summary>
public static class BuffCalculator
{
    public static IReadOnlyList<BuffCoverage> Compute(IReadOnlyList<RaidMember> members)
    {
        var taken = new HashSet<(string Pool, int PlayerId)>();
        var coverages = new List<BuffCoverage>();
        foreach (var buff in GameCatalogue.Buffs)
        {
            var able = members
                .Where(m => m.Spec.ClassId == buff.ClassId && (buff.SpecIds.Count == 0 || buff.SpecIds.Contains(m.Spec.Id)))
                .ToList();
            if (buff.ExcludedById is { } excludedBy && coverages.Single(c => c.Buff.Id == excludedBy).IsCovered)
            {
                coverages.Add(new BuffCoverage(buff, [], null, IsExcluded: true));
                continue;
            }
            if (buff.Pool is not { } pool)
            {
                coverages.Add(new BuffCoverage(buff, able, null, IsExcluded: false));
                continue;
            }
            var free = able.Where(m => !taken.Contains((pool, m.PlayerId))).ToList();
            var giver = free.FirstOrDefault(m => m.Spec.Id == buff.PreferredSpecId) ?? free.FirstOrDefault();
            if (giver is not null)
            {
                taken.Add((pool, giver.PlayerId));
                coverages.Add(new BuffCoverage(buff, [giver], null, IsExcluded: false));
                continue;
            }
            // The class is on the roster, but each of its players already gives an earlier buff of the pool.
            int? neededCount = able.Count > 0
                ? GameCatalogue.Buffs.TakeWhile(b => b.Id != buff.Id).Count(b => b.Pool == pool) + 1
                : null;
            coverages.Add(new BuffCoverage(buff, [], neededCount, IsExcluded: false));
        }
        return coverages;
    }
}
