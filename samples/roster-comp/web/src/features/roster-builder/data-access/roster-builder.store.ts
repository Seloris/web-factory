import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { Api } from '../../../api/api';
import { createPlayer } from '../../../api/fn/players/create-player';
import { deletePlayer } from '../../../api/fn/players/delete-player';
import { getPlayers } from '../../../api/fn/players/get-players';
import { updatePlayer } from '../../../api/fn/players/update-player';
import { getCatalogue } from '../../../api/fn/catalogue/get-catalogue';
import { generateRoster } from '../../../api/fn/roster/generate-roster';
import { getRoster } from '../../../api/fn/roster/get-roster';
import { placePlayer } from '../../../api/fn/roster/place-player';
import { removePlacement } from '../../../api/fn/roster/remove-placement';
import { setPlacementLock } from '../../../api/fn/roster/set-placement-lock';
import { unlockAll } from '../../../api/fn/roster/unlock-all';
import { updateComposition } from '../../../api/fn/roster/update-composition';
import { Role } from '../../../api/models/role';
import { RosterDto } from '../../../api/models/roster-dto';
import { SavePlayerCommand } from '../../../api/models/save-player-command';
import { UpdateCompositionCommand } from '../../../api/models/update-composition-command';
import { ProblemDetails, problemOf } from '../../core/utils/problem-details';
import { resourceState } from '../../core/utils/resource-state';

// The codes of a refused roster move the page explains; any other failure reads as a generic error.
const KNOWN_CODES = ['role_not_chosen', 'spec_not_chosen', 'role_full', 'below_locked_players', 'composition_too_large', 'not_found'];

@Injectable({ providedIn: 'root' })
export class RosterBuilderStore {
  private readonly api = inject(Api);

  readonly catalogue = resourceState(() => this.api.invoke(getCatalogue));
  readonly players = resourceState(() => this.api.invoke(getPlayers));
  readonly loadedRoster = resourceState(() => this.api.invoke(getRoster));

  // The roster as loaded, then as each move answers it.
  readonly #roster = linkedSignal<RosterDto | undefined>(() => this.loadedRoster.data());
  readonly roster = this.#roster.asReadonly();

  readonly #isPending = signal(false);
  readonly isPending = this.#isPending.asReadonly();

  // The i18n key of the last refused move, until the next one.
  readonly #moveError = signal<string | null>(null);
  readonly moveError = this.#moveError.asReadonly();

  readonly raid = computed(() => {
    const roster = this.roster();
    return this.catalogue.data()?.raids.find((r) => r.id === roster?.raidId);
  });

  readonly actions = {
    setComposition: (command: UpdateCompositionCommand) => this.#move(() => this.api.invoke(updateComposition, { body: command })),
    generate: () => this.#move(() => this.api.invoke(generateRoster)),
    unlockAll: () => this.#move(() => this.api.invoke(unlockAll)),
    setLock: (playerId: number, isLocked: boolean) =>
      this.#move(() => this.api.invoke(setPlacementLock, { playerId, body: { isLocked } })),
    place: (playerId: number, role: Role, targetPlayerId: number | null, specId: string | null = null) =>
      this.#move(() => this.api.invoke(placePlayer, { body: { playerId, role, targetPlayerId, specId } })),
    remove: (playerId: number) => this.#move(() => this.api.invoke(removePlacement, { playerId })),
    // Answers the refusal, for the sheet form to show by field; null once saved.
    savePlayer: async (id: number | null, command: SavePlayerCommand): Promise<ProblemDetails | null> => {
      this.#isPending.set(true);
      try {
        await (id === null
          ? this.api.invoke(createPlayer, { body: command })
          : this.api.invoke(updatePlayer, { id, body: command }));
        this.#refreshAfterSheetChange();
        return null;
      } catch (error) {
        return problemOf(error) ?? { status: 0 };
      } finally {
        this.#isPending.set(false);
      }
    },
    deletePlayer: async (id: number): Promise<boolean> => {
      this.#isPending.set(true);
      try {
        await this.api.invoke(deletePlayer, { id });
        this.#refreshAfterSheetChange();
        return true;
      } catch {
        return false;
      } finally {
        this.#isPending.set(false);
      }
    },
    retryPlayers: () => this.players.reload(),
    retryRoster: () => {
      this.catalogue.reload();
      this.loadedRoster.reload();
    },
  };

  // A sheet's change may free its place: the roster is read again with the sheets.
  #refreshAfterSheetChange(): void {
    this.players.reload();
    this.loadedRoster.reload();
  }

  async #move(call: () => Promise<RosterDto>): Promise<void> {
    this.#isPending.set(true);
    this.#moveError.set(null);
    try {
      this.#roster.set(await call());
    } catch (error) {
      const code = problemOf(error)?.code;
      // A player another session deleted: the sheets and the roster are read again.
      if (code === 'not_found') {
        this.#refreshAfterSheetChange();
      }
      this.#moveError.set(`rosterBuilder.errors.${code && KNOWN_CODES.includes(code) ? code : 'unknown'}`);
    } finally {
      this.#isPending.set(false);
    }
  }
}
