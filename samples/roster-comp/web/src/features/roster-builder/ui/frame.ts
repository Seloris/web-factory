import { Component, input } from '@angular/core';

let nextId = 0;

// A zone of the page as a game frame: a gold-riveted panel and its title strip, a count (`[frameSub]`)
// and actions (`[frameActions]`) beside the title.
@Component({
  selector: 'section[appFrame]',
  template: `
    <header class="strip">
      <h2 [id]="headingId">{{ heading() }}</h2>
      <span class="sub"><ng-content select="[frameSub]" /></span>
      <span class="actions"><ng-content select="[frameActions]" /></span>
    </header>
    <ng-content />
  `,
  host: { '[attr.aria-labelledby]': 'headingId' },
  styles: `
    :host {
      position: relative;
      display: grid;
      gap: 14px;
      align-content: start;
      min-width: 0;
      padding: var(--panel-pad);
      background: var(--panel-bg);
      border: var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
    }
    /* the rivets in the corners */
    :host::after {
      content: '';
      position: absolute;
      inset: 3px;
      pointer-events: none;
      background:
        radial-gradient(circle, var(--gold) 0 1.5px, var(--gold-dim) 2px, transparent 2.6px) left top / 8px 8px no-repeat,
        radial-gradient(circle, var(--gold) 0 1.5px, var(--gold-dim) 2px, transparent 2.6px) right top / 8px 8px no-repeat,
        radial-gradient(circle, var(--gold) 0 1.5px, var(--gold-dim) 2px, transparent 2.6px) left bottom / 8px 8px no-repeat,
        radial-gradient(circle, var(--gold) 0 1.5px, var(--gold-dim) 2px, transparent 2.6px) right bottom / 8px 8px no-repeat;
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      margin: calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad)) 0;
      padding: 10px var(--panel-pad);
      background: var(--strip);
      border-bottom: var(--border-width) solid var(--gold-dim);
      box-shadow: 0 1px 0 var(--frame-line);
    }
    h2 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--gold);
      text-shadow: var(--outline);
    }
    .sub {
      color: var(--text-muted);
      font-size: 0.9em;
      font-family: var(--font-display);
      font-variant-numeric: lining-nums tabular-nums;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    .actions:empty {
      display: none;
    }
    @media (max-width: 640px) {
      :host {
        --panel-pad: 14px;
      }
    }
  `,
})
export class Frame {
  readonly heading = input.required<string>();
  protected readonly headingId = `frame-${nextId++}`;
}
