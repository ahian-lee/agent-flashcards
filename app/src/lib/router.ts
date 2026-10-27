/**
 * Minimal hash router.
 *
 * Hash routing (instead of history API) means the built app works from any
 * static host, from a sub-path, and — importantly for a PWA — from the service
 * worker's cached `index.html` without any rewrite rules.
 */
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'study'; deckId?: string }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'not-found'; path: string }

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const path = raw.split('?')[0] ?? ''
  const segments = path.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) return { name: 'home' }

  const [head, tail] = segments
  const deckId = tail ? safeDecode(tail) : undefined
  switch (head) {
    case 'study':
      return { name: 'study', deckId }
    case 'stats':
      return { name: 'stats' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'not-found', path }
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function hrefFor(path: string): string {
  return path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return
  const target = hrefFor(path)
  if (window.location.hash === target) return
  window.location.hash = target
}

/** Route for a deck study session (`#/study/<deckId>`) or the mixed queue. */
export function studyPath(deckId?: string): string {
  return deckId ? `/study/${encodeURIComponent(deckId)}` : '/study'
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'home' } : parseHash(window.location.hash),
  )

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
