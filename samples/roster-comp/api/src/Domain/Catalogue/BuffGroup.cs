using System.Text.Json.Serialization;

namespace RosterComp.Domain.Catalogue;

[JsonConverter(typeof(JsonStringEnumConverter<BuffGroup>))]
public enum BuffGroup
{
    Raid,
    Totems,
    Debuffs,
    Utility,
}
