import { Component } from '@angular/core';

// Inline icons in currentColor, 16px; each sits beside text, so none has an accessible name.
@Component({
  selector: 'app-search-icon',
  template: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  `,
})
export class SearchIcon {}

@Component({
  selector: 'app-trash-icon',
  template: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  `,
  styles: `
    :host {
      display: flex;
    }
  `,
})
export class TrashIcon {}
