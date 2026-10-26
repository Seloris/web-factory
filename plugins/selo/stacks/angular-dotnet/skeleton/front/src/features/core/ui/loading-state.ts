import { Component } from '@angular/core';

// While a list loads: the empty state's box without its border.
@Component({
  selector: 'app-loading-state',
  template: '<p role="status"><ng-content /></p>',
  styles: `
    p {
      margin: 0;
      padding: 28px 16px;
      text-align: center;
      color: var(--text-muted);
    }
  `,
})
export class LoadingState {}
