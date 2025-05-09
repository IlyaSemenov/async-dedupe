export function dedupe<Fn extends (arg: any) => Promise<any>>(fn: Fn): Fn {
  const map = new Map()
  const dedupedFn = (arg: unknown) => {
    const p = map.get(arg)
    if (p) {
      return p
    } else {
      const p = fn(arg).finally(() => {
        map.delete(arg)
      })
      map.set(arg, p)
      return p
    }
  }
  Object.defineProperty(dedupedFn, "name", { writable: false, value: fn.name })
  return dedupedFn as Fn
}
