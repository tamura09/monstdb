import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, loadMasterFixtures, type MasterFixtures } from './helpers/fixtures'
import { testPrisma, disconnectTestPrisma } from './helpers/db'

// lib/wakuwaku/slots.ts のアドバイザリロック(pg_advisory_xact_lock)の回帰テスト。
//
// 修正前に実際に起きていた不具合:
//   1. PUT の deleteMany → create の間に別トランザクションが割り込み、
//      @@unique([ownedCharacterId, slotNumber]) 違反 (P2002 → 409) が多発した。
//      12並列で 10件が409になっていた。
//   2. normalizeSlotNumbers の 2N 回の UPDATE を並行トランザクションが
//      異なる順序で行ロック取得し、デッドロック (SQLSTATE 40P01) が発生。
//      DELETE の並行実行で 500 が返っていた。
//
// このテストは「同一 ownedCharacter への並行操作が直列化されていること」を
// HTTP レベルで確認する。ロックが外れると再び409/500が出て失敗する。

const PARALLEL_PUT_COUNT = 12

let user: Awaited<ReturnType<typeof createTestUser>>
let masters: MasterFixtures

beforeAll(async () => {
  masters = await loadMasterFixtures()
  user = await createTestUser('user')
})

afterAll(async () => {
  await disconnectTestPrisma()
})

async function createOwnedCharacter(accountIndex: number): Promise<string> {
  const response = await user.client.post(
    `/accounts/${user.accounts[accountIndex].id}/characters`,
    { json: { characterMasterId: masters.characters[0].id } }
  )

  expect(response.status).toBe(201)

  return response.body.id
}

// スロット番号が 1..N の連番かつ重複が無いことを検証する
async function expectContiguousSlotNumbers(ownedCharacterId: string): Promise<number> {
  const slots = await testPrisma().ownedCharacterWakuwaku.findMany({
    where: { ownedCharacterId },
    orderBy: { slotNumber: 'asc' },
  })

  const slotNumbers = slots.map((slot) => slot.slotNumber)
  const expected = Array.from({ length: slots.length }, (_, index) => index + 1)

  // 重複が無い
  expect(new Set(slotNumbers).size).toBe(slotNumbers.length)
  // 1..N の連番になっている
  expect(slotNumbers).toEqual(expected)

  return slots.length
}

describe('同一ownedCharacterへの並行PUT', () => {
  let ownedCharacterId: string

  beforeAll(async () => {
    ownedCharacterId = await createOwnedCharacter(0)
  })

  it(`PUT /wakuwaku を${PARALLEL_PUT_COUNT}並列で投げても全て200になる (修正前は409が10件)`, async () => {
    // 毎回わずかに異なるセットを送ることで、単なる冪等な上書きではなく
    // 実際に delete → create が競合する状況を作る。
    const requests = Array.from({ length: PARALLEL_PUT_COUNT }, (_, index) => {
      const slots = masters.wakuwaku
        .slice(0, (index % 4) + 1)
        .map((wakuwaku) => ({
          wakuwakuMasterId: wakuwaku.id,
          level: index % 2 === 0 ? 'L' : 'EL',
        }))

      return user.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, { json: { slots } })
    })

    const responses = await Promise.all(requests)
    const statuses = responses.map((response) => response.status)

    // 409 (一意制約違反・デッドロック) も 500 も出てはいけない
    expect(statuses.filter((status) => status === 409)).toHaveLength(0)
    expect(statuses.filter((status) => status === 500)).toHaveLength(0)
    expect(statuses).toEqual(Array(PARALLEL_PUT_COUNT).fill(200))
  })

  it('並行PUTの後もスロット番号が1..Nの連番で重複が無い', async () => {
    const count = await expectContiguousSlotNumbers(ownedCharacterId)

    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(4)
  })
})

describe('スロット1〜4への並行DELETE', () => {
  let ownedCharacterId: string

  beforeAll(async () => {
    ownedCharacterId = await createOwnedCharacter(1)

    const response = await user.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
      json: {
        slots: masters.wakuwaku
          .slice(0, 4)
          .map((wakuwaku) => ({ wakuwakuMasterId: wakuwaku.id, level: 'L' })),
      },
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(4)
  })

  it('スロット1〜4を同時にDELETEしても500(デッドロック)が出ない', async () => {
    const responses = await Promise.all(
      [1, 2, 3, 4].map((slotNumber) =>
        user.client.delete(`/owned-characters/${ownedCharacterId}/wakuwaku/${slotNumber}`)
      )
    )

    const statuses = responses.map((response) => response.status)

    // 削除に伴いスロットが詰め直されるため、後発のリクエストが
    // 404 (対象スロットが既に無い) になるのは正常。
    // デッドロック起因の 500、および競合起因の 409 が出ないことが要件。
    expect(statuses.filter((status) => status === 500)).toHaveLength(0)
    expect(statuses.filter((status) => status === 409)).toHaveLength(0)

    for (const status of statuses) {
      expect([204, 404]).toContain(status)
    }

    // 直列化されていれば少なくとも1件は実際に削除できている
    expect(statuses.filter((status) => status === 204).length).toBeGreaterThan(0)
  })

  it('並行DELETEの後もスロット番号が1..Nの連番で重複が無い', async () => {
    await expectContiguousSlotNumbers(ownedCharacterId)
  })
})

describe('PUTとDELETEの混在並行実行', () => {
  let ownedCharacterId: string

  beforeAll(async () => {
    ownedCharacterId = await createOwnedCharacter(2)

    await user.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
      json: {
        slots: masters.wakuwaku
          .slice(0, 4)
          .map((wakuwaku) => ({ wakuwakuMasterId: wakuwaku.id, level: 'L' })),
      },
    })
  })

  it('PUTとDELETEを同時に投げても500・409が出ない', async () => {
    const puts = Array.from({ length: 6 }, (_, index) =>
      user.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
        json: {
          slots: masters.wakuwaku
            .slice(0, (index % 4) + 1)
            .map((wakuwaku) => ({ wakuwakuMasterId: wakuwaku.id, level: 'L' })),
        },
      })
    )

    const deletes = [1, 2, 3, 4].map((slotNumber) =>
      user.client.delete(`/owned-characters/${ownedCharacterId}/wakuwaku/${slotNumber}`)
    )

    const responses = await Promise.all([...puts, ...deletes])
    const statuses = responses.map((response) => response.status)

    expect(statuses.filter((status) => status === 500)).toHaveLength(0)
    expect(statuses.filter((status) => status === 409)).toHaveLength(0)
  })

  it('混在並行実行の後もスロット番号が1..Nの連番で重複が無い', async () => {
    await expectContiguousSlotNumbers(ownedCharacterId)
  })
})
