import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RaidDto } from '../../../api/models/raid-dto';
import { Role } from '../../../api/models/role';
import { UpdateCompositionCommand } from '../../../api/models/update-composition-command';
import { Button } from '../../core/ui/button';
import { Control } from '../../core/ui/control';
import { Field } from '../../core/ui/field';
import { Select } from '../../core/ui/select';
import { Icon } from './icon';
import { plural } from '../utils/roster-view';

// The raid, its tanks and heals with − and + steppers, the DPS as the rest, and the roster's actions.
// A stepper stops at the locked players of its role, and before the DPS places go below theirs.
@Component({
  selector: 'app-composition-toolbar',
  imports: [TranslatePipe, Button, Control, Field, Select, Icon],
  templateUrl: './composition-toolbar.html',
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px 20px;
      padding: var(--panel-pad);
      background: var(--panel-bg);
      border: var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
    }
    .raid {
      width: 260px;
    }
    .step {
      display: flex;
    }
    .step button {
      width: 30px;
      padding: 0;
    }
    .step button:first-child {
      border-radius: var(--radius-control) 0 0 var(--radius-control);
    }
    .step button:last-child {
      border-radius: 0 var(--radius-control) var(--radius-control) 0;
    }
    .step input {
      width: 44px;
      padding: 0;
      text-align: center;
      border-radius: 0;
      border-inline: 0;
    }
    .dps {
      display: grid;
      gap: 6px;
    }
    .label {
      font-size: var(--label-size);
      font-weight: var(--label-weight);
      text-transform: var(--label-transform);
      letter-spacing: var(--label-tracking);
      color: var(--label-color, var(--text-muted));
      text-shadow: var(--label-shadow, none);
    }
    output {
      display: flex;
      align-items: center;
      height: var(--control-h);
      padding: 0 4px;
      font-size: 1.15em;
    }
    .step input,
    output,
    .hint {
      font-family: var(--font-display);
      font-variant-numeric: lining-nums tabular-nums;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    .hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: 4px;
      font-size: 0.9em;
      color: var(--text-muted);
    }
    .hint app-icon {
      color: var(--gold-dim);
    }
    @media (max-width: 640px) {
      :host {
        --panel-pad: 14px;
        gap: 10px 12px;
      }
      .raid,
      .actions,
      .hint {
        width: 100%;
      }
      .actions {
        margin-left: 0;
      }
      .actions button {
        flex: 1;
      }
    }
  `,
})
export class CompositionToolbar {
  readonly raids = input.required<RaidDto[]>();
  readonly raidId = input.required<string>();
  readonly tanks = input.required<number>();
  readonly heals = input.required<number>();
  readonly dps = input.required<number>();
  readonly raidSize = input.required<number>();
  readonly lockedByRole = input.required<Record<Role, number>>();
  readonly isGenerated = input.required<boolean>();
  readonly canGenerate = input.required<boolean>();
  readonly isPending = input(false);
  readonly compositionChange = output<UpdateCompositionCommand>();
  readonly generate = output();
  readonly unlockAll = output();

  protected readonly lockedCount = computed(() => Object.values(this.lockedByRole()).reduce((sum, n) => sum + n, 0));
  protected readonly lockedKey = computed(() => plural('rosterBuilder.toolbar.locked', this.lockedCount()));

  protected canStep(tanksDelta: number, healsDelta: number): boolean {
    const tanks = this.tanks() + tanksDelta;
    const heals = this.heals() + healsDelta;
    const locked = this.lockedByRole();
    return !this.isPending() && tanks >= locked.Tank && heals >= locked.Heal && this.raidSize() - tanks - heals >= locked.Dps;
  }

  protected step(tanksDelta: number, healsDelta: number): void {
    this.compositionChange.emit({ raidId: this.raidId(), tanks: this.tanks() + tanksDelta, heals: this.heals() + healsDelta });
  }

  protected onRaid(event: Event): void {
    this.compositionChange.emit({ raidId: (event.target as HTMLSelectElement).value, tanks: this.tanks(), heals: this.heals() });
  }
}
