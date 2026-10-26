import { Component, input } from '@angular/core';

// A button (recipe: buttons): `<button appButton variant="primary">…</button>`; `type="button"` unless given.
// ghost is a row action, an icon before its text.
@Component({
  selector: 'button[appButton]',
  template: '<ng-content />',
  host: { '[attr.type]': 'type()', '[attr.data-variant]': 'variant()' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: var(--control-h);
      padding: 0 18px;
      white-space: nowrap;
      cursor: pointer;
      font: inherit;
      font-weight: var(--btn-weight);
      text-transform: var(--btn-transform);
      letter-spacing: var(--btn-tracking);
      border: var(--border-width) solid var(--btn-border);
      border-radius: var(--radius-control);
      box-shadow: var(--shadow-control);
      transition: transform 0.12s, filter 0.12s, background-color 0.12s, color 0.12s;
    }
    /* restores the page's ring: the host's own shadow has the same specificity and loads later */
    :host(:focus-visible) {
      box-shadow: 0 0 0 3px var(--focus);
    }
    :host(:active) {
      transform: translate(1px, 1px);
    }
    :host(:disabled) {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }
    :host([data-variant='primary']) {
      background: var(--accent);
      color: var(--accent-text);
    }
    :host([data-variant='danger']) {
      background: var(--danger);
      color: var(--danger-text);
    }
    :host([data-variant='primary']:hover:not(:disabled)),
    :host([data-variant='danger']:hover:not(:disabled)) {
      filter: brightness(1.07);
    }
    :host([data-variant='quiet']) {
      background: var(--surface-2);
      color: var(--text);
    }
    /* toward the text color: darker on a light skin, lighter on a dark one */
    :host([data-variant='quiet']:hover:not(:disabled)) {
      background: color-mix(in srgb, var(--surface-2), var(--text) 8%);
    }
    :host([data-variant='ghost']) {
      height: auto;
      padding: 6px 10px;
      font-size: 0.86em;
      font-weight: 500;
      background: transparent;
      color: var(--text-muted);
      border-color: transparent;
      box-shadow: none;
    }
    :host([data-variant='ghost']:hover) {
      color: var(--danger);
      background: var(--danger-soft);
    }
  `,
})
export class Button {
  readonly variant = input<'primary' | 'danger' | 'quiet' | 'ghost'>('quiet');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
