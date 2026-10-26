namespace RosterComp.Domain.Catalogue;

/// <summary>
/// The game data of WoW Forever the roster works with: classes and specs, raids, buffs. Code data, served as is by the API.
/// </summary>
public static class GameCatalogue
{
    public const string DefaultRaidId = "hyjal";

    public static IReadOnlyList<GameClass> Classes { get; } =
    [
        Class("warrior", "Guerrier",
            ("arms", "Armes", Role.Dps, "ability_warrior_savageblow"),
            ("fury", "Fureur", Role.Dps, "ability_warrior_innerrage"),
            ("protection", "Protection", Role.Tank, "ability_warrior_defensivestance")),
        Class("paladin", "Paladin",
            ("holy", "Sacré", Role.Heal, "spell_holy_holybolt"),
            ("protection", "Protection", Role.Tank, "spell_holy_devotionaura"),
            ("retribution", "Vindicte", Role.Dps, "spell_holy_auraoflight")),
        Class("hunter", "Chasseur",
            ("beast-mastery", "Maîtrise des bêtes", Role.Dps, "ability_hunter_beasttaming"),
            ("marksmanship", "Précision", Role.Dps, "ability_marksmanship"),
            ("survival", "Survie", Role.Dps, "ability_hunter_swiftstrike")),
        Class("rogue", "Voleur",
            ("assassination", "Assassinat", Role.Dps, "ability_rogue_eviscerate"),
            ("combat", "Combat", Role.Dps, "ability_backstab"),
            ("subtlety", "Finesse", Role.Dps, "ability_stealth")),
        Class("priest", "Prêtre",
            ("discipline", "Discipline", Role.Heal, "spell_holy_powerwordshield"),
            ("holy", "Sacré", Role.Heal, "spell_holy_guardianspirit"),
            ("shadow", "Ombre", Role.Dps, "spell_shadow_shadowwordpain")),
        Class("shaman", "Chaman",
            ("elemental", "Élémentaire", Role.Dps, "spell_nature_lightning"),
            ("enhancement", "Amélioration", Role.Dps, "spell_nature_lightningshield"),
            ("restoration", "Restauration", Role.Heal, "spell_nature_magicimmunity")),
        Class("mage", "Mage",
            ("arcane", "Arcanes", Role.Dps, "spell_holy_magicalsentry"),
            ("fire", "Feu", Role.Dps, "spell_fire_firebolt02"),
            ("frost", "Givre", Role.Dps, "spell_frost_frostbolt02")),
        Class("warlock", "Démoniste",
            ("affliction", "Affliction", Role.Dps, "spell_shadow_deathcoil"),
            ("demonology", "Démonologie", Role.Dps, "spell_shadow_metamorphosis"),
            ("destruction", "Destruction", Role.Dps, "spell_shadow_rainoffire")),
        Class("druid", "Druide",
            ("balance", "Équilibre", Role.Dps, "spell_nature_starfall"),
            ("feral-cat", "Farouche (félin)", Role.Dps, "ability_druid_catform"),
            ("feral-bear", "Farouche (ours)", Role.Tank, "ability_racial_bearform"),
            ("restoration", "Restauration", Role.Heal, "spell_nature_healingtouch")),
    ];

    public static IReadOnlyList<Raid> Raids { get; } =
    [
        new(DefaultRaidId, "Sommet d’Hyjal — 20 joueurs", 20),
    ];

    /// <summary>The buffs the recap counts, by group; within a pool, in the order the pool hands them out.</summary>
    public static IReadOnlyList<Buff> Buffs { get; } =
    [
        new("power-word-fortitude", "Prière de robustesse", BuffGroup.Raid, "priest", []),
        new("gift-of-the-wild", "Don du fauve", BuffGroup.Raid, "druid", []),
        new("arcane-brilliance", "Illumination des Arcanes", BuffGroup.Raid, "mage", []),
        new("divine-spirit", "Esprit divin", BuffGroup.Raid, "priest", []),
        new("battle-shout", "Cri de guerre", BuffGroup.Raid, "warrior", []),
        new("trueshot-aura", "Aura de précision", BuffGroup.Raid, "hunter", ["hunter-marksmanship"]),
        new("leader-of-the-pack", "Chef de la meute", BuffGroup.Raid, "druid", ["druid-feral-cat", "druid-feral-bear"]),
        new("moonkin-aura", "Aura de sélénien", BuffGroup.Raid, "druid", ["druid-balance"]),

        new("windfury-totem", "Totem Furie-des-vents", BuffGroup.Totems, "shaman", [], Pool: "air-totem", PreferredSpecId: "shaman-enhancement"),
        new("strength-of-earth-totem", "Totem de Force de la Terre", BuffGroup.Totems, "shaman", []),
        new("grace-of-air-totem", "Totem de Grâce aérienne", BuffGroup.Totems, "shaman", [], Pool: "air-totem"),
        // Its weapon enchant and Windfury's overwrite each other on a melee's weapon.
        new("flametongue-totem", "Totem Langue de feu", BuffGroup.Totems, "shaman", [], ExcludedById: "windfury-totem"),
        new("blessing-of-kings", "Bénédiction des rois", BuffGroup.Totems, "paladin", [], Pool: "blessing"),
        new("blessing-of-might", "Bénédiction de puissance", BuffGroup.Totems, "paladin", [], Pool: "blessing"),
        new("blessing-of-wisdom", "Bénédiction de sagesse", BuffGroup.Totems, "paladin", [], Pool: "blessing"),
        new("blessing-of-salvation", "Salut collectif", BuffGroup.Totems, "paladin", []),

        new("sunder-armor", "Fracasser armure", BuffGroup.Debuffs, "warrior", []),
        new("expose-armor", "Exposer l’armure", BuffGroup.Debuffs, "rogue", []),
        new("faerie-fire", "Lucioles", BuffGroup.Debuffs, "druid", ["druid-balance", "druid-feral-cat", "druid-feral-bear"]),
        new("curse-of-the-elements", "Malédiction des éléments", BuffGroup.Debuffs, "warlock", [], Pool: "curse"),
        new("curse-of-recklessness", "Malédiction de témérité", BuffGroup.Debuffs, "warlock", [], Pool: "curse"),
        new("hunters-mark", "Marque du chasseur", BuffGroup.Debuffs, "hunter", []),
        new("shadow-weaving", "Tissage de l’ombre", BuffGroup.Debuffs, "priest", ["priest-shadow"]),
        new("improved-scorch", "Brûlure améliorée", BuffGroup.Debuffs, "mage", ["mage-fire"]),
        new("judgement-of-the-crusader", "Jugement du Croisé", BuffGroup.Debuffs, "paladin", ["paladin-protection", "paladin-retribution"]),
        new("demoralizing-shout", "Cri démoralisant", BuffGroup.Debuffs, "warrior", ["warrior-protection"]),
        new("thunder-clap", "Coup de tonnerre", BuffGroup.Debuffs, "warrior", ["warrior-protection"]),

        new("innervate", "Innervation", BuffGroup.Utility, "druid", []),
        new("rebirth", "Renaissance", BuffGroup.Utility, "druid", []),
        new("soulstone-and-summoning", "Pierre d’âme et invocation", BuffGroup.Utility, "warlock", []),
        new("fear-ward", "Gardien de peur", BuffGroup.Utility, "priest", []),
        new("power-infusion", "Infusion de puissance", BuffGroup.Utility, "priest", ["priest-discipline"]),
    ];

    private static readonly Dictionary<string, Spec> SpecsById = Classes.SelectMany(c => c.Specs).ToDictionary(s => s.Id);

    public static Spec? FindSpec(string id) => SpecsById.GetValueOrDefault(id);

    public static Spec GetSpec(string id) => FindSpec(id) ?? throw new KeyNotFoundException($"Spec {id} is not in the catalogue");

    public static Raid? FindRaid(string id) => Raids.FirstOrDefault(r => r.Id == id);

    private static GameClass Class(string id, string name, params (string Id, string Name, Role Role, string Icon)[] specs) =>
        new(id, name, [.. specs.Select(s => new Spec($"{id}-{s.Id}", id, s.Name, s.Role, s.Icon))]);
}
