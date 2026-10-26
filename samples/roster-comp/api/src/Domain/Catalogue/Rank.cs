using System.Text.Json.Serialization;

namespace RosterComp.Domain.Catalogue;

/// <summary>How much a player wants a choice: S the most, C the least.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Rank>))]
public enum Rank
{
    S,
    A,
    B,
    C,
}
