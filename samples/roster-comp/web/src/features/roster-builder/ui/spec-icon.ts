import { Component, computed, input, linkedSignal } from '@angular/core';

// A spec's game icon in a square tile, like an action-bar button; when the CDN does not answer (an offline demo),
// the tile keeps its class color and shows the spec's initial.
@Component({
  selector: 'app-spec-icon',
  template: `
    @if (hasFailed()) {
      <span aria-hidden="true">{{ initial() }}</span>
    } @else {
      <img [src]="src()" alt="" loading="lazy" (error)="hasFailed.set(true)" />
    }
  `,
  host: { '[style.--cls]': 'classColor()', '[attr.title]': 'label()', '[class.is-small]': 'isSmall()' },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 22px;
      height: 22px;
      overflow: hidden;
      color: var(--cls);
      font-family: var(--font-display);
      font-size: 12px;
      font-weight: 700;
      text-shadow: none;
      background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--cls) 30%, var(--bg)), var(--bg) 80%);
      border: var(--border-width) solid var(--frame-line);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cls) 45%, var(--bg));
      border-radius: var(--badge-radius);
    }
    :host(.is-small) {
      width: 18px;
      height: 18px;
      font-size: 10px;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class SpecIcon {
  readonly icon = input.required<string>();
  readonly classId = input.required<string>();
  // The class and spec, shown on hover: « Guerrier Protection ».
  readonly label = input.required<string>();
  readonly isSmall = input(false);

  protected readonly hasFailed = linkedSignal(() => this.icon() === '');
  protected readonly src = computed(() => `https://wow.zamimg.com/images/wow/icons/medium/${this.icon()}.jpg`);
  protected readonly classColor = computed(() => `var(--class-${this.classId()})`);
  protected readonly initial = computed(() => this.label().split(' ').at(-1)?.charAt(0) ?? '');
}
