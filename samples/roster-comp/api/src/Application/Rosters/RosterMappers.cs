using RosterComp.Application.Rosters.Dtos;
using RosterComp.Domain.Rosters;

namespace RosterComp.Application.Rosters;

public static class RosterMappers
{
    extension(BuffCoverage coverage)
    {
        public BuffDto ToDto() => new(
            coverage.Buff.Id,
            coverage.Buff.Name,
            coverage.Buff.Group,
            coverage.Buff.ClassId,
            coverage.Buff.SpecIds,
            coverage.Buff.Pool,
            [.. coverage.Givers.Select(g => new BuffGiverDto(g.PlayerId, g.Pseudo, g.Spec.Id))],
            coverage.NeededCount,
            coverage.IsExcluded ? coverage.Buff.ExcludedById : null);
    }
}
