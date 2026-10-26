import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlayerDto } from '../../../api/models/player-dto';
import { Button } from '../../core/ui/button';
import { Dialog } from '../../core/ui/dialog';
import { Icon } from './icon';
import { PlaceDrop } from './roster-board';
import { RoleView, SpecIndex, rolesOfPlayer } from '../utils/roster-view';

// « Placer », the drag and drop by keyboard: for each role the player has a choice of,
// a free place of it and each of its occupants to replace; out of the roster when the player is placed.
@Component({
  selector: 'app-place-dialog',
  imports: [TranslatePipe, Button, Dialog, Icon],
  template: `
    <app-dialog [isOpen]="true" [title]="'rosterBuilder.placeDialog.title' | translate: { pseudo: player().pseudo }"
      [isPending]="isPending()" (cancelled)="cancelled.emit()">
      @for (view of roles(); track view.role) {
        <section>
          <h3><app-icon [name]="view.role" />{{ 'rosterBuilder.roles.' + view.role | translate }}</h3>
          <div class="moves">
            @if (view.emptyCount > 0 && !isIn(view)) {
              <button appButton variant="quiet" [disabled]="isPending()" (click)="chosen.emit({ role: view.role, targetPlayerId: null })">
                {{ 'rosterBuilder.placeDialog.free' | translate: { role: ('rosterBuilder.roles.one.' + view.role | translate) } }}
              </button>
            }
            @for (occupant of view.placements; track occupant.playerId) {
              @if (occupant.playerId !== player().id) {
                <button appButton variant="quiet" [disabled]="isPending()" (click)="chosen.emit({ role: view.role, targetPlayerId: occupant.playerId })">
                  {{ 'rosterBuilder.placeDialog.instead' | translate: { pseudo: occupant.pseudo } }}
                </button>
              } @else {
                <p class="here">{{ 'rosterBuilder.placeDialog.here' | translate }}</p>
              }
            }
          </div>
        </section>
      } @empty {
        <p class="here">{{ 'rosterBuilder.placeDialog.noRole' | translate }}</p>
      }
      <div class="actions">
        @if (isPlaced()) {
          <button appButton variant="danger" [disabled]="isPending()" (click)="removed.emit()">{{ 'rosterBuilder.placeDialog.remove' | translate }}</button>
        }
        <button appButton variant="quiet" [disabled]="isPending()" (click)="cancelled.emit()">{{ 'rosterBuilder.placeDialog.cancel' | translate }}</button>
      </div>
    </app-dialog>
  `,
  styles: `
    section {
      display: grid;
      gap: 6px;
    }
    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--gold);
      text-shadow: var(--outline);
    }
    .moves {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .here {
      margin: 0;
      align-self: center;
      color: var(--text-muted);
      font-style: italic;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }
  `,
})
export class PlaceDialog {
  readonly player = input.required<PlayerDto>();
  readonly views = input.required<RoleView[]>();
  readonly specs = input.required<SpecIndex>();
  readonly isPending = input(false);
  readonly chosen = output<PlaceDrop>();
  readonly removed = output();
  readonly cancelled = output();

  protected readonly roles = computed(() => {
    const roles = rolesOfPlayer(this.player(), this.specs());
    return this.views().filter((v) => roles.has(v.role));
  });
  protected readonly isPlaced = computed(() => this.views().some((v) => this.isIn(v)));

  protected isIn(view: RoleView): boolean {
    return view.placements.some((p) => p.playerId === this.player().id);
  }
}
