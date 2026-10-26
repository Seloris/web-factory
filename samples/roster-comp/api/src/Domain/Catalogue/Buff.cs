namespace RosterComp.Domain.Catalogue;

/// <summary>
/// A buff or debuff a class gives: any of its specs when <see cref="SpecIds"/> is empty.
/// A buff with a <see cref="Pool"/> takes one player of its class out of that pool (one blessing per paladin);
/// <see cref="ExcludedById"/> names a buff whose coverage cancels this one.
/// </summary>
public sealed record Buff(
    string Id,
    string Name,
    BuffGroup Group,
    string ClassId,
    IReadOnlyList<string> SpecIds,
    string? Pool = null,
    string? PreferredSpecId = null,
    string? ExcludedById = null);
