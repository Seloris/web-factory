import { Component } from '@angular/core';

// The wrapper that draws a native select's chevron (recipe: select-wrap): `<app-select><select appControl>…</select></app-select>`.
@Component({
  selector: 'app-select',
  template: '<ng-content />',
  styles: `
    :host {
      position: relative;
      display: block;
    }
    :host::after {
      content: '';
      position: absolute;
      right: 14px;
      top: 50%;
      width: 7px;
      height: 7px;
      pointer-events: none;
      border-right: 1.5px solid var(--text-muted);
      border-bottom: 1.5px solid var(--text-muted);
      transform: translateY(-70%) rotate(45deg);
    }
  `,
})
export class Select {}
