import { Component, inject } from '@angular/core';
import { FieldControl } from './field';
import { SearchInput } from './search-input';

// The native input or select, restyled (recipes: input, select): `<input appControl />`, `<select appControl>`.
// Inside an app-search-input it leaves room for the icon; a select goes inside an app-select for its chevron.
@Component({
  selector: 'input[appControl], select[appControl]',
  template: '<ng-content />',
  hostDirectives: [FieldControl],
  host: { '[class.has-icon]': 'hasIcon' },
  styles: `
    :host {
      width: 100%;
      height: var(--control-h);
      margin: 0;
      padding: 0 12px;
      font: inherit;
      color: var(--text);
      background: var(--control-bg);
      border: var(--border-width) solid var(--control-border);
      border-radius: var(--radius-control);
      box-shadow: var(--shadow-control);
      -webkit-appearance: none;
      appearance: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    :host::placeholder {
      color: var(--text-muted);
      opacity: 0.75;
    }
    :host(:focus-visible) {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--focus);
    }
    :host([aria-invalid='true']) {
      border-color: var(--danger);
    }
    :host(select) {
      padding-right: 34px;
      cursor: pointer;
    }
    :host(.has-icon) {
      padding-left: 36px;
    }
    :host::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
    }
  `,
})
export class Control {
  protected readonly hasIcon = inject(SearchInput, { optional: true }) !== null;
}
