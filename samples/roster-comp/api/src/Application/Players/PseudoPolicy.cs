using Microsoft.EntityFrameworkCore;
using RosterComp.Application.Common;
using RosterComp.Domain.Common;
using RosterComp.Domain.Players;

namespace RosterComp.Application.Players;

internal static class PseudoPolicy
{
    public static async Task EnsureFreeAsync(IAppDbContext db, string pseudo, int? playerId, CancellationToken cancellationToken)
    {
        var key = Player.KeyOf(pseudo);
        if (await db.Players.AnyAsync(p => p.PseudoKey == key && p.Id != playerId, cancellationToken))
        {
            throw new ConflictException("pseudo_taken", $"A sheet named {pseudo.Trim()} exists");
        }
    }
}
