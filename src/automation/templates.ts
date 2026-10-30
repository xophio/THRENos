import type { Automation, AutomationCategory, Config, Node } from './types'
import { newAction, newIf, newAutomation } from './model'
import { CONDITIONS } from './conditions'
import { uid } from '../utils'

export interface Template {
  id: string
  name: string
  description: string
  category: AutomationCategory
  build: () => Partial<Automation>
}

const act = (type: string, config: Config = {}): Node => {
  const n = newAction(type)
  n.config = { ...n.config, ...config }
  return n
}

/** Starter workflows. They are created switched off; the user reviews and enables them. */
export const TEMPLATES: Template[] = [
  {
    id: 'focus-mode', name: 'Focus Mode', category: 'Productivity',
    description: 'Switch to a Focus workspace, open Notes and Calendar, and start a 25-minute focus session.',
    build: () => ({
      trigger: { type: 'manual', config: {} },
      steps: [
        act('workspace.switch', { workspace: 'Focus', create: 'create' }),
        act('app.open', { appId: 'notes' }),
        act('app.open', { appId: 'calendar' }),
        act('focus.start', { minutes: 25, label: 'Focus' }),
      ],
    }),
  },
  {
    id: 'work-setup', name: 'Work Setup', category: 'Workspace',
    description: 'Switch to a Work workspace and open Browser, Notes and Calendar together.',
    build: () => ({
      trigger: { type: 'manual', config: {} },
      steps: [
        act('workspace.switch', { workspace: 'Work', create: 'create' }),
        act('apps.openMany', { appIds: ['browser', 'notes', 'calendar'] }),
      ],
    }),
  },
  {
    id: 'morning-startup', name: 'Morning Startup', category: 'Productivity',
    description: 'On sign-in: greet you, show today’s date and open Calendar.',
    build: () => ({
      trigger: { type: 'user.login', config: {} },
      steps: [
        act('notify', { title: '{greeting}, {user}', body: 'Today is {date}.' }),
        act('app.open', { appId: 'calendar' }),
      ],
    }),
  },
  {
    id: 'file-organizer', name: 'File Organizer', category: 'Files',
    description: 'Moves files from Downloads into folders using rules you write. Edit the rules before turning it on.',
    build: () => ({
      trigger: { type: 'manual', config: {} },
      steps: [
        act('fs.organize', {
          source: '~/Downloads',
          rules: 'txt, md -> ~/Documents/Text\npng, jpg, jpeg, gif, webp, svg -> ~/Pictures\nmp3, wav, ogg -> ~/Music',
        }),
      ],
    }),
  },
  {
    id: 'night-mode', name: 'Night Mode', category: 'Desktop',
    description: 'Every day at 22:00: switch to the dark theme and Plain wallpaper, notify you and open a Night workspace.',
    build: () => ({
      trigger: { type: 'time.daily', config: { time: '22:00' } },
      steps: [
        act('desktop.theme', { theme: 'dark' }),
        act('desktop.wallpaper', { wallpaper: 'plain' }),
        act('workspace.switch', { workspace: 'Night', create: 'create' }),
        act('notify', { title: 'Night mode on', body: 'It is {time}. Good night, {user}.' }),
      ],
    }),
  },
  {
    id: 'work-hours-check', name: 'Work Hours Setup', category: 'Workspace',
    description: 'If it is between 09:00 and 17:00 open the Work setup, otherwise show a reminder. Shows how conditions branch.',
    build: () => {
      const branch = newIf()
      branch.conditions = [{ id: uid(), type: CONDITIONS.find((c) => c.type === 'time.range')!.type, config: { from: '09:00', to: '17:00' }, negate: false }]
      branch.then = [act('workspace.switch', { workspace: 'Work', create: 'create' }), act('app.open', { appId: 'browser' })]
      branch.else = [act('notify', { title: 'Outside work hours', body: 'It is {time}. Nothing was opened.' })]
      return { trigger: { type: 'manual', config: {} }, steps: [branch] }
    },
  },
]

export function fromTemplate(t: Template): Automation {
  return newAutomation({ name: t.name, description: t.description, category: t.category, ...t.build() })
}
