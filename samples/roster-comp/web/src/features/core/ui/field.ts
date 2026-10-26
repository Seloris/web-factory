import { Component, Directive, inject, input } from '@angular/core';

let nextId = 0;

// A label, its control and its error (recipe: field). The control is projected and gets its id and
// aria attributes from FieldControl: `<app-field [label]="…" [error]="…"><input appControl … /></app-field>`.
// A project may set --label-color and --label-shadow in its overrides; each falls back to the skin.
@Component({
  selector: 'app-field',
  template: `
    <label class="label" [for]="id">{{ label() }}</label>
    <ng-content />
    @if (error(); as message) {
      <p class="error" [id]="errorId">{{ message }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: var(--label-size);
      font-weight: var(--label-weight);
      text-transform: var(--label-transform);
      letter-spacing: var(--label-tracking);
      color: var(--label-color, var(--text-muted));
      text-shadow: var(--label-shadow, none);
    }
    .error {
      margin: 8px 0 0;
      color: var(--danger);
      font-size: 0.85em;
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly error = input<string | null>(null);
  readonly id = `field-${nextId++}`;
  readonly errorId = `${this.id}-error`;
}

// Ties a control to the Field around it, when there is one: its id, aria-invalid and aria-describedby.
@Directive({
  host: {
    '[attr.id]': 'field?.id ?? null',
    '[attr.aria-invalid]': 'field?.error() ? "true" : null',
    '[attr.aria-describedby]': 'field?.error() ? field?.errorId : null',
  },
})
export class FieldControl {
  protected readonly field = inject(Field, { optional: true });
}
