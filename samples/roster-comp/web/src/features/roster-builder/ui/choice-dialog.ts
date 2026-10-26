import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChoiceDto } from '../../../api/models/choice-dto';
import { PlayerDto } from '../../../api/models/player-dto';
import { Role } from '../../../api/models/role';
import { Button } from '../../core/ui/button';
import { Dialog } from '../../core/ui/dialog';
import { RankTag } from './rank-tag';
import { SpecIcon } from './spec-icon';
import { SpecIndex, specLabel } from '../utils/roster-view';

// The class a player plays on the place they are put on, among their choices of its role, best-ranked first.
@Component({
  selector: 'app-choice-dialog',
  imports: [TranslatePipe, Button, Dialog, RankTag, SpecIcon],
  template: `
    <app-dialog [isOpen]="true" [isPending]="isPending()" (cancelled)="cancelled.emit()"
      [title]="'rosterBuilder.choiceDialog.title' | translate: { pseudo: player().pseudo, role: ('rosterBuilder.roles.one.' + role() | translate) }">
      <div class="choices">
        @for (choice of choices(); track choice.specId) {
          <button appButton variant="quiet" [disabled]="isPending()" (click)="chosen.emit(choice.specId)">
            <app-rank-tag [rank]="choice.rank" />
            @if (specs().get(choice.specId); as info) {
              <app-spec-icon [icon]="info.spec.icon" [classId]="info.gameClass.id" [label]="info.gameClass.name + ' ' + info.spec.name" [isSmall]="true" />
            }
            <span [style.color]="'var(--tier-' + choice.rank.toLowerCase() + ')'">[{{ label(choice.specId) }}]</span>
          </button>
        }
      </div>
      <div class="actions">
        <button appButton variant="quiet" [disabled]="isPending()" (click)="cancelled.emit()">{{ 'rosterBuilder.choiceDialog.cancel' | translate }}</button>
      </div>
    </app-dialog>
  `,
  styles: `
    .choices {
      display: grid;
      gap: 6px;
    }
    .choices button {
      justify-content: flex-start;
      gap: 8px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
    }
  `,
})
export class ChoiceDialog {
  readonly player = input.required<PlayerDto>();
  readonly role = input.required<Role>();
  readonly choices = input.required<ChoiceDto[]>();
  readonly specs = input.required<SpecIndex>();
  readonly isPending = input(false);
  readonly chosen = output<string>();
  readonly cancelled = output();

  protected label(specId: string): string {
    return specLabel(this.specs().get(specId));
  }
}
