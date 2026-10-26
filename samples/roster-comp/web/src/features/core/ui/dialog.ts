import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let nextId = 0;

// A native <dialog> opened with showModal() (recipe: dialog), its title and projected content: a form, a list of choices.
// The page owns `isOpen`: Escape asks it to cancel (never while an action runs); `isWide` fits a form of several columns.
@Component({
  selector: 'app-dialog',
  template: `
    <dialog #dialog [class.is-wide]="isWide()" [attr.aria-labelledby]="titleId" (cancel)="onEscape($event)" (close)="onClose()">
      <h2 [id]="titleId">{{ title() }}</h2>
      <ng-content />
    </dialog>
  `,
  styles: `
    dialog {
      width: min(400px, calc(100% - 32px));
      max-height: calc(100% - 32px);
      padding: 24px;
      color: var(--text);
      background: var(--pop-bg);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-pop);
      -webkit-backdrop-filter: var(--blur);
      backdrop-filter: var(--blur);
    }
    dialog.is-wide {
      width: min(640px, calc(100% - 32px));
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    /* qualified by [open]: a closed dialog stays hidden */
    dialog[open] {
      display: grid;
      gap: 14px;
      animation: fade 0.15s ease-out;
    }
    h2 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.3em;
      font-weight: var(--title-weight);
      line-height: 1.2;
      text-transform: var(--title-transform);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class Dialog {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly isPending = input(false);
  readonly isWide = input(false);
  readonly cancelled = output();

  protected readonly titleId = `dialog-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.isOpen() && !dialog.open) {
        dialog.showModal();
      } else if (!this.isOpen() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    if (!this.isPending()) {
      this.cancelled.emit();
    }
  }

  // The browser may still close it (a repeated Escape cannot be prevented): the page decides, and reopens it by keeping isOpen.
  protected onClose(): void {
    if (this.isOpen()) {
      this.cancelled.emit();
      this.dialog().nativeElement.showModal();
    }
  }
}
