import { expect, it } from "vitest"

import { dedupe } from "./dedupe"

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

it("works", async () => {
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

it("handles throw", async () => {
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

it("keeps original function name", () => {
  // eslint-disable-next-line prefer-arrow-callback
  const f = dedupe(async function boo() {
    return "boo"
  })
  expect(f.name).toEqual("boo")
})

it("passes multiple arguments", async () => {
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

it("uses key callback", async () => {
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
