/**
 * Tiny reactive glue between IndexedDB and React.
 *
 * Instead of pulling in dexie-react-hooks, every mutation calls
 * `notifyDbChanged()` and hooks re-run their loader. One tick counter is enough
 * for an app where all writes go through a handful of functions.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Listener = () => void

const listeners = new Set<Listener>()
let tick = 0

export function notifyDbChanged(): void {
  tick += 1
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // a broken subscriber must never break the write path
    }
  }
}

export function subscribeDb(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDbTick(): number {
  const [value, setValue] = useState(tick)
  useEffect(
    () =>
      subscribeDb(() => {
        setValue(tick)
      }),
    [],
  )
  return value
}

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/**
 * Load async data, re-running whenever `key` changes or the DB tick bumps.
 * The loader is kept in a ref so callers can pass inline closures freely.
 */
export function useAsyncData<T>(loader: () => Promise<T>, key: unknown = 0): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const tickValue = useDbTick()
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loaderRef
      .current()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [key, nonce, tickValue])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  return { data, error, loading, reload }
}
