import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Button } from './button';
import { ErrorMessage } from './error-message';

let nextId = 0;

// A native <dialog> opened with showModal() (recipe: dialog). The page owns `isOpen`: Escape asks it to
// cancel (never while the action runs), and the dialog opens again if the page keeps it open.
@Component({
  selector: 'app-confirm-dialog',
  imports: [Button, ErrorMessage],
  template: `
    <dialog #dialog [attr.aria-labelledby]="titleId" (cancel)="onEscape($event)" (close)="onClose()">
      <h2 [id]="titleId">{{ title() }}</h2>
      <p>{{ message() }}</p>
      @if (error(); as message) {
        <app-error-message>{{ message }}</app-error-message>
      }
      <div class="actions">
        <button appButton variant="quiet" [disabled]="isPending()" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
        <button appButton variant="danger" [disabled]="isPending()" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(400px, calc(100% - 32px));
      padding: 24px;
      color: var(--text);
      background: var(--pop-bg);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-pop);
      -webkit-backdrop-filter: var(--blur);
      backdrop-filter: var(--blur);
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    /* qualified by [open]: a closed dialog stays hidden */
    dialog[open] {
      display: grid;
      gap: 8px;
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
    p {
      margin: 0;
      color: var(--text-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class ConfirmDialog {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly isPending = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output();
  readonly cancelled = output();

  protected readonly titleId = `confirm-dialog-${nextId++}`;
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
