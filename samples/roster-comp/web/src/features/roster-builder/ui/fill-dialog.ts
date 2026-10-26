import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlayerDto } from '../../../api/models/player-dto';
import { Role } from '../../../api/models/role';
import { RosterDto } from '../../../api/models/roster-dto';
import { Button } from '../../core/ui/button';
import { Dialog } from '../../core/ui/dialog';
import { SpecIndex, classOfPlayer, rolesOfPlayer } from '../utils/roster-view';

// « Placer » on an empty place: the sheets with a choice of its role, those left out first, each one to put there.
@Component({
  selector: 'app-fill-dialog',
  imports: [TranslatePipe, Button, Dialog],
  template: `
    <app-dialog [isOpen]="true" [title]="'rosterBuilder.fillDialog.title' | translate: { role: ('rosterBuilder.roles.one.' + role() | translate) }"
      [isPending]="isPending()" (cancelled)="cancelled.emit()">
      @if (candidates().length > 0) {
        <div class="moves">
          @for (candidate of candidates(); track candidate.player.id) {
            <button appButton variant="quiet" [disabled]="isPending()" (click)="chosen.emit(candidate.player.id)">
              <span [style.color]="candidate.color">{{ candidate.player.pseudo }}</span>
              @if (candidate.isPlaced) {
                <span class="note">{{ 'rosterBuilder.fillDialog.placed' | translate }}</span>
              }
            </button>
          }
        </div>
      } @else {
        <p class="note">{{ 'rosterBuilder.fillDialog.none' | translate }}</p>
      }
      <div class="actions">
        <button appButton variant="quiet" [disabled]="isPending()" (click)="cancelled.emit()">{{ 'rosterBuilder.placeDialog.cancel' | translate }}</button>
      </div>
    </app-dialog>
  `,
  styles: `
    .moves {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .note {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.85em;
      font-style: italic;
    }
    .moves .note {
      margin-left: 6px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class FillDialog {
  readonly role = input.required<Role>();
  readonly players = input.required<PlayerDto[]>();
  readonly roster = input.required<RosterDto>();
  readonly specs = input.required<SpecIndex>();
  readonly isPending = input(false);
  readonly chosen = output<number>();
  readonly cancelled = output();

  protected readonly candidates = computed(() => {
    const placements = this.roster().placements;
    return this.players()
      .filter((p) => rolesOfPlayer(p, this.specs()).has(this.role()))
      .filter((p) => !placements.some((x) => x.playerId === p.id && x.role === this.role()))
      .map((player) => ({
        player,
        isPlaced: placements.some((x) => x.playerId === player.id),
        color: `var(--class-${classOfPlayer(player, this.specs())})`,
      }))
      .sort((a, b) => Number(a.isPlaced) - Number(b.isPlaced));
  });
}
