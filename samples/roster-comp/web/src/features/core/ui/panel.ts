import { Component } from '@angular/core';

// The page's main surface (recipe: panel), 680px at most, centred.
@Component({
  selector: 'app-panel',
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      gap: 28px;
      max-width: 680px;
      margin: 0 auto;
      padding: var(--panel-pad);
      background: var(--panel-bg);
      border: var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
      -webkit-backdrop-filter: var(--blur);
      backdrop-filter: var(--blur);
    }
  `,
})
export class Panel {}
