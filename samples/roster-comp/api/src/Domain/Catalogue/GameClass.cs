namespace RosterComp.Domain.Catalogue;

public sealed record GameClass(string Id, string Name, IReadOnlyList<Spec> Specs);
