import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BuffDto } from '../../../api/models/buff-dto';
import { BuffGroup } from '../../../api/models/buff-group';
import { ClassDto } from '../../../api/models/class-dto';
import { Icon } from './icon';
import { Message, SpecIndex } from '../utils/roster-view';

const GROUPS: readonly BuffGroup[] = ['Raid', 'Totems', 'Debuffs', 'Utility'];

interface BuffLine {
  buff: BuffDto;
  isCovered: boolean;
  givers: { pseudo: string; color: string }[];
  // The givers' specs when the buff takes some (« Précision »), or the pool's rule, once per pool.
  note: Message | null;
  // What a lacking buff needs: a class, its spec, a further player of its class, or the buff excluding it.
  need: Message | null;
}

// The buffs as game tooltips, one per group, each buff with its givers in their class color or what it lacks.
@Component({
  selector: 'app-buffs-recap',
  imports: [TranslatePipe, Icon],
  template: `
    <div class="grid">
      @for (group of groups(); track group.group) {
        <div class="group">
          <h3>
            {{ 'rosterBuilder.buffs.groups.' + group.group | translate }}
            <span class="cnt" [class.is-short]="group.covered < group.lines.length">{{ group.covered }} / {{ group.lines.length }}</span>
          </h3>
          <ul>
            @for (line of group.lines; track line.buff.id) {
              <li [class.is-missing]="!line.isCovered">
                <app-icon [name]="line.isCovered ? 'check' : 'cross'" [class]="line.isCovered ? 'ok' : 'ko'" />
                <span class="name">{{ line.buff.name }}</span>
                <span class="who">
                  @for (giver of line.givers; track $index) {
                    <b [style.color]="giver.color">{{ giver.pseudo }}</b>{{ $last ? '' : ', ' }}
                  }
                  @if (line.need; as need) {
                    <span class="need">{{ need.key | translate: need.params }}</span>
                  }
                  @if (line.note; as note) {
                    <span class="note"> · {{ note.key | translate: note.params }}</span>
                  }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </div>
    <p class="foot">{{ 'rosterBuilder.buffs.footnote' | translate }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .group {
      display: grid;
      gap: 6px;
      align-content: start;
      padding: 10px 12px;
      background: var(--tooltip-bg);
      border: var(--border-width) solid var(--tooltip-border);
      border-radius: var(--radius);
      box-shadow:
        0 0 0 1px var(--frame-line),
        0 6px 16px color-mix(in srgb, var(--frame-line) 60%, transparent);
    }
    h3 {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 0;
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--bar-text);
      text-shadow: var(--outline);
    }
    .cnt {
      margin-left: auto;
      font-size: 0.9em;
      color: var(--text-muted);
      font-variant-numeric: lining-nums tabular-nums;
      text-shadow: none;
    }
    .cnt.is-short {
      color: var(--need);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      column-gap: 8px;
      padding: 3px 0;
    }
    app-icon {
      margin-top: 2px;
    }
    .ok {
      color: var(--ok);
    }
    .ko {
      color: var(--need);
    }
    .name {
      color: var(--bar-text);
    }
    .is-missing .name {
      color: var(--text-muted);
    }
    .who {
      grid-column: 2;
      font-size: 0.84em;
      color: var(--text-muted);
      overflow-wrap: anywhere;
    }
    b {
      font-weight: 400;
    }
    .need {
      color: var(--need);
    }
    .foot {
      margin: 0;
      font-size: 0.84em;
      color: var(--text-muted);
    }
    @media (max-width: 1024px) {
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class BuffsRecap {
  readonly buffs = input.required<BuffDto[]>();
  readonly classes = input.required<ClassDto[]>();
  readonly specs = input.required<SpecIndex>();

  protected readonly groups = computed(() => {
    const notedPools = new Set<string>();
    const lines = this.buffs().map((buff) => {
      const isCovered = buff.givers.length > 0;
      let note: Message | null = null;
      if (isCovered && buff.specIds.length > 0) {
        const names = [...new Set(buff.givers.map((g) => this.specs().get(g.specId)?.spec.name ?? ''))];
        note = { key: 'rosterBuilder.buffs.specNote', params: { specs: names.join(', ') } };
      } else if (isCovered && buff.pool !== null && !notedPools.has(buff.pool)) {
        notedPools.add(buff.pool);
        note = { key: `rosterBuilder.buffs.pools.${buff.pool}`, params: {} };
      }
      return {
        buff,
        isCovered,
        givers: buff.givers.map((g) => ({ pseudo: g.pseudo, color: `var(--class-${this.specs().get(g.specId)?.gameClass.id ?? ''})` })),
        note,
        need: isCovered ? null : this.needOf(buff),
      } satisfies BuffLine;
    });
    return GROUPS.map((group) => {
      const ofGroup = lines.filter((l) => l.buff.group === group);
      return { group, lines: ofGroup, covered: ofGroup.filter((l) => l.isCovered).length };
    }).filter((g) => g.lines.length > 0);
  });

  private needOf(buff: BuffDto): Message {
    const className = this.classes().find((c) => c.id === buff.classId)?.name ?? '';
    if (buff.excludedById !== null) {
      const by = this.buffs().find((b) => b.id === buff.excludedById)?.name ?? '';
      return { key: 'rosterBuilder.buffs.excluded', params: { buff: by } };
    }
    if (buff.neededCount !== null) {
      return { key: 'rosterBuilder.buffs.needNth', params: { n: buff.neededCount, class: className } };
    }
    if (buff.specIds.length > 0) {
      const specs = buff.specIds.map((id) => this.specs().get(id)?.spec.name ?? '');
      return { key: 'rosterBuilder.buffs.needSpec', params: { class: className, specs: specs.join(' / ') } };
    }
    return { key: 'rosterBuilder.buffs.needClass', params: { class: className } };
  }
}
