const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Only web, mail and in-page links are allowed; anything else (e.g. javascript:) becomes "#". */
const safeUrl = (url: string) => (/^(https?:\/\/|mailto:|#|\/)/i.test(url) ? url : '#')

function inline(text: string): string {
  // All user text is escaped first, so the tags added below are the only markup in the output.
  let s = escapeHtml(text)
  const codes: string[] = []
  s = s.replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!_)/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => `<a href="${safeUrl(url)}" data-md-link>${label}</a>`)
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`)
}

/** Small, dependency-free Markdown to HTML: headings, lists, quotes, code, rules, emphasis and links. */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null
  let quote: string[] = []

  const flushParagraph = () => { if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [] }
  const flushList = () => { if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null }
  const flushQuote = () => { if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); quote = [] }
  const flushAll = () => { flushParagraph(); flushList(); flushQuote() }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^```/.test(line)) {
      flushAll()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }
    if (!line.trim()) { flushAll(); continue }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) { flushAll(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue }
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue }

    const q = /^>\s?(.*)$/.exec(line)
    if (q) { flushParagraph(); flushList(); quote.push(q[1]); continue }

    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ul || ol) {
      flushParagraph(); flushQuote()
      const type = ul ? 'ul' : 'ol'
      if (list && list.type !== type) flushList()
      list ??= { type, items: [] }
      list.items.push((ul ?? ol)![1])
      continue
    }

    flushList(); flushQuote()
    paragraph.push(line)
  }
  flushAll()
  return out.join('\n')
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
