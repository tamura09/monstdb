import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { anonymousClient, type ApiClient } from './helpers/client'
import { createTestUser, loadMasterFixtures, type MasterFixtures } from './helpers/fixtures'
import { testPrisma, disconnectTestPrisma } from './helpers/db'

// scratchpad/ownership.sh (29項目) の移植。
// 「所持キャラ・わくわくの編集が所持アカウント本人に限定されているか」の総当たり検証。
//
// 期待ステータスコードは移植元から変更していない:
//   - 他人(一般ユーザー) → 404
//   - 他人(管理者)       → 404 (adminでも他人の所持データは覗けない)
//   - 未認証             → 401

let owner: Awaited<ReturnType<typeof createTestUser>>
let otherUser: Awaited<ReturnType<typeof createTestUser>>
let adminUser: Awaited<ReturnType<typeof createTestUser>>
let anon: ApiClient
let masters: MasterFixtures

let ownerAccount: string
let ownedCharacterId: string

// 他人の操作でDBが変化していないことを確認するための基準値
let ownedCharacterCountBefore: number
let gameAccountCountBefore: number

beforeAll(async () => {
  anon = anonymousClient()
  masters = await loadMasterFixtures()

  // owner = 移植元の bob、otherUser = alice、adminUser = admin に相当
  owner = await createTestUser('user')
  otherUser = await createTestUser('user')
  adminUser = await createTestUser('admin')

  ownerAccount = owner.accounts[0].id

  // 所持キャラを作り、わくわくを2個セットしておく
  const created = await owner.client.post(`/accounts/${ownerAccount}/characters`, {
    json: { characterMasterId: masters.characters[0].id },
  })

  expect(created.status).toBe(201)
  ownedCharacterId = created.body.id

  const put = await owner.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
    json: {
      slots: [
        { wakuwakuMasterId: masters.wakuwaku[0].id, level: 'L' },
        { wakuwakuMasterId: masters.wakuwaku[1].id, level: 'L' },
      ],
    },
  })

  expect(put.status).toBe(200)

  const prisma = testPrisma()
  ownedCharacterCountBefore = await prisma.ownedCharacter.count({
    where: { gameAccount: { userId: owner.id } },
  })
  gameAccountCountBefore = await prisma.gameAccount.count({ where: { userId: owner.id } })
})

afterAll(async () => {
  await disconnectTestPrisma()
})

// 各アクターが所持者のリソースへ行う8種類の操作
function operations(client: ApiClient) {
  const put = {
    slots: [{ wakuwakuMasterId: masters.wakuwaku[0].id, level: 'EL' }],
  }

  return [
    ['GET  /accounts/{ownerAcct}/characters', () => client.get(`/accounts/${ownerAccount}/characters`)],
    [
      'POST /accounts/{ownerAcct}/characters',
      () =>
        client.post(`/accounts/${ownerAccount}/characters`, {
          json: { characterMasterId: masters.characters[0].id },
        }),
    ],
    ['GET  /owned-characters/{ownerOwned}', () => client.get(`/owned-characters/${ownedCharacterId}`)],
    [
      'DELETE /owned-characters/{ownerOwned}',
      () => client.delete(`/owned-characters/${ownedCharacterId}`),
    ],
    [
      'GET  /owned-characters/{ownerOwned}/wakuwaku',
      () => client.get(`/owned-characters/${ownedCharacterId}/wakuwaku`),
    ],
    [
      'PUT  /owned-characters/{ownerOwned}/wakuwaku',
      () => client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, { json: put }),
    ],
    [
      'DELETE /owned-characters/{ownerOwned}/wakuwaku/1',
      () => client.delete(`/owned-characters/${ownedCharacterId}/wakuwaku/1`),
    ],
    [
      'DELETE /owned-characters/{ownerOwned}/wakuwaku/2',
      () => client.delete(`/owned-characters/${ownedCharacterId}/wakuwaku/2`),
    ],
  ] as [string, () => Promise<{ status: number }>][]
}

const OPERATION_LABELS = [
  'GET  /accounts/{ownerAcct}/characters',
  'POST /accounts/{ownerAcct}/characters',
  'GET  /owned-characters/{ownerOwned}',
  'DELETE /owned-characters/{ownerOwned}',
  'GET  /owned-characters/{ownerOwned}/wakuwaku',
  'PUT  /owned-characters/{ownerOwned}/wakuwaku',
  'DELETE /owned-characters/{ownerOwned}/wakuwaku/1',
  'DELETE /owned-characters/{ownerOwned}/wakuwaku/2',
]

describe('他人(一般ユーザー)が所持者のリソースを操作 → 全て404', () => {
  it.each(OPERATION_LABELS)('%s', async (label) => {
    const operation = operations(otherUser.client).find(([name]) => name === label)!

    expect((await operation[1]()).status).toBe(404)
  })
})

describe('他人(管理者)が所持者のリソースを操作 → 全て404', () => {
  // 管理者であってもマスターデータ以外(他人の所持データ)は覗けない。
  it.each(OPERATION_LABELS)('%s', async (label) => {
    const operation = operations(adminUser.client).find(([name]) => name === label)!

    expect((await operation[1]()).status).toBe(404)
  })
})

describe('未認証が所持者のリソースを操作 → 全て401', () => {
  it.each(OPERATION_LABELS)('%s', async (label) => {
    const operation = operations(anon).find(([name]) => name === label)!

    expect((await operation[1]()).status).toBe(401)
  })
})

// 上の検証が「全部404だから通っている」だけの無意味なテストになっていないことを
// 保証するための陽性対照。所持者本人は同じ操作が通らなければならない。
describe('陽性対照: 所持者本人は操作できる', () => {
  it('GET  /accounts/{ownerAcct}/characters は200', async () => {
    expect((await owner.client.get(`/accounts/${ownerAccount}/characters`)).status).toBe(200)
  })

  it('GET  /owned-characters/{ownerOwned} は200', async () => {
    expect((await owner.client.get(`/owned-characters/${ownedCharacterId}`)).status).toBe(200)
  })

  it('GET  /owned-characters/{ownerOwned}/wakuwaku は200', async () => {
    expect((await owner.client.get(`/owned-characters/${ownedCharacterId}/wakuwaku`)).status).toBe(
      200
    )
  })

  it('PUT  /owned-characters/{ownerOwned}/wakuwaku は200', async () => {
    const response = await owner.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
      json: { slots: [{ wakuwakuMasterId: masters.wakuwaku[0].id, level: 'EL' }] },
    })

    expect(response.status).toBe(200)
  })

  it('DELETE /owned-characters/{ownerOwned}/wakuwaku/1 は204', async () => {
    expect(
      (await owner.client.delete(`/owned-characters/${ownedCharacterId}/wakuwaku/1`)).status
    ).toBe(204)
  })
})

describe('他人の操作がDBを一切変更していないこと', () => {
  it('所持キャラが増えていない(他人のPOSTが通っていない)', async () => {
    const after = await testPrisma().ownedCharacter.count({
      where: { gameAccount: { userId: owner.id } },
    })

    expect(after).toBe(ownedCharacterCountBefore)
  })

  it('所持キャラが減っていない(他人のDELETEが通っていない)', async () => {
    const stillExists = await testPrisma().ownedCharacter.findUnique({
      where: { id: ownedCharacterId },
    })

    expect(stillExists).not.toBeNull()
  })

  it('ゲームアカウント数が変わっていない', async () => {
    const after = await testPrisma().gameAccount.count({ where: { userId: owner.id } })

    expect(after).toBe(gameAccountCountBefore)
  })
})
