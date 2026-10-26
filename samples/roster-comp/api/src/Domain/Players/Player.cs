using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Common;

namespace RosterComp.Domain.Players;

/// <summary>A player's sheet: a pseudo and the specs they want to play, ranked S to C.</summary>
public sealed class Player
{
    public const int MaxCount = 20;

    public const int PseudoMaxLength = 24;

    private readonly List<PlayerChoice> choices = [];

    private Player()
    {
        Pseudo = string.Empty;
        PseudoKey = string.Empty;
    }

    public Player(string pseudo, IReadOnlyList<(string SpecId, Rank Rank)> choices)
        : this()
    {
        Update(pseudo, choices);
    }

    public int Id { get; private set; }

    public string Pseudo { get; private set; }

    /// <summary>The pseudo folded to compare it whatever its case, accents included (SQLite folds ASCII only).</summary>
    public string PseudoKey { get; private set; }

    public IReadOnlyList<PlayerChoice> Choices => choices;

    public static string KeyOf(string pseudo) => pseudo.Trim().ToUpperInvariant();

    public void Update(string pseudo, IReadOnlyList<(string SpecId, Rank Rank)> newChoices)
    {
        if (newChoices.Count == 0)
        {
            throw new DomainException("no_choice", "A sheet holds at least one choice");
        }
        if (newChoices.DistinctBy(c => c.SpecId).Count() != newChoices.Count)
        {
            throw new DomainException("duplicate_spec", "A sheet never holds the same spec twice");
        }
        Pseudo = pseudo.Trim();
        PseudoKey = KeyOf(pseudo);
        choices.Clear();
        choices.AddRange(newChoices.Select((c, i) => new PlayerChoice(i + 1, c.SpecId, c.Rank)));
    }

    /// <summary>The best-ranked choice of a role; among equal ranks, the first in the sheet.</summary>
    public PlayerChoice? BestChoiceFor(Role role) =>
        choices.Where(c => c.Role == role).OrderBy(c => c.Rank).ThenBy(c => c.Position).FirstOrDefault();

    public PlayerChoice? ChoiceOf(string specId) => choices.FirstOrDefault(c => c.SpecId == specId);
}
