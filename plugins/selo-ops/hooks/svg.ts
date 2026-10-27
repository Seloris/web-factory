// The pane as one SVG, after the Selo design canvas "Timeline de session": a header with three tiles,
// a continuous rail from "maintenant" down: the current prompt in a card, then the past prompts, newest first.
// Drawn on the surfaces that take an Svg; colours follow the app's light or dark scheme through CSS.

export type SvgCommit = { sha: string; subject: string }
export type SvgItem = { time: string; request: string; phase: string; text: string | null; commits: SvgCommit[] }
export type SvgStep = { label: string; right: string; state: 'done' | 'active' }
export type SvgModel = {
  width: number
  versions?: string
  prompts: number
  commits: number
  span: string
  live: boolean
  past: SvgItem[]
  current: SvgItem & { state: string; tone: 'run' | 'ok' | 'wait' | 'stop' | 'idle'; steps: SvgStep[] }
  now: string
}

const SANS = `'IBM Plex Sans', system-ui, 'Segoe UI', sans-serif`
const MONO = `'IBM Plex Mono', ui-monospace, Consolas, monospace`
const STYLE = `
.bg{fill:#FBFAF8}.surface{fill:#FFFFFF}.sunk{fill:#F2F0EC}.line{stroke:#E4E0D9}.line2{stroke:#D3CEC5}
.text{fill:#1C1B19}.muted{fill:#55524C}.faint{fill:#76726B}.accent{fill:#3451D1}.accentS{stroke:#3451D1}
.accentSoft{fill:#3451D11A}.ok{fill:#2B7A3B}.okS{stroke:#2B7A3B}.okSoft{fill:#E6F2E8}.wait{fill:#B4531F}.waitS{stroke:#B4531F}
.faintS{stroke:#76726B}.track{fill:#E4E0D9}.stop{fill:#C0392B}.stopS{stroke:#C0392B}.hollow{fill:#FBFAF8}.cardS{stroke:#D3CEC5}
@media (prefers-color-scheme: dark){
.bg{fill:#151518}.surface{fill:#1D1D21}.sunk{fill:#25252B}.line{stroke:#2E2E34}.line2{stroke:#3E3E46}
.text{fill:#ECEAE6}.muted{fill:#B3B0AA}.faint{fill:#8E8B85}.accent{fill:#8FA2FF}.accentS{stroke:#8FA2FF}
.accentSoft{fill:#8FA2FF2B}.ok{fill:#6CC57F}.okS{stroke:#6CC57F}.okSoft{fill:#6CC57F1F}.wait{fill:#E08A55}.waitS{stroke:#E08A55}
.faintS{stroke:#8E8B85}.track{fill:#34343B}.stop{fill:#F07167}.stopS{stroke:#F07167}.hollow{fill:#151518}.cardS{stroke:#3E3E46}}
text{font-family:${SANS}}.mono{font-family:${MONO}}`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Text widths are estimated: an SVG drawn as an image cannot measure. Wide glyphs count more.
const PX = (size: number, mono = false) => (mono ? 0.6 : 0.5) * size
const widthOf = (s: string, size: number, mono = false) => {
  let w = 0
  for (const ch of s) w += /[mwMW@%]/.test(ch) ? 1.45 : /[A-Z0-9]/.test(ch) ? 1.15 : /[iljtf.,;:'!|\s]/.test(ch) ? 0.6 : 1
  return w * PX(size, mono)
}
export const clip = (s: string, room: number, size: number, mono = false) => {
  if (widthOf(s, size, mono) <= room) return s
  let out = ''
  for (const ch of s) {
    if (widthOf(`${out}${ch}…`, size, mono) > room) break
    out += ch
  }
  return `${out.trimEnd()}…`
}
export const wrap = (s: string, room: number, size: number) => {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (widthOf(next, size) <= room || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.map(l => clip(l, room, size))
}

const DOT: Record<string, string> = { 'job-done': 'ok', 'awaiting-answer': 'wait', 'awaiting-commit': 'wait', stopped: 'stop' }

export function paneSvg(m: SvgModel): { svg: string; height: number } {
  const W = m.width
  const P = 16
  const out: string[] = []
  const t = (x: number, y: number, cls: string, s: string, extra = '') => out.push(`<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(s)}</text>`)

  // Header: the title, "En direct" while a turn runs, three tiles.
  t(P, 30, 'text', 'Session', 'font-size="15" font-weight="600"')
  if (m.versions) t(W - P - widthOf(m.versions, 11, true), 30, 'faint mono', m.versions, 'font-size="11"')
  if (m.live) {
    out.push(`<rect x="${P + 70}" y="15" width="78" height="22" rx="11" class="accentSoft"/>`, `<circle cx="${P + 82}" cy="26" r="3" class="accent"/>`)
    t(P + 90, 30, 'accent', 'En direct', 'font-size="11.5" font-weight="500"')
  }
  const tiles: [string, string][] = [['Prompts', String(m.prompts)], ['Commits', String(m.commits)], ['Durée', m.span]]
  const tw = (W - 2 * P - 16) / 3
  tiles.forEach(([label, value], i) => {
    const x = P + i * (tw + 8)
    out.push(`<rect x="${x}" y="48" width="${tw}" height="46" rx="8" class="sunk"/>`)
    t(x + 10, 64, 'muted', label, 'font-size="11"')
    t(x + 10, 85, 'text mono', value, 'font-size="15" font-weight="500"')
  })
  out.push(`<line x1="0" y1="110.5" x2="${W}" y2="110.5" class="line" stroke-width="1"/>`)

  // The timeline's columns: the time, the rail, the content.
  const timeX = P
  const railX = P + 40 + 10 + 7.5
  const cx = P + 40 + 10 + 16 + 10
  const cw = W - cx - P
  let y = 128
  const firstDot = y + 10
  let lastDot = firstDot
  const dots: string[] = []

  const chips = (commits: SvgCommit[], x: number, room: number, top: number) => {
    let yy = top
    for (const c of commits) {
      const sha = c.sha.slice(0, 7)
      const shaW = widthOf(sha, 11.5, true)
      const subject = clip(c.subject, room - 16 - 14 - 6 - shaW - 6 - 8, 12)
      const w = Math.min(room, 8 + 14 + 6 + shaW + 6 + widthOf(subject, 12) + 8)
      out.push(`<rect x="${x}" y="${yy}" width="${w}" height="24" rx="6" class="sunk"/>`)
      out.push(`<g transform="translate(${x + 8},${yy + 5})" fill="none" stroke-width="1.8" stroke-linecap="round" class="faintS"><circle cx="7" cy="7" r="2.6"/><path d="M1 7h3.4M9.6 7H13"/></g>`)
      t(x + 8 + 14 + 6, yy + 16, 'accent mono', sha, 'font-size="11.5" font-weight="500"')
      t(x + 8 + 14 + 6 + shaW + 6, yy + 16, 'muted', subject, 'font-size="12"')
      yy += 28
    }
    return yy
  }

  // "maintenant" on top: the newest first, the rail going down into the past.
  dots.push(`<circle cx="${railX}" cy="${y + 10}" r="3.25" class="hollow line2" stroke-width="1.5"/>`)
  t(cx, y + 14, 'muted', 'maintenant', 'font-size="12.5"')
  t(cx + widthOf('maintenant', 12.5) + 6, y + 14, 'faint mono', `· ${m.now}`, 'font-size="11.5"')
  y += 32

  const drawPast = (it: SvgItem) => {
    lastDot = y + 10
    t(timeX, y + 14, 'faint mono', it.time, 'font-size="11.5" font-weight="500"')
    const kind = it.commits.length ? 'accent' : DOT[it.phase] ?? null
    dots.push(kind ? `<circle cx="${railX}" cy="${y + 10}" r="4" class="${kind}"/>` : `<circle cx="${railX}" cy="${y + 10}" r="3.25" class="hollow line2" stroke-width="1.5"/>`)
    let yy = y
    if (it.request.startsWith('/')) {
      const [cmd = '', ...rest] = it.request.split(' ')
      const cmdW = widthOf(cmd, 12, true) + 12
      out.push(`<rect x="${cx}" y="${yy}" width="${cmdW}" height="20" rx="5" class="sunk"/>`)
      t(cx + 6, yy + 14, 'text mono', cmd, 'font-size="12" font-weight="500"')
      t(cx + cmdW + 6, yy + 14, 'muted', clip(rest.join(' '), cw - cmdW - 6, 13), 'font-size="13"')
    } else if (it.request) {
      t(cx, yy + 14, 'text', clip(it.request, cw, 13), 'font-size="13" font-weight="500"')
    } else {
      t(cx, yy + 14, 'faint', 'Message vide', 'font-size="13" font-style="italic"')
    }
    yy += 24
    if (it.text) {
      for (const [i, line] of wrap(it.text, cw - 14, 13).entries()) {
        if (i === 0) t(cx, yy + 14, 'accent mono', '›', 'font-size="13"')
        t(cx + 14, yy + 14, 'muted', line, 'font-size="13"')
        yy += 20
      }
    } else {
      t(cx, yy + 14, 'faint', 'Pas de récap pour ce prompt.', 'font-size="12.5" font-style="italic"')
      yy += 20
    }
    if (it.commits.length) yy = chips(it.commits, cx, cw, yy + 6) - 4
    y = yy + 18
  }


  // The current prompt: a card, its state on the right, its steps, its recap once the turn ended.
  const c = m.current
  const toneCls = { run: 'accent', ok: 'ok', wait: 'wait', stop: 'stop', idle: 'faint' }[c.tone]
  const cardTop = y
  const inner: string[] = []
  const ci = (x: number, yy: number, cls: string, s: string, extra = '') => inner.push(`<text x="${x}" y="${yy}" class="${cls}" ${extra}>${esc(s)}</text>`)
  const ix = cx + 14
  const iw = cw - 28
  let iy = cardTop + 12
  const stateW = widthOf(c.state, 12) + 14
  ci(ix, iy + 15, 'text', clip(c.request || 'Message vide', iw - stateW - 10, 14), 'font-size="14" font-weight="600"')
  inner.push(`<circle cx="${ix + iw - stateW + 3}" cy="${iy + 10}" r="3" class="${toneCls}"/>`)
  ci(ix + iw - stateW + 11, iy + 14, toneCls, c.state, 'font-size="12" font-weight="500"')
  iy += 20
  if (c.steps.length) {
    iy += 10
    inner.push(`<line x1="${ix}" y1="${iy + 0.5}" x2="${ix + iw}" y2="${iy + 0.5}" class="line" stroke-width="1"/>`)
    iy += 10
    for (const s of c.steps) {
      if (s.state === 'done') inner.push(`<path d="M${ix + 2} ${iy + 10.5}l3.5 3.5 7-7.5" fill="none" class="okS" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
      else inner.push(`<circle cx="${ix + 8}" cy="${iy + 10}" r="5" fill="none" class="line2" stroke-width="2"/><path d="M${ix + 8} ${iy + 5}a5 5 0 0 1 5 5" fill="none" class="accentS" stroke-width="2" stroke-linecap="round"/>`)
      const rightW = widthOf(s.right, 11.5, true)
      ci(ix + 24, iy + 14, s.state === 'active' ? 'text' : 'muted', clip(s.label, iw - 24 - rightW - 8, 13), `font-size="13" ${s.state === 'active' ? 'font-weight="500"' : ''}`)
      ci(ix + iw - rightW, iy + 14, 'faint mono', s.right, 'font-size="11.5"')
      iy += 24
    }
    iy -= 4
  }
  if (c.text || c.commits.length) {
    iy += 10
    inner.push(`<line x1="${ix}" y1="${iy + 0.5}" x2="${ix + iw}" y2="${iy + 0.5}" class="line" stroke-width="1"/>`)
    iy += 10
    if (c.text) {
      for (const [i, line] of wrap(c.text, iw - 14, 13).entries()) {
        if (i === 0) ci(ix, iy + 14, 'accent mono', '›', 'font-size="13"')
        ci(ix + 14, iy + 14, 'text', line, 'font-size="13"')
        iy += 20
      }
    }
    if (c.commits.length) {
      const before = out.length
      iy = chips(c.commits, ix, iw, iy + 6) - 4
      inner.push(...out.splice(before))
    }
  }
  const cardH = iy + 14 - cardTop
  out.push(`<rect x="${cx + 0.5}" y="${cardTop + 0.5}" width="${cw - 1}" height="${cardH}" rx="10" class="surface cardS" stroke-width="1"/>`)
  out.push(...inner)
  t(timeX, cardTop + 26, 'text mono', c.time, 'font-size="11.5" font-weight="500"')
  dots.push(`<circle cx="${railX}" cy="${cardTop + 23}" r="9" class="${c.tone === 'run' ? 'accentSoft' : 'bg'}"/>${c.tone === 'run' ? `<circle cx="${railX}" cy="${cardTop + 23}" r="5" class="surface accentS" stroke-width="2"/>` : `<circle cx="${railX}" cy="${cardTop + 23}" r="5" class="${toneCls}"/>`}`)
  lastDot = cardTop + 23
  y = cardTop + cardH + 18

  // Then the past prompts, the newest first; the rail runs from "maintenant" to the oldest dot.
  for (const it of [...m.past].reverse()) drawPast(it)
  const height = Math.ceil(y)
  const rail = `<line x1="${railX}" y1="${firstDot}" x2="${railX}" y2="${lastDot}" class="line" stroke-width="1"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}"><style>${STYLE}</style><rect width="${W}" height="${height}" class="bg"/>${rail}${out.join('')}${dots.join('')}</svg>`
  return { svg, height }
}

// The band's figures, after Ponytail: five columns split by thin rules, each a small label,
// a large value and a caption. Its own background stays transparent: the band draws its own.
export type BarStats = {
  flow: { name: string; color: string }[]
  flowSub: string
  added: number
  modified: number
  deleted: number
  lines: string
  linesShort?: string
  commits: string
  commitsSub: string
  tokens: string
  tokensSub: string
  context: { percent: number | null; sub: string }
  span: string
  spanSub: string
  state: string
  stateTone: string
  stateSub: string
}

// Drawn at a fixed width the band scales down to its room: nothing is cut, the text shrinks with it.
export const BAR_WIDTH = 720

// Columns of unequal width: the flow takes the most room, the commits the least.
export function barSvg(s: BarStats, width = BAR_WIDTH): string {
  const H = 46
  const weights = [1.8, 1.15, 0.7, 0.95, 1.1, 0.9, 1.25]
  const unit = width / weights.reduce((n, w) => n + w, 0)
  const starts = weights.map((_, i) => weights.slice(0, i).reduce((n, w) => n + w, 0) * unit)
  const out: string[] = []
  const t = (x: number, y: number, cls: string, text: string, extra = '') => out.push(`<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(text)}</text>`)
  const VALUE = 16
  const col = (i: number, label: string, value: string | [string, string][], sub: string, valueCls = 'text', size = VALUE) => {
    const x = starts[i]! + (i === 0 ? 2 : 12)
    const room = weights[i]! * unit - (i === 0 ? 10 : 20)
    if (i > 0) out.push(`<line x1="${starts[i]! + 0.5}" y1="4" x2="${starts[i]! + 0.5}" y2="${H - 4}" class="line" stroke-width="1"/>`)
    t(x, 12, 'muted', label, 'font-size="10.5"')
    if (typeof value === 'string') t(x, 31, valueCls, clip(value, room, size), `font-size="${size}" font-weight="600"`)
    else out.push(`<text x="${x}" y="31" font-size="${size}" font-weight="600">${value.map(([cls, v]) => (cls.startsWith('#') ? `<tspan fill="${cls}">${esc(v)}</tspan>` : `<tspan class="${cls}">${esc(v)}</tspan>`)).join('')}</text>`)
    t(x, 44, 'faint', clip(sub, room, 10.5), 'font-size="10.5"')
    return { x, room }
  }

  // The flow: each lane in its colour, "›" between them; past the room, the oldest give way to "…".
  const flowRoom = weights[0]! * unit - 10
  let lanes = s.flow.length ? s.flow : [{ name: 'libre', color: '#94a3b8' }]
  // The flow's text shrinks to fit, down to 11 px; past that, the oldest lanes give way.
  const pathOf = (l: typeof lanes) => l.map(x => x.name).join(' › ')
  let flowSize = VALUE
  while (flowSize > 11 && widthOf(pathOf(lanes), flowSize) > flowRoom) flowSize -= 0.5
  while (lanes.length > 1 && widthOf(pathOf(lanes), flowSize) > flowRoom) lanes = lanes.slice(1)
  const flowValue: [string, string][] = []
  if (lanes.length < (s.flow.length || 1)) flowValue.push(['faint', '… › '])
  lanes.forEach((l, i) => {
    if (i > 0) flowValue.push(['faint', ' › '])
    flowValue.push([l.color, l.name])
  })
  col(0, 'flow', flowValue, s.flowSub, 'text', flowSize)
  col(1, 'fichiers', [['ok', `+${s.added}`], ['text', ' '], ['wait', `~${s.modified}`], ['text', ' '], ['stop', `−${s.deleted}`]], s.linesShort ? `${s.linesShort} lignes` : s.lines)
  col(2, 'commits', s.commits, s.commitsSub)
  col(3, 'tokens', s.tokens, s.tokensSub)
  // The context: its share of the window, and a thin gauge under the label, amber past 80 %.
  const pct = s.context.percent
  const gaugeCls = pct !== null && pct >= 80 ? 'wait' : 'accent'
  const ctx = col(4, 'contexte', pct === null ? '—' : `${Math.round(pct)} %`, s.context.sub, pct !== null && pct >= 80 ? 'wait' : 'text')
  if (pct !== null) {
    const valueW = widthOf(`${Math.round(pct)} %`, VALUE) + 8
    const gw = Math.max(0, Math.min(56, ctx.room - valueW))
    const gx = ctx.x + valueW
    if (gw >= 16) out.push(`<rect x="${gx}" y="23" width="${gw}" height="4" rx="2" class="track"/>`, `<rect x="${gx}" y="23" width="${Math.max(2, (gw * Math.min(100, pct)) / 100)}" height="4" rx="2" class="${gaugeCls}"/>`)
  }
  col(5, 'durée', s.span, s.spanSub)
  const tone = { run: 'accent', ok: 'ok', wait: 'wait', stop: 'stop', idle: 'faint' }[s.stateTone] ?? 'text'
  col(6, 'état', s.state, s.stateSub, tone, 14)
  // A light rule over the figures, between them and the band's buttons.
  const TOP = 16
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H + TOP}" viewBox="0 0 ${width} ${H + TOP}"><style>${STYLE}</style><line x1="0" y1="8.5" x2="${width}" y2="8.5" class="line" stroke-width="1"/><g transform="translate(0,${TOP})">${out.join('')}</g></svg>`
}
