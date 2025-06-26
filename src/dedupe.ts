type AsyncFunction = (...args: any[]) => Promise<any>

export interface DedupedFunction<F extends AsyncFunction> {
  (...args: Parameters<F>): ReturnType<F>
  settle(...args: Parameters<F>): Promise<PromiseSettledResult<Awaited<ReturnType<F>>> | undefined>
}

export function dedupe<F extends AsyncFunction>(fn: F, options?: {
  key?: (...args: Parameters<F>) => any
}): DedupedFunction<F> {
  const map = new Map<any, Promise<any>>()

  const getKey = (...args: Parameters<F>) => options?.key?.(...args) ?? args[0]

  // Create the deduped function
  const dedupedFn = (...args: Parameters<F>) => {
    const key = getKey(...args)
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

  // Add settle method
  Object.defineProperty(dedupedFn, "settle", {
    value: async (...args: Parameters<F>) => {
      const key = getKey(...args)
      const p = map.get(key)

      if (!p) {
        return undefined
      }

      return Promise.allSettled([p]).then(results => results[0])
    },
    enumerable: true,
  })

  // Copy original name
  Object.defineProperty(dedupedFn, "name", { writable: false, value: fn.name })

  return dedupedFn as DedupedFunction<F>
}
