import { describe, expect, it } from "vitest"

import { dedupe } from "./dedupe"

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe("deduplication", () => {
  it("deduplicates calls with the same argument", async () => {
    let count = 0
    const fetch = dedupe(async (_id: number) => {
      const callId = ++count
      await sleep(10)
      return callId
    })
    expect(
      await Promise.all([fetch(1), fetch(2), fetch(1), fetch(3), fetch(2), fetch(4)]),
    ).toEqual(
      [1, 2, 1, 3, 2, 4],
    )
    expect(
      await Promise.all([fetch(1), fetch(2), fetch(100), fetch(1)]),
    ).toEqual(
      [5, 6, 7, 5],
    )
  })

  it("deduplicates calls with multiple arguments", async () => {
    const fetch = dedupe(async (_id: number, res: string) => {
      await sleep(10)
      return res
    })
    expect(
      await Promise.all([fetch(1, "r1"), fetch(2, "r2"), fetch(1, "r3"), fetch(3, "r4"), fetch(2, "r5"), fetch(4, "r6")]),
    ).toEqual(
      ["r1", "r2", "r1", "r4", "r2", "r6"],
    )
  })

  it("deduplicates calls with no arguments", async () => {
    let count = 0
    const fetch = dedupe(async () => {
      const callId = ++count
      await sleep(10)
      return callId
    })

    // Start multiple concurrent calls with no arguments
    const results = await Promise.all([
      fetch(),
      fetch(),
      fetch(),
      fetch(),
    ])

    // All calls should return the same value (first call's result)
    expect(results).toEqual([1, 1, 1, 1])

    // After all promises settle, a new call should create a new result
    expect(await fetch()).toBe(2)
  })

  it("uses custom key function for deduplication", async () => {
    const fetch = dedupe(async (id: number, _key: string) => {
      await sleep(10)
      return id
    }, {
      key: (_id, key) => key,
    })
    expect(
      await Promise.all([fetch(1, "r1"), fetch(2, "r2"), fetch(3, "r1"), fetch(4, "r3"), fetch(5, "r2"), fetch(6, "r4")]),
    ).toEqual(
      [1, 2, 1, 4, 2, 6],
    )
  })
})

describe("error handling", () => {
  it("properly handles rejected promises", async () => {
    let count = 0
    const fetch = dedupe(async (_id: number) => {
      const callId = ++count
      await sleep(10)
      if (callId === 1 || callId === 4) {
        throw callId
      }
      return callId
    })
    expect(
      await Promise.allSettled([fetch(1), fetch(2), fetch(1)]),
    ).toEqual(
      [{ status: "rejected", reason: 1 }, { status: "fulfilled", value: 2 }, { status: "rejected", reason: 1 }],
    )
    expect(
      await Promise.allSettled([fetch(1), fetch(2), fetch(1), fetch(100)]),
    ).toEqual(
      [{ status: "fulfilled", value: 3 }, { status: "rejected", reason: 4 }, { status: "fulfilled", value: 3 }, { status: "fulfilled", value: 5 }],
    )
  })
})

it("keeps original function name", () => {
  // eslint-disable-next-line prefer-arrow-callback
  const f = dedupe(async function boo() {
    return "boo"
  })
  expect(f.name).toEqual("boo")
})

describe("settle method", () => {
  it("returns undefined when no promise is running", async () => {
    const fetch = dedupe(async (id: number) => {
      await sleep(50)
      return id * 2
    })

    const result = await fetch.settle(42)
    expect(result).toBeUndefined()
  })

  it("waits for a running promise and returns fulfilled result", async () => {
    const fetch = dedupe(async (id: number) => {
      await sleep(50)
      return id * 2
    })

    // Start a promise
    const promise = fetch(42)

    // Settle should wait for it and return the fulfilled result
    const result = await fetch.settle(42)
    expect(result).toEqual({ status: "fulfilled", value: 84 })

    // The original promise should still resolve normally
    expect(await promise).toBe(84)
  })

  it("waits for a running promise and returns rejected result", async () => {
    const fetch = dedupe(async (id: number) => {
      await sleep(50)
      if (id === 42) {
        throw new Error("Test error")
      }
      return id * 2
    })

    // Start a promise that will reject
    const promise = fetch(42)

    // Settle should wait for it and return the rejected result
    const result = await fetch.settle(42)
    expect(result?.status).toBe("rejected")
    if (result?.status === "rejected") {
      expect(result.reason).toBeInstanceOf(Error)
      expect(result.reason.message).toBe("Test error")
    }

    // The original promise should still reject normally
    await expect(promise).rejects.toThrow("Test error")
  })

  it("works with key function", async () => {
    const fetch = dedupe(async (id: number, label: string) => {
      await sleep(50)
      return `${label}-${id}`
    }, {
      key: (_id, label) => label,
    })

    // Start a promise with key "test"
    const promise = fetch(1, "test")

    // Should find the promise with the same key, even with different id
    const result = await fetch.settle(999, "test")
    expect(result).toEqual({ status: "fulfilled", value: "test-1" })

    // The original promise should still resolve normally
    expect(await promise).toBe("test-1")
  })

  it("doesn't create a new promise if none exists", async () => {
    let callCount = 0
    const fetch = dedupe(async (id: number) => {
      callCount++
      await sleep(50)
      return id * 2
    })

    // Settle with no existing promise
    const result = await fetch.settle(42)
    expect(result).toBeUndefined()

    // No function call should have been made
    expect(callCount).toBe(0)
  })
})
