using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;

namespace RosterComp.Infrastructure.Data;

/// <summary>
/// The demo's data, inserted at each start of the demo: each feature adds the rows its browser tests need,
/// so the demo shows every screen with something on it.
/// </summary>
public static class DemoSeeder
{
    public static async Task SeedAsync(AppDbContext db, TimeProvider time, CancellationToken cancellationToken = default)
    {
        _ = time;
        // The roster builder mockup's 20 sheets (plate 1), in its order; the roster is left to generate.
        Player[] players =
        [
            new("Grumdar", [("warrior-protection", Rank.S), ("warrior-fury", Rank.A)]),
            new("Aëlwen", [("paladin-protection", Rank.S), ("paladin-holy", Rank.B)]),
            new("Velyss", [("priest-holy", Rank.S), ("priest-shadow", Rank.B)]),
            new("Thalrion", [("druid-restoration", Rank.S), ("druid-balance", Rank.A)]),
            new("Mokoa", [("shaman-restoration", Rank.S), ("shaman-enhancement", Rank.B)]),
            new("Lunéa", [("paladin-holy", Rank.S)]),
            new("Tharok", [("warrior-fury", Rank.S), ("warrior-protection", Rank.A)]),
            new("Séraphine", [("paladin-holy", Rank.S), ("paladin-retribution", Rank.A)]),
            new("Ombrelune", [("priest-shadow", Rank.S), ("priest-discipline", Rank.C)]),
            new("Elyndra", [("druid-balance", Rank.S)]),
            new("Fendrak", [("druid-feral-cat", Rank.S), ("druid-feral-bear", Rank.B)]),
            new("Brakmor", [("shaman-enhancement", Rank.S), ("shaman-elemental", Rank.A)]),
            new("Kaëlis", [("mage-frost", Rank.S), ("mage-fire", Rank.A)]),
            new("Isolde", [("mage-fire", Rank.S)]),
            new("Zorgrim", [("warlock-destruction", Rank.S)]),
            new("Morwen", [("warlock-affliction", Rank.S), ("warlock-demonology", Rank.B)]),
            new("Nyxa", [("rogue-combat", Rank.S)]),
            new("Varkas", [("rogue-assassination", Rank.S), ("rogue-combat", Rank.A)]),
            new("Sylvanor", [("hunter-marksmanship", Rank.S)]),
            new("Garrosk", [("hunter-beast-mastery", Rank.S), ("hunter-survival", Rank.A)]),
        ];
        // One save per sheet: the ids keep the mockup's order, which is the roster's order.
        foreach (var player in players)
        {
            db.Players.Add(player);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
