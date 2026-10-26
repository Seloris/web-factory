import { CatalogueDto } from '../../../api/models/catalogue-dto';
import { ChoiceDto } from '../../../api/models/choice-dto';
import { ClassDto } from '../../../api/models/class-dto';
import { PlacementDto } from '../../../api/models/placement-dto';
import { PlayerDto } from '../../../api/models/player-dto';
import { Rank } from '../../../api/models/rank';
import { Role } from '../../../api/models/role';
import { RosterDto } from '../../../api/models/roster-dto';
import { SpecDto } from '../../../api/models/spec-dto';

export const ROLES: readonly Role[] = ['Tank', 'Heal', 'Dps'];
export const RANKS: readonly Rank[] = ['S', 'A', 'B', 'C'];

export interface SpecInfo {
  spec: SpecDto;
  gameClass: ClassDto;
}

// Every spec by id, with its class: what a choice, a place or a buff giver shows.
export type SpecIndex = ReadonlyMap<string, SpecInfo>;

export function indexSpecs(catalogue: CatalogueDto | undefined): SpecIndex {
  return new Map((catalogue?.classes ?? []).flatMap((gameClass) => gameClass.specs.map((spec) => [spec.id, { spec, gameClass }] as const)));
}

// « Guerrier · Protection »
export function specLabel(info: SpecInfo | undefined): string {
  return info ? `${info.gameClass.name} · ${info.spec.name}` : '';
}

// The class whose color a sheet's pseudo takes: its first choice's.
export function classOfPlayer(player: PlayerDto, specs: SpecIndex): string {
  return specs.get(player.choices[0]?.specId ?? '')?.gameClass.id ?? '';
}

export function rolesOfPlayer(player: PlayerDto, specs: SpecIndex): Set<Role> {
  return new Set(player.choices.map((c) => specs.get(c.specId)?.spec.role).filter((r): r is Role => r !== undefined));
}

// A player's choices of a role, best-ranked first, in their sheet's order between equal ranks.
export function choicesOf(player: PlayerDto, role: Role, specs: SpecIndex): ChoiceDto[] {
  return player.choices.filter((c) => specs.get(c.specId)?.spec.role === role).sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
}

export function placesOf(roster: RosterDto, role: Role): number {
  return role === 'Tank' ? roster.tanks : role === 'Heal' ? roster.heals : roster.dps;
}

export interface RoleView {
  role: Role;
  places: number;
  placements: PlacementDto[];
  emptyCount: number;
  // Why its places are empty: a sheet left out could take one (a move by hand), none can, or there are fewer sheets than places.
  emptyReason: 'open' | 'noSheet' | 'notEnoughSheets';
}

export function roleViews(roster: RosterDto, players: PlayerDto[], specs: SpecIndex, raidSize: number): RoleView[] {
  const placed = new Set(roster.placements.map((p) => p.playerId));
  const leftOut = players.filter((p) => !placed.has(p.id));
  return ROLES.map((role) => {
    const places = placesOf(roster, role);
    const placements = roster.placements.filter((p) => p.role === role);
    const reason = leftOut.some((p) => rolesOfPlayer(p, specs).has(role))
      ? 'open'
      : // The DPS are the rest: their empty places come from too few sheets when there are fewer sheets than places.
        role === 'Dps' && players.length < raidSize
        ? 'notEnoughSheets'
        : 'noSheet';
    return { role, places, placements, emptyCount: Math.max(0, places - placements.length), emptyReason: reason };
  });
}

export interface Message {
  key: string;
  params: Record<string, unknown>;
}

export function plural(key: string, count: number): string {
  return `${key}.${count > 1 ? 'many' : 'one'}`;
}

// The shortfalls of a generated roster: a role short of players and why, empty places for want of sheets, the sheets left out.
export function warningsOf(roles: RoleView[], roster: RosterDto, players: PlayerDto[], sheetsCount: number, raidSize: number): Message[] {
  const warnings: Message[] = roles
    .filter((r) => r.emptyCount > 0)
    .map((r) =>
      r.emptyReason === 'notEnoughSheets'
        ? { key: plural('rosterBuilder.warnings.notEnoughSheets', r.emptyCount), params: { count: r.emptyCount, sheets: sheetsCount, size: raidSize } }
        : { key: plural(`rosterBuilder.warnings.${r.emptyReason === 'open' ? 'open' : 'short'}${r.role}`, r.emptyCount), params: { count: r.emptyCount } },
    );
  const unplaced = roster.unplacedPlayerIds.map((id) => players.find((p) => p.id === id)?.pseudo).filter((p) => p !== undefined);
  if (unplaced.length > 0) {
    warnings.push({ key: plural('rosterBuilder.warnings.unplaced', unplaced.length), params: { names: unplaced.join(', ') } });
  }
  return warnings;
}

// « 1er choix », « 2e choix »
export function choiceLabel(position: number): Message {
  return position === 1 ? { key: 'rosterBuilder.place.firstChoice', params: {} } : { key: 'rosterBuilder.place.nthChoice', params: { n: position } };
}
