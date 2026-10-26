import { Component } from '@angular/core';

// An error the person must see (recipe: error); a failed load composes it with a retry button.
@Component({
  selector: 'app-error-message',
  template: '<p role="alert"><ng-content /></p>',
  styles: `
    p {
      margin: 0;
      color: var(--danger);
      font-size: 0.85em;
    }
  `,
})
export class ErrorMessage {}
