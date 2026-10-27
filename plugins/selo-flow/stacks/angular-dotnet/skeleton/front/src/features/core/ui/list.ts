import { Component, inject, input } from '@angular/core';

// A list and its rows (recipe: list): `<ul appList><li appListItem [isDone]="…"><span appListItemText>…</span>…</li></ul>`.
@Component({
  selector: 'ul[appList]',
  template: '<ng-content />',
  styles: `
    :host {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--list-gap);
      border-top: var(--list-rule);
    }
  `,
})
export class List {}

// wraps: at narrow widths the tag and the row action go to a second line instead of widening the page
@Component({
  selector: 'li[appListItem]',
  template: '<ng-content />',
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: var(--item-pad);
      background: var(--item-bg);
      border: var(--item-border);
      border-bottom: var(--item-rule);
      border-radius: var(--item-radius);
      box-shadow: var(--item-shadow);
    }
  `,
})
export class ListItem {
  readonly isDone = input(false);
}

// The row's text, struck through when its row is done; the 120px basis keeps it readable before the row wraps.
@Component({
  selector: '[appListItemText]',
  template: '<ng-content />',
  host: { '[class.is-done]': 'item?.isDone()' },
  styles: `
    :host {
      flex: 1 1 120px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    :host(.is-done) {
      color: var(--text-muted);
      text-decoration: line-through;
      text-decoration-thickness: 1px;
    }
  `,
})
export class ListItemText {
  protected readonly item = inject(ListItem, { optional: true });
}
