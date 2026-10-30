import { useState } from 'react'
import type { ComponentType } from 'react'
import type { AppProps } from '../types'
import { PersonalizationPage } from './settings/PersonalizationPage'
import { DisplayPage } from './settings/DisplayPage'
import { TaskbarPage } from './settings/TaskbarPage'
import { SoundPage } from './settings/SoundPage'
import { SystemPage } from './settings/SystemPage'

const TABS = [
  { id: 'personalization', label: 'Personalization', page: PersonalizationPage },
  { id: 'display', label: 'Display', page: DisplayPage },
  { id: 'taskbar', label: 'Taskbar', page: TaskbarPage },
  { id: 'sound', label: 'Sound', page: SoundPage },
  { id: 'system', label: 'System', page: SystemPage },
] as const satisfies readonly { id: string; label: string; page: ComponentType }[]

type TabId = (typeof TABS)[number]['id']

export function SettingsApp(_: AppProps) {
  const [tab, setTab] = useState<TabId>('personalization')
  const index = Math.max(0, TABS.findIndex((t) => t.id === tab))
  const active = TABS[index]
  const Page = active.page

  return (
    <div className="relative flex h-full">
      <nav className="flex w-52 shrink-0 flex-col border-r border-ink bg-sidebar max-sm:w-14">
        <div className="border-b border-ink px-4 py-3 max-sm:hidden">
          <div className="kicker !text-ink">Settings</div>
        </div>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            data-tab={t.id}
            aria-current={tab === t.id}
            title={t.label}
            onClick={() => setTab(t.id)}
            className={`flex w-full items-baseline gap-3 border-b border-rule-soft px-4 py-3 text-left text-[13px] font-medium transition-colors max-sm:justify-center max-sm:px-0 ${
              tab === t.id ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'
            }`}
          >
            <span className={`font-mono text-[10px] ${tab === t.id ? 'text-paper/70' : 'text-white/60'}`}>{String(i + 1).padStart(2, '0')}</span>
            <span className="max-sm:hidden">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto px-8 pb-6 pt-6">
        <div className="mb-7 flex items-end justify-between border-b-2 border-ink pb-3">
          <h2 className="text-[34px] font-bold leading-none tracking-[-0.045em]">{active.label}</h2>
          <span className="font-mono text-[11px] text-white/55">{String(index + 1).padStart(2, '0')} / {String(TABS.length).padStart(2, '0')}</span>
        </div>
        <Page />
      </div>
    </div>
  )
}
