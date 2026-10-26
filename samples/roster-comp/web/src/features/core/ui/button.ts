import { Component, input } from '@angular/core';

// A button (recipe: buttons): `<button appButton variant="primary">…</button>`; `type="button"` unless given.
// ghost is a row action, an icon before its text. A project may set --btn-primary-bg, --btn-danger-bg, --btn-quiet-bg,
// --btn-quiet-hover-bg, --btn-quiet-text, --btn-bevel and --btn-text-shadow in its overrides; each falls back to the skin.
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
      box-shadow: var(--btn-bevel, var(--shadow-control));
      text-shadow: var(--btn-text-shadow, none);
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
      background: var(--btn-primary-bg, var(--accent));
      color: var(--accent-text);
    }
    :host([data-variant='danger']) {
      background: var(--btn-danger-bg, var(--danger));
      color: var(--danger-text);
    }
    :host([data-variant='primary']:hover:not(:disabled)),
    :host([data-variant='danger']:hover:not(:disabled)) {
      filter: brightness(1.07);
    }
    :host([data-variant='quiet']) {
      background: var(--btn-quiet-bg, var(--surface-2));
      color: var(--btn-quiet-text, var(--text));
    }
    /* toward the text color: darker on a light skin, lighter on a dark one */
    :host([data-variant='quiet']:hover:not(:disabled)) {
      background: var(--btn-quiet-hover-bg, color-mix(in srgb, var(--surface-2), var(--text) 8%));
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
      text-shadow: none;
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
