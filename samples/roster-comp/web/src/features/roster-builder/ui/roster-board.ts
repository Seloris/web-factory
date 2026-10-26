import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlacementDto } from '../../../api/models/placement-dto';
import { Role } from '../../../api/models/role';
import { Icon } from './icon';
import { RankTag } from './rank-tag';
import { SpecIcon } from './spec-icon';
import { Message, RoleView, SpecIndex, choiceLabel, specLabel } from '../utils/roster-view';

export interface PlaceDrop {
  role: Role;
  targetPlayerId: number | null;
}

// The roles and their places as unit frames: tanks and heals side by side, the DPS below on two columns; the warnings above.
// A place accepts a dragged player whose sheet has a choice of its role (`acceptedRoles`); each one has its lock and « Placer ».
@Component({
  selector: 'app-roster-board',
  imports: [TranslatePipe, Icon, RankTag, SpecIcon],
  templateUrl: './roster-board.html',
  styles: `
    :host {
      display: grid;
      gap: 14px;
    }
    .warn {
      display: grid;
      justify-items: center;
      gap: 2px;
      padding: 4px 0;
      text-align: center;
    }
    .warn p {
      margin: 0;
      color: var(--need);
      font-size: 1.1em;
      text-shadow: var(--outline);
    }
    .roles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .role {
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .role.is-dps {
      grid-column: 1 / -1;
    }
    .rh {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--gold);
    }
    h3 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--gold);
      text-shadow: var(--outline);
    }
    .cnt {
      margin-left: auto;
      font-size: 0.9em;
      color: var(--text-muted);
      font-family: var(--font-display);
      font-variant-numeric: lining-nums tabular-nums;
    }
    .cnt.is-short {
      color: var(--need);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 2px;
    }
    .is-dps ul {
      grid-template-columns: 1fr 1fr;
      column-gap: 8px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      min-height: 30px;
      padding: 2px 4px 2px 2px;
      color: var(--bar-text);
      text-shadow: var(--outline);
      background: var(--bar-shade), color-mix(in srgb, var(--cls, var(--surface-2)) 62%, var(--bg));
      border: var(--border-width) solid var(--frame-line);
      cursor: grab;
    }
    li.is-locked {
      box-shadow: 0 0 0 1px var(--gold), inset 0 0 10px color-mix(in srgb, var(--gold) 55%, transparent);
    }
    li.is-empty .place {
      color: var(--text-muted);
    }
    li.is-empty {
      color: var(--text-muted);
      font-style: italic;
      text-shadow: none;
      cursor: default;
      background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--need) 9%, transparent) 6px 12px), var(--control-bg);
      border-style: dashed;
      border-color: var(--border);
    }
    li.is-target {
      outline: 2px solid var(--gold);
      outline-offset: -2px;
    }
    .text {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .spec {
      margin-left: 5px;
      font-size: 0.86em;
      opacity: 0.85;
    }
    .choice {
      width: 58px;
      flex: none;
      font-size: 0.78em;
      opacity: 0.8;
      font-family: var(--font-display);
      font-variant-numeric: lining-nums tabular-nums;
    }
    .lock,
    .place {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      flex: none;
      padding: 0;
      cursor: pointer;
      color: var(--bar-text);
      background: transparent;
      border: var(--border-width) solid transparent;
      border-radius: var(--badge-radius);
      opacity: 0.6;
      transition:
        opacity 0.12s,
        background-color 0.12s;
    }
    .lock:hover:not(:disabled),
    .place:hover:not(:disabled) {
      opacity: 1;
      background: color-mix(in srgb, var(--bg) 40%, transparent);
    }
    .lock:focus-visible,
    .place:focus-visible {
      opacity: 1;
      outline: 2px solid var(--focus);
    }
    .lock[aria-pressed='true'] {
      opacity: 1;
      color: var(--gold);
      border-color: var(--gold);
      background: color-mix(in srgb, var(--bg) 70%, transparent);
    }
    .lock:disabled,
    .place:disabled {
      cursor: default;
    }
    .pad {
      width: 24px;
      flex: none;
    }
    @media (max-width: 640px) {
      .roles,
      .is-dps ul {
        grid-template-columns: minmax(0, 1fr);
      }
      .choice {
        display: none;
      }
    }
  `,
})
export class RosterBoard {
  readonly roles = input.required<RoleView[]>();
  readonly specs = input.required<SpecIndex>();
  readonly warnings = input.required<Message[]>();
  // The roles a dragged player can take; empty while nothing is dragged.
  readonly acceptedRoles = input.required<ReadonlySet<Role>>();
  readonly isPending = input(false);
  readonly lockToggled = output<PlacementDto>();
  readonly placeRequested = output<number>();
  readonly dropped = output<PlaceDrop>();
  readonly fillRequested = output<Role>();
  readonly dragStarted = output<number>();
  readonly dragEnded = output();

  // The place under the dragged player: `{role}` for an empty one, `{role}-{playerId}` for an occupied one.
  protected readonly target = signal<string | null>(null);
  protected readonly choiceLabel = choiceLabel;

  protected label(specId: string): string {
    return specLabel(this.specs().get(specId));
  }

  protected classOf(specId: string): string {
    return `var(--class-${this.specs().get(specId)?.gameClass.id ?? ''})`;
  }

  protected emptyPlaces(view: RoleView): number[] {
    return Array.from({ length: view.emptyCount }, (_, i) => i);
  }

  protected onDragStart(event: DragEvent, placement: PlacementDto): void {
    event.dataTransfer?.setData('text/plain', String(placement.playerId));
    this.dragStarted.emit(placement.playerId);
  }

  protected onDragOver(event: DragEvent, role: Role, key: string): void {
    if (this.acceptedRoles().has(role)) {
      event.preventDefault();
      this.target.set(key);
    }
  }

  protected onDrop(event: DragEvent, role: Role, targetPlayerId: number | null): void {
    event.preventDefault();
    this.target.set(null);
    this.dropped.emit({ role, targetPlayerId });
  }
}
