import { Component } from '@angular/core';

// A list with no row: empty, or filtered to nothing (recipe: empty).
@Component({
  selector: 'app-empty-state',
  template: '<p><ng-content /></p>',
  styles: `
    p {
      margin: 0;
      padding: 28px 16px;
      text-align: center;
      color: var(--text-muted);
      border: var(--border-width) dashed var(--border);
      border-radius: var(--item-radius);
    }
  `,
})
export class EmptyState {}
