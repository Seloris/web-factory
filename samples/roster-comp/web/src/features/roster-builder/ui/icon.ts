import { Component, computed, input } from '@angular/core';

export type IconName = 'lock' | 'unlock' | 'Tank' | 'Heal' | 'Dps' | 'check' | 'cross' | 'edit' | 'trash' | 'plus' | 'shuffle' | 'place';

// The roster builder's icons, each a few 24px strokes; Tank, Heal and Dps are the roles'.
const PATHS: Record<IconName, string[]> = {
  lock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  unlock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 7.6-1.8'],
  Tank: ['M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z'],
  Heal: ['M12 4v16M4 12h16'],
  Dps: ['M20 4l-10 10M20 4h-4.5M20 4v4.5M6.5 11.5l6 6M4 20l4.5-4.5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  cross: ['M6 6l12 12M18 6L6 18'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  trash: ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'],
  plus: ['M12 5v14M5 12h14'],
  shuffle: ['M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3'],
  place: ['M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20'],
};

// Inline, in currentColor, 16px; it sits beside text or inside a button that has a name, so it has none.
@Component({
  selector: 'app-icon',
  template: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    svg {
      width: 1em;
      height: 1em;
      font-size: 16px;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly paths = computed(() => PATHS[this.name()]);
}
