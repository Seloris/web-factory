// The helper's Plans tab beside the session: the project's blueprints and mockups.
// Every action fills the prompt box with its command; the person reads it and presses Enter.

import type { ThemeKey } from 'claude-code'

import type { Project, ProjectBlueprint, ProjectMockup } from '../types'

type Raw = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : null)

// The project as the selo-ops export writes it (projects/{rootKey}.json).
export function projectOf(p: Raw): Project {
  const blueprints: ProjectBlueprint[] = (Array.isArray(p.blueprints) ? (p.blueprints as Raw[]) : []).map(b => {
    const next = b.next as Raw | null
    return {
      name: String(b.name ?? ''),
      file: String(b.file ?? ''),
      title: String(b.title ?? b.name ?? ''),
      state: String(b.state ?? 'draft'),
      components: Array.isArray(b.components) ? (b.components as unknown[]).map(String) : [],
      mockup: str(b.mockup),
      next: next && str(next.prompt) ? { label: String(next.label ?? 'Suite'), prompt: String(next.prompt), pilot: str(next.pilot) } : null,
      modifiedAt: str(b.modifiedAt),
    }
  })
  const mockups: ProjectMockup[] = (Array.isArray(p.mockups) ? (p.mockups as Raw[]) : []).map(m => ({
    file: String(m.file ?? ''),
    title: String(m.title ?? m.file ?? ''),
    validated: m.validated === true,
    committed: m.committed === true,
  }))
  const manifest = p.manifest as Raw | null
  return { name: str(manifest?.name), isSelo: p.selo !== false, blueprints, mockups }
}

const STATE: Record<string, { label: string; tone: ThemeKey }> = {
  draft: { label: 'Brouillon', tone: 'subtle' },
  ready: { label: 'Prêt', tone: 'suggestion' },
  building: { label: 'En construction', tone: 'warning' },
  review: { label: 'En revue', tone: 'permission' },
  merging: { label: 'Merge du delta', tone: 'merged' },
  done: { label: 'Fait', tone: 'success' },
  legacy: { label: 'Ancien format', tone: 'inactive' },
}
const stateOf = (s: string) => STATE[s] ?? { label: s, tone: 'subtle' as ThemeKey }
const fileName = (f: string) => f.split('/').at(-1) ?? f

type Els = { Box: any; Button: any; Text: any }
export type HelperActions = {
  fill: (command: string) => void
  copy: (text: string, surface?: string) => void
  build: (m: ProjectMockup) => void
}

const notSelo = (els: Els) => (
  <els.Text dimColor>Ce dossier n’est pas un projet selo : pas de blueprint ni de maquette à montrer.</els.Text>
)

// The flag that names a plan in a command, as the person pastes it after a selo prompt.
export const flagOf = (kind: 'blueprint' | 'mockup', file: string) => `--${kind} ${file}`

// One tab for the project's plans: the blueprints, then the mockups; each copies its flag.
export function plansView(els: Els, project: Project | null, act: HelperActions) {
  const { Box, Button, Text } = els
  if (!project || !project.isSelo) return notSelo(els)
  const recent = (b: ProjectBlueprint) => Date.parse(b.modifiedAt ?? '') || 0
  const open = project.blueprints.filter(b => b.state !== 'done').sort((a, b) => recent(b) - recent(a))
  const done = project.blueprints.filter(b => b.state === 'done').sort((a, b) => recent(b) - recent(a))
  const toBuild = (m: ProjectMockup) => m.validated && !m.committed
  const mockups = [...project.mockups].sort((a, b) => Number(toBuild(b)) - Number(toBuild(a)) || b.file.localeCompare(a.file))
  const copy = (key: string, flag: string) => (
    <Button key={key} label={`⧉ ${flag.split(' ')[0]}`} plain onPress={(press: { surface?: string }) => act.copy(flag, press?.surface)} />
  )

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Blueprints</Text>
      {project.blueprints.length === 0 && <Text dimColor>Aucun blueprint dans .planning/blueprints/.</Text>}
      {project.blueprints.length > 0 && open.length === 0 && <Text dimColor>Aucun blueprint en cours.</Text>}
      {open.map(b => {
        const s = stateOf(b.state)
        return (
          <Box key={`bp-${b.name}`} flexDirection="column" borderStyle="round" borderColor={s.tone} paddingX={1}>
            <Box justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Text bold>{b.title}</Text>
              <Text color={s.tone}>● {s.label}</Text>
            </Box>
            <Text dimColor>
              {fileName(b.file)}
              {b.components.length ? ` · ${b.components.join(', ')}` : ''}
              {b.mockup ? ` · maquette ${fileName(b.mockup)}` : ''}
            </Text>
            <Box gap={1} flexWrap="wrap" alignItems="center" marginTop={1}>
              {b.next && <Button key={`bp-next-${b.name}`} variant="secondary" label={b.next.label} onPress={() => act.fill(b.next!.prompt)} />}
              {b.next?.pilot && <Button key={`bp-auto-${b.name}`} label="Pilot autonome" plain onPress={() => act.fill(b.next!.pilot!)} />}
              {(b.state === 'draft' || b.state === 'ready') && (
                <Button key={`bp-rev-${b.name}`} label="Relire" plain onPress={() => act.fill(`/selo:review blueprint ${b.file}`)} />
              )}
              {copy(`bp-copy-${b.name}`, flagOf('blueprint', b.file))}
            </Box>
          </Box>
        )
      })}
      {done.length > 0 && <Text dimColor>Terminés · {done.length}</Text>}
      {done.slice(0, 12).map(b => (
        <Box key={`bd-${b.name}`} gap={1} alignItems="center">
          <Text color="success">✓</Text>
          <Text dimColor>{b.title}</Text>
          {copy(`bd-copy-${b.name}`, flagOf('blueprint', b.file))}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text bold>Maquettes</Text>
      </Box>
      {mockups.length === 0 && <Text dimColor>Aucune maquette dans .planning/mockups/.</Text>}
      {mockups.map(m => (
        <Box key={`mk-${m.file}`} flexDirection="column" borderStyle="round" borderColor={toBuild(m) ? 'success' : 'subtle'} borderDimColor={!toBuild(m)} paddingX={1}>
          <Box justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Text bold>{m.title}</Text>
            {m.committed ? <Text dimColor>Commitée</Text> : m.validated ? <Text color="success">● Validée, à construire</Text> : <Text color="warning">● À valider</Text>}
          </Box>
          <Text dimColor>{fileName(m.file)}</Text>
          <Box gap={1} alignItems="center" marginTop={1}>
            {toBuild(m) && <Button key={`mk-build-${m.file}`} variant="secondary" label="Construire" onPress={() => act.build(m)} />}
            <Button key={`mk-rev-${m.file}`} label="Retoucher" plain onPress={() => act.fill(`/selo:mockup revise ${m.file}`)} />
            {copy(`mk-copy-${m.file}`, flagOf('mockup', m.file))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
