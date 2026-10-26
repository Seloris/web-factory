import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlacementDto } from '../../../api/models/placement-dto';
import { PlayerDto } from '../../../api/models/player-dto';
import { Role } from '../../../api/models/role';
import { SavePlayerCommand } from '../../../api/models/save-player-command';
import { Button } from '../../core/ui/button';
import { ConfirmDialog } from '../../core/ui/confirm-dialog';
import { Dialog } from '../../core/ui/dialog';
import { EmptyState } from '../../core/ui/empty-state';
import { ErrorMessage } from '../../core/ui/error-message';
import { LoadingState } from '../../core/ui/loading-state';
import { PageTitle } from '../../core/ui/page-title';
import { ProblemDetails } from '../../core/utils/problem-details';
import { RosterBuilderStore } from '../data-access/roster-builder.store';
import { BuffsRecap } from '../ui/buffs-recap';
import { CompositionToolbar } from '../ui/composition-toolbar';
import { Frame } from '../ui/frame';
import { FillDialog } from '../ui/fill-dialog';
import { Icon } from '../ui/icon';
import { PlaceDialog } from '../ui/place-dialog';
import { PlaceDrop, RosterBoard } from '../ui/roster-board';
import { SheetForm } from '../ui/sheet.form';
import { SheetsList } from '../ui/sheets-list';
import { Message, RANKS, ROLES, indexSpecs, plural, roleViews, rolesOfPlayer, warningsOf } from '../utils/roster-view';

const MAX_SHEETS = 20;

// The roster builder: the composition's toolbar, the sheets, the generated roster and its buffs recap.
@Component({
  selector: 'app-roster-builder-page',
  imports: [
    TranslatePipe,
    Button,
    ConfirmDialog,
    Dialog,
    EmptyState,
    ErrorMessage,
    LoadingState,
    PageTitle,
    BuffsRecap,
    CompositionToolbar,
    FillDialog,
    Frame,
    Icon,
    PlaceDialog,
    RosterBoard,
    SheetForm,
    SheetsList,
  ],
  templateUrl: './roster-builder.page.html',
  styles: `
    :host {
      display: grid;
      gap: 22px;
      /* the page width is the content's: the padding comes on top */
      box-sizing: content-box;
      max-width: var(--page-width);
      margin: 0 auto;
      padding: 36px 48px;
    }
    header {
      text-align: center;
    }
    h1 {
      color: var(--gold);
      font-size: 32px;
      text-shadow:
        var(--outline),
        0 0 22px color-mix(in srgb, var(--gold) 25%, transparent);
    }
    header p {
      margin: 8px 0 0;
      color: var(--text-muted);
    }
    /* the gold rule under the title, a gem in its middle */
    header::after {
      content: '';
      display: block;
      width: 360px;
      max-width: 80%;
      height: 9px;
      margin: 10px auto 0;
      background:
        radial-gradient(circle, var(--gold) 0 3px, transparent 3.5px) center / 9px 9px no-repeat,
        linear-gradient(90deg, transparent, var(--gold-dim) 30%, var(--gold-dim) 70%, transparent) center / 100% 1px no-repeat;
    }
    .cols {
      display: grid;
      grid-template-columns: 430px minmax(0, 1fr);
      grid-template-areas: 'sheets roster' 'buffs buffs';
      gap: 22px;
      align-items: start;
    }
    .sheets {
      grid-area: sheets;
    }
    .sheets.is-drop {
      outline: 2px dashed var(--gold);
      outline-offset: 4px;
    }
    .roster {
      grid-area: roster;
    }
    .buffs {
      grid-area: buffs;
    }
    .gold {
      color: var(--gold);
    }
    .state {
      display: grid;
      justify-items: center;
      gap: 12px;
      text-align: center;
    }
    .failed {
      padding: 22px 8px;
    }
    @media (max-width: 1024px) {
      :host {
        padding: 24px 20px;
      }
      .cols {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'roster' 'buffs' 'sheets';
      }
    }
    @media (max-width: 640px) {
      :host {
        gap: 16px;
        padding: 18px 14px;
      }
      h1 {
        font-size: 24px;
      }
      .cols {
        gap: 16px;
      }
    }
  `,
})
export class RosterBuilderPage {
  protected readonly store = inject(RosterBuilderStore);
  protected readonly maxSheets = MAX_SHEETS;
  protected readonly plural = plural;

  protected readonly specs = computed(() => indexSpecs(this.store.catalogue.data()));
  protected readonly classes = computed(() => this.store.catalogue.data()?.classes ?? []);
  protected readonly players = computed(() => this.store.players.data() ?? []);
  protected readonly raidSize = computed(() => this.store.raid()?.size ?? 0);
  protected readonly views = computed(() => {
    const roster = this.store.roster();
    return roster ? roleViews(roster, this.players(), this.specs(), this.raidSize()) : [];
  });
  protected readonly warnings = computed(() => {
    const roster = this.store.roster();
    return roster?.isGenerated ? warningsOf(this.views(), roster, this.players(), this.players().length, this.raidSize()) : [];
  });
  protected readonly lockedByRole = computed(() => {
    const placements = this.store.roster()?.placements ?? [];
    return Object.fromEntries(ROLES.map((role) => [role, placements.filter((p) => p.role === role && p.isLocked).length])) as Record<Role, number>;
  });

  // « 20 / 20 places · 19 sur leur choix S · 1 sur un choix A · 2 verrouillés »
  protected readonly rosterSub = computed<Message[]>(() => {
    const roster = this.store.roster();
    if (!roster?.isGenerated) {
      return [];
    }
    const placements = roster.placements;
    const places = roster.tanks + roster.heals + roster.dps;
    const ranks = RANKS.map((rank) => ({ rank, count: placements.filter((p) => p.rank === rank).length }))
      .filter((r) => r.count > 0)
      .map((r) => ({ key: plural('rosterBuilder.roster.onRank', r.count), params: r }));
    const locked = placements.filter((p) => p.isLocked).length;
    return [
      { key: 'rosterBuilder.roster.places', params: { count: placements.length, places } },
      ...ranks,
      ...(locked > 0 ? [{ key: plural('rosterBuilder.roster.locked', locked), params: { count: locked } }] : []),
    ];
  });
  protected readonly buffsCount = computed(() => {
    const buffs = this.store.roster()?.buffs ?? [];
    const covered = buffs.filter((b) => b.givers.length > 0).length;
    return { covered, total: buffs.length, missing: buffs.length - covered };
  });

  // Drag and drop: the dragged player, from a place or from the sheets, and the roles their sheet can take.
  protected readonly draggedId = signal<number | null>(null);
  protected readonly isDraggedFromRoster = signal(false);
  protected readonly acceptedRoles = computed<ReadonlySet<Role>>(() => {
    const player = this.players().find((p) => p.id === this.draggedId());
    return player ? rolesOfPlayer(player, this.specs()) : new Set();
  });
  protected readonly isOverSheets = signal(false);

  // The dialogs: the sheet edited (null for a new one), the sheet to delete, the player to place.
  protected readonly editing = signal<{ player: PlayerDto | null } | null>(null);
  protected readonly sheetProblem = signal<ProblemDetails | null>(null);
  protected readonly deleting = signal<PlayerDto | null>(null);
  protected readonly deleteFailed = signal(false);
  protected readonly placingId = signal<number | null>(null);
  protected readonly placing = computed(() => this.players().find((p) => p.id === this.placingId()) ?? null);
  protected readonly fillingRole = signal<Role | null>(null);

  protected openSheet(player: PlayerDto | null): void {
    this.sheetProblem.set(null);
    this.editing.set({ player });
  }

  protected async saveSheet(command: SavePlayerCommand): Promise<void> {
    const problem = await this.store.actions.savePlayer(this.editing()?.player?.id ?? null, command);
    this.sheetProblem.set(problem);
    if (!problem) {
      this.editing.set(null);
    }
  }

  protected askDelete(player: PlayerDto): void {
    this.deleteFailed.set(false);
    this.deleting.set(player);
  }

  protected async confirmDelete(): Promise<void> {
    const player = this.deleting();
    if (player && (await this.store.actions.deletePlayer(player.id))) {
      this.deleting.set(null);
    } else {
      this.deleteFailed.set(true);
    }
  }

  protected toggleLock(placement: PlacementDto): void {
    void this.store.actions.setLock(placement.playerId, !placement.isLocked);
  }

  // A drop while a move is in flight is ignored: two answers could otherwise land out of order.
  protected onDrop(drop: PlaceDrop): void {
    const playerId = this.draggedId();
    this.endDrag();
    if (playerId !== null && playerId !== drop.targetPlayerId && !this.store.isPending()) {
      void this.store.actions.place(playerId, drop.role, drop.targetPlayerId);
    }
  }

  protected startDrag(playerId: number, isFromRoster: boolean): void {
    this.draggedId.set(playerId);
    this.isDraggedFromRoster.set(isFromRoster);
  }

  protected onSheetsDragOver(event: DragEvent): void {
    if (this.isDraggedFromRoster()) {
      event.preventDefault();
      this.isOverSheets.set(true);
    }
  }

  // A placed player dragged from their place onto the sheets leaves the roster; a sheet dropped back on the list does nothing.
  protected onSheetsDrop(event: DragEvent): void {
    event.preventDefault();
    const playerId = this.draggedId();
    const isFromRoster = this.isDraggedFromRoster();
    this.endDrag();
    if (playerId !== null && isFromRoster && !this.store.isPending()) {
      void this.store.actions.remove(playerId);
    }
  }

  protected endDrag(): void {
    this.draggedId.set(null);
    this.isDraggedFromRoster.set(false);
    this.isOverSheets.set(false);
  }

  protected async placeFromDialog(drop: PlaceDrop): Promise<void> {
    const playerId = this.placingId();
    if (playerId !== null) {
      await this.store.actions.place(playerId, drop.role, drop.targetPlayerId);
      this.placingId.set(null);
    }
  }

  protected async fillFromDialog(playerId: number): Promise<void> {
    const role = this.fillingRole();
    if (role !== null) {
      await this.store.actions.place(playerId, role, null);
      this.fillingRole.set(null);
    }
  }

  protected async removeFromDialog(): Promise<void> {
    const playerId = this.placingId();
    if (playerId !== null) {
      await this.store.actions.remove(playerId);
      this.placingId.set(null);
    }
  }
}
