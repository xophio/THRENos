import { Fragment } from 'react'
import { isCommand } from './commands'
import { tokenize } from './parser'

const BREAKERS = new Set([';', '&&', '||', '|'])

/**
 * Colors a command line using the Swiss palette only: ink weights, hairline underlines
 * and signal red for operators and mistakes.
 */
export function Highlight({ text }: { text: string }) {
  const { tokens } = tokenize(text)
  let expectCommand = true
  let expectTarget = false

  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === 'space') return <Fragment key={i}>{t.raw}</Fragment>
        let cls = 'text-white/90'
        if (t.kind === 'op') {
          cls = 'font-semibold text-signal'
          expectCommand = BREAKERS.has(t.value)
          expectTarget = t.value === '>' || t.value === '>>'
        } else if (expectCommand) {
          cls = isCommand(t.value) ? 'font-semibold text-white' : 'text-signal underline decoration-wavy underline-offset-[3px]'
          expectCommand = false
        } else if (expectTarget) {
          cls = 'underline decoration-white/40 underline-offset-[3px]'
          expectTarget = false
        } else if (/^["']/.test(t.raw)) cls = 'italic text-white/85'
        else if (/^-./.test(t.raw)) cls = 'text-white/55'
        else if (/\$(\?|[A-Za-z_])/.test(t.raw)) cls = 'italic text-signal'
        else if (/^[~.]|\//.test(t.raw)) cls = 'underline decoration-white/40 underline-offset-[3px]'
        return <span key={i} className={cls}>{t.raw}</span>
      })}
    </>
  )
}
