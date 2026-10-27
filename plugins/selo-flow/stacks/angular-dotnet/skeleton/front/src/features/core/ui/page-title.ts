import { Component } from '@angular/core';

// The page's h1 (recipe: headings): `<h1 appPageTitle>…</h1>`.
@Component({
  selector: 'h1[appPageTitle]',
  template: '<ng-content />',
  styles: `
    :host {
      margin: 0;
      line-height: 1.02;
      text-wrap: balance;
      font-family: var(--font-display);
      font-size: var(--title-size);
      font-weight: var(--title-weight);
      letter-spacing: var(--title-tracking);
      text-transform: var(--title-transform);
      font-style: var(--title-style);
    }
  `,
})
export class PageTitle {}
