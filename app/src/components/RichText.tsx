import type { ReactNode } from 'react'
import { useMemo } from 'react'

/**
 * Deliberately tiny Markdown renderer for card content (no dependency):
 * paragraphs, `-`/`*` bullet lists, `1.` ordered lists, fenced code blocks and
 * inline `**bold**` / `` `code` ``. The deck content is written in exactly this
 * subset, so this keeps the bundle small while staying readable.
 */

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; code: string }

const LIST_ITEM = /^\s*[-*+]\s+(.*)$/
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/
const FENCE = /^\s*```/

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }

    if (FENCE.test(line)) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !FENCE.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '')
        index += 1
      }
      index += 1 // closing fence
      blocks.push({ kind: 'code', code: code.join('\n') })
      continue
    }

    if (LIST_ITEM.test(line)) {
      const items: string[] = []
      while (index < lines.length && LIST_ITEM.test(lines[index] ?? '')) {
        items.push((LIST_ITEM.exec(lines[index] ?? '')?.[1] ?? '').trim())
        index += 1
      }
      blocks.push({ kind: 'list', ordered: false, items })
      continue
    }

    if (ORDERED_ITEM.test(line)) {
      const items: string[] = []
      while (index < lines.length && ORDERED_ITEM.test(lines[index] ?? '')) {
        items.push((ORDERED_ITEM.exec(lines[index] ?? '')?.[1] ?? '').trim())
        index += 1
      }
      blocks.push({ kind: 'list', ordered: true, items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (current.trim() === '' || LIST_ITEM.test(current) || ORDERED_ITEM.test(current) || FENCE.test(current)) {
        break
      }
      paragraph.push(current)
      index += 1
    }
    blocks.push({ kind: 'paragraph', lines: paragraph })
  }

  return blocks
}

const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/g

/** Inline formatting only; safe (no HTML injection, everything is text nodes). */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let key = 0
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const start = match.index ?? 0
    if (start > cursor) nodes.push(text.slice(cursor, start))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`s${key++}`}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(
        <code key={`c${key++}`} className="inline-code">
          {token.slice(1, -1)}
        </code>,
      )
    }
    cursor = start + token.length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <div className={className ? `rich ${className}` : 'rich'}>
      {blocks.map((block, index) => {
        if (block.kind === 'code') {
          return (
            <pre key={`b${index}`} className="rich__code">
              <code>{block.code}</code>
            </pre>
          )
        }
        if (block.kind === 'list') {
          const items = block.items.map((item, itemIndex) => (
            <li key={`i${itemIndex}`}>{renderInline(item)}</li>
          ))
          return block.ordered ? (
            <ol key={`b${index}`} className="rich__list">
              {items}
            </ol>
          ) : (
            <ul key={`b${index}`} className="rich__list">
              {items}
            </ul>
          )
        }
        return (
          <p key={`b${index}`} className="rich__p">
            {block.lines.map((line, lineIndex) => (
              <span key={`l${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
