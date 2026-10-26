using System.Text.Json.Serialization;

namespace RosterComp.Domain.Catalogue;

[JsonConverter(typeof(JsonStringEnumConverter<Role>))]
public enum Role
{
    Tank,
    Heal,
    Dps,
}
