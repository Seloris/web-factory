import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Rank } from '../../../api/models/rank';

// A choice's rank, S to C, as an item-quality letter.
@Component({
  selector: 'app-rank-tag',
  imports: [TranslatePipe],
  template: `<i [title]="'rosterBuilder.place.rank' | translate: { rank: rank() }">{{ rank() }}</i>`,
  host: { '[style.color]': 'color()' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    i {
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      font-style: normal;
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      text-shadow: none;
      border: var(--border-width) solid currentColor;
      border-radius: var(--badge-radius);
      background: color-mix(in srgb, currentColor 16%, var(--bg));
    }
  `,
})
export class RankTag {
  readonly rank = input.required<Rank>();
  protected readonly color = computed(() => `var(--tier-${this.rank().toLowerCase()})`);
}
