import { Component } from '@angular/core';
import { SearchIcon } from './icons';

// A search field with its leading icon (recipe: search): `<app-search-input><input appControl type="search" /></app-search-input>`.
@Component({
  selector: 'app-search-input',
  imports: [SearchIcon],
  template: '<app-search-icon class="icon" /><ng-content />',
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .icon {
      position: absolute;
      left: 12px;
      top: 50%;
      display: flex;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }
  `,
})
export class SearchInput {}
