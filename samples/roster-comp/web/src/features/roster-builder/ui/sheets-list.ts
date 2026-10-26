import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlayerDto } from '../../../api/models/player-dto';
import { Button } from '../../core/ui/button';
import { Icon } from './icon';
import { RankTag } from './rank-tag';
import { SpecIcon } from './spec-icon';
import { SpecIndex, classOfPlayer, specLabel } from '../utils/roster-view';

// The sheets as a guild list: each pseudo in its class color, each choice as its rank, its spec's icon and
// « [Classe · Spé] » in the rank's color; a row drags onto a place of the composition, or « Placer » moves it by keyboard.
@Component({
  selector: 'app-sheets-list',
  imports: [TranslatePipe, Button, Icon, RankTag, SpecIcon],
  template: `
    <ul>
      @for (player of players(); track player.id) {
        <li [attr.draggable]="!isPending()" (dragstart)="onDragStart($event, player)" (dragend)="dragEnded.emit()">
          <span class="text">
            <b class="pseudo" [style.color]="'var(--class-' + classOf(player) + ')'">{{ player.pseudo }}</b>
            <span class="chips">
              @for (choice of player.choices; track choice.specId) {
                <span class="chip">
                  <app-rank-tag [rank]="choice.rank" />
                  @if (specs().get(choice.specId); as info) {
                    <app-spec-icon [icon]="info.spec.icon" [classId]="info.gameClass.id" [label]="info.gameClass.name + ' ' + info.spec.name" [isSmall]="true" />
                  }
                  <span class="link" [style.color]="'var(--tier-' + choice.rank.toLowerCase() + ')'">[{{ label(choice.specId) }}]</span>
                </span>
              }
            </span>
          </span>
          <span class="row-actions">
            <button appButton variant="ghost" [disabled]="isPending()" [attr.aria-label]="'rosterBuilder.sheets.placeLabel' | translate: { pseudo: player.pseudo }"
              (click)="placeRequested.emit(player)"><app-icon name="place" /></button>
            <button appButton variant="ghost" [disabled]="isPending()" [attr.aria-label]="'rosterBuilder.sheets.edit' | translate: { pseudo: player.pseudo }"
              (click)="edit.emit(player)"><app-icon name="edit" /></button>
            <button appButton variant="ghost" [disabled]="isPending()" [attr.aria-label]="'rosterBuilder.sheets.delete' | translate: { pseudo: player.pseudo }"
              (click)="remove.emit(player)"><app-icon name="trash" /></button>
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    li {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px;
      cursor: grab;
      border-bottom: var(--border-width) solid color-mix(in srgb, var(--border) 60%, transparent);
    }
    li:nth-child(odd) {
      background: color-mix(in srgb, var(--text) 3%, transparent);
    }
    li:hover {
      background: color-mix(in srgb, var(--gold) 8%, transparent);
    }
    .text {
      flex: 1 1 120px;
      min-width: 0;
      display: grid;
      gap: 3px;
    }
    .pseudo {
      font-size: 1.05em;
      font-weight: 400;
      text-shadow: var(--outline);
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .link {
      font-size: 0.9em;
    }
    .row-actions {
      display: flex;
      flex: none;
    }
    .row-actions button {
      padding: 5px 6px;
    }
  `,
})
export class SheetsList {
  readonly players = input.required<PlayerDto[]>();
  readonly specs = input.required<SpecIndex>();
  readonly isPending = input(false);
  readonly edit = output<PlayerDto>();
  readonly remove = output<PlayerDto>();
  readonly placeRequested = output<PlayerDto>();
  readonly dragStarted = output<number>();
  readonly dragEnded = output();

  protected classOf(player: PlayerDto): string {
    return classOfPlayer(player, this.specs());
  }

  protected label(specId: string): string {
    return specLabel(this.specs().get(specId));
  }

  protected onDragStart(event: DragEvent, player: PlayerDto): void {
    event.dataTransfer?.setData('text/plain', String(player.id));
    this.dragStarted.emit(player.id);
  }
}
