namespace RosterComp.Domain.Catalogue;

/// <summary>A class specialisation: its role in a raid and the name of its game icon.</summary>
public sealed record Spec(string Id, string ClassId, string Name, Role Role, string Icon);
