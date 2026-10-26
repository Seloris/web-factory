import { Component, computed, input, linkedSignal, output, untracked } from '@angular/core';
import { FormField, applyEach, form, maxLength, required, schema, submit, validate } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { ClassDto } from '../../../api/models/class-dto';
import { PlayerDto } from '../../../api/models/player-dto';
import { Rank } from '../../../api/models/rank';
import { SavePlayerCommand } from '../../../api/models/save-player-command';
import { Button } from '../../core/ui/button';
import { Control } from '../../core/ui/control';
import { ErrorMessage } from '../../core/ui/error-message';
import { Field } from '../../core/ui/field';
import { Select } from '../../core/ui/select';
import { ProblemDetails } from '../../core/utils/problem-details';
import { Icon } from './icon';
import { SpecIcon } from './spec-icon';
import { RANKS, SpecIndex } from '../utils/roster-view';

const PSEUDO_MAX_LENGTH = 24;

interface ChoiceModel {
  rank: Rank;
  classId: string;
  specId: string;
}

interface SheetModel {
  pseudo: string;
  choices: ChoiceModel[];
}

const sheetSchema = schema<SheetModel>((sheet) => {
  required(sheet.pseudo);
  maxLength(sheet.pseudo, PSEUDO_MAX_LENGTH);
  // The API trims the pseudo: blanks alone are none.
  validate(sheet.pseudo, ({ value }) => (value().trim() === '' ? { kind: 'required' } : null));
  validate(sheet.choices, ({ value }) => {
    const specIds = value().map((c) => c.specId);
    if (specIds.length === 0) {
      return { kind: 'noChoice' };
    }
    return new Set(specIds).size < specIds.length ? { kind: 'duplicateSpec' } : null;
  });
  applyEach(sheet.choices, (choice) => required(choice.specId));
});

// The server's refusals by field: the 400's field names, then the codes of a 409 or a 422.
const SERVER_FIELDS: Record<string, 'pseudo' | 'choices'> = { pseudo_taken: 'pseudo', duplicate_spec: 'choices' };

// A player's sheet: the pseudo, then the choices from most to least wanted, each a rank, a class, a spec and its role.
@Component({
  selector: 'app-sheet-form',
  imports: [FormField, TranslatePipe, Button, Control, ErrorMessage, Field, Select, Icon, SpecIcon],
  templateUrl: './sheet.form.html',
  styles: `
    form {
      display: grid;
      gap: 14px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    li {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 22px minmax(0, 1fr) 64px auto;
      gap: 6px;
      align-items: center;
    }
    .role {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.88em;
      color: var(--text-muted);
    }
    .add {
      justify-self: start;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    @media (max-width: 640px) {
      li {
        grid-template-columns: 64px 22px minmax(0, 1fr) auto;
        padding-bottom: 6px;
        border-bottom: var(--border-width) solid var(--border);
      }
      li .class {
        grid-column: 2 / -1;
        grid-row: 1;
      }
      li .rank {
        grid-row: 1;
        grid-column: 1;
      }
      .role {
        display: none;
      }
    }
  `,
})
export class SheetForm {
  // The sheet to edit, null for a new one.
  readonly detail = input<PlayerDto | null>(null);
  readonly classes = input.required<ClassDto[]>();
  readonly specs = input.required<SpecIndex>();
  readonly isSaving = input(false);
  readonly problem = input<ProblemDetails | null>(null);
  readonly save = output<SavePlayerCommand>();
  readonly cancelled = output();

  // Reset by the sheet only: a catalogue read again keeps the edits.
  readonly #model = linkedSignal<SheetModel>(() => {
    const detail = this.detail();
    return untracked(() =>
      detail
        ? {
            pseudo: detail.pseudo,
            choices: detail.choices.map((c) => ({ rank: c.rank, specId: c.specId, classId: this.specs().get(c.specId)?.gameClass.id ?? '' })),
          }
        : { pseudo: '', choices: [this.#newChoice([])] },
    );
  });
  // The sheet as the server refused it: its refusal shows until the sheet changes.
  readonly #refused = linkedSignal(() => {
    this.problem();
    return untracked(() => this.#model());
  });
  protected readonly fields = form(this.#model, sheetSchema);
  protected readonly choices = computed(() => this.#model().choices);
  protected readonly ranks = RANKS;
  protected readonly maxLength = PSEUDO_MAX_LENGTH;

  // The server's refusal, by field; `general` for what no field holds.
  protected readonly serverErrors = computed(() => {
    const problem = this.problem();
    if (!problem || this.#model() !== this.#refused()) {
      return {};
    }
    if (problem.errors) {
      const keys = Object.keys(problem.errors);
      return {
        pseudo: keys.some((k) => k.toLowerCase() === 'pseudo') ? 'rosterBuilder.sheetForm.errors.pseudoInvalid' : undefined,
        choices: keys.some((k) => k.toLowerCase().startsWith('choices')) ? 'rosterBuilder.sheetForm.errors.choicesInvalid' : undefined,
      };
    }
    const code = problem.code ?? '';
    const key = code === 'too_many_players' || SERVER_FIELDS[code] ? `rosterBuilder.sheetForm.errors.${code}` : 'rosterBuilder.sheetForm.errors.unknown';
    return { [SERVER_FIELDS[code] ?? 'general']: key } as Partial<Record<'pseudo' | 'choices' | 'general', string>>;
  });

  protected pseudoError(): string | null {
    const state = this.fields.pseudo();
    if (state.invalid() && (state.dirty() || state.touched())) {
      return state.errors().some((e) => e.kind === 'maxLength') ? 'rosterBuilder.sheetForm.errors.pseudoTooLong' : 'rosterBuilder.sheetForm.errors.pseudoRequired';
    }
    return this.serverErrors().pseudo ?? null;
  }

  protected choicesError(): string | null {
    const state = this.fields.choices();
    const errors = state.errors();
    if (errors.length > 0 && (state.dirty() || state.touched())) {
      return `rosterBuilder.sheetForm.errors.${errors[0].kind}`;
    }
    return this.serverErrors().choices ?? null;
  }

  protected specsOf(classId: string) {
    return this.classes().find((c) => c.id === classId)?.specs ?? [];
  }

  protected onClassChange(index: number, event: Event): void {
    const classId = (event.target as HTMLSelectElement).value;
    this.#updateChoice(index, { classId, specId: this.specsOf(classId)[0]?.id ?? '' });
  }

  protected addChoice(): void {
    this.#model.update((m) => ({ ...m, choices: [...m.choices, this.#newChoice(m.choices)] }));
    this.fields.choices().markAsDirty();
  }

  protected removeChoice(index: number): void {
    this.#model.update((m) => ({ ...m, choices: m.choices.filter((_, i) => i !== index) }));
    this.fields.choices().markAsDirty();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.fields, async () => {
      const model = this.#model();
      this.save.emit({ pseudo: model.pseudo.trim(), choices: model.choices.map((c) => ({ rank: c.rank, specId: c.specId })) });
      return undefined;
    });
  }

  #updateChoice(index: number, patch: Partial<ChoiceModel>): void {
    this.#model.update((m) => ({ ...m, choices: m.choices.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  }

  // The first spec of the catalogue the sheet does not hold yet.
  #newChoice(choices: ChoiceModel[]): ChoiceModel {
    const taken = new Set(choices.map((c) => c.specId));
    const gameClass = this.classes().find((c) => c.specs.some((spec) => !taken.has(spec.id)));
    const spec = gameClass?.specs.find((x) => !taken.has(x.id));
    return { rank: 'S', classId: gameClass?.id ?? '', specId: spec?.id ?? '' };
  }
}
