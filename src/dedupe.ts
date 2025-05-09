export function dedupe<F extends (...args: any[]) => Promise<any>>(fn: F, options?: {
  key?: (...args: Parameters<F>) => any
}): F {
  const map = new Map()
  const dedupedFn = (...args: Parameters<F>) => {
    const key = options?.key?.(...args) ?? args[0]
    const p = map.get(key)
    if (p) {
      return p
    } else {
      const p = fn(...args).finally(() => {
        map.delete(key)
      })
      map.set(key, p)
      return p
    }
  }
  Object.defineProperty(dedupedFn, "name", { writable: false, value: fn.name })
  return dedupedFn as F
}
