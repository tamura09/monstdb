import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { anonymousClient, type ApiClient } from './helpers/client'
import {
  createTestUser,
  loadMasterFixtures,
  uniqueIndexNumber,
  type TestUser,
  type MasterFixtures,
} from './helpers/fixtures'
import { testPrisma, disconnectTestPrisma } from './helpers/db'

// scratchpad/apitest.sh (55項目) の移植。
// 期待ステータスコードは移植元から一切変更していない。
//
// 移植元は固定の indexNumber / 固定ユーザーIDを使っており2回目の実行で
// 409 になったため、ユーザーは毎回新規作成し、indexNumber は
// uniqueIndexNumber() で採番して冪等にしている。

let alice: TestUser
let admin: TestUser
let bob: TestUser
let anon: ApiClient
let masters: MasterFixtures

// alice が使うゲームアカウント
let aliceAccount: string
// bob のリソース(他人のリソースとしてアクセスを試す対象)
let bobAccount: string
let bobOwnedCharacterId: string

beforeAll(async () => {
  anon = anonymousClient()
  masters = await loadMasterFixtures()

  admin = await createTestUser('admin')
  alice = await createTestUser('user')
  bob = await createTestUser('user')

  aliceAccount = alice.accounts[0].id
  bobAccount = bob.accounts[0].id

  // bob の所持キャラを1体作っておく(他人のリソースへのアクセス検証用)
  const bobOwned = await testPrisma().ownedCharacter.create({
    data: { gameAccountId: bobAccount, characterMasterId: masters.characters[0].id },
  })
  bobOwnedCharacterId = bobOwned.id
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe('1. 認証ガード (未認証は全て401)', () => {
  // パスは beforeAll で作られるfixtureに依存するため、実行時に解決できるよう
  // 文字列ではなく関数で保持する。
  const guardedGetPaths: [string, () => string][] = [
    ['/characters', () => '/characters'],
    ['/characters/{id}', () => `/characters/${masters.characters[0].id}`],
    ['/accounts', () => '/accounts'],
    ['/accounts/{id}/characters', () => `/accounts/${aliceAccount}/characters`],
    ['/owned-characters/{id}', () => `/owned-characters/${bobOwnedCharacterId}`],
    [
      '/owned-characters/{id}/wakuwaku',
      () => `/owned-characters/${bobOwnedCharacterId}/wakuwaku`,
    ],
    ['/wakuwaku-masters', () => '/wakuwaku-masters'],
  ]

  it.each(guardedGetPaths)('GET %s (no auth) は401', async (_label, path) => {
    const response = await anon.get(path())

    expect(response.status).toBe(401)
  })

  it('POST /characters (no auth) は401', async () => {
    const response = await anon.post('/characters', {
      json: { indexNumber: uniqueIndexNumber(), monsterName: 'X', element: '火', type: '恒常' },
    })

    expect(response.status).toBe(401)
  })

  it('DELETE /characters/{id} (no auth) は401', async () => {
    const response = await anon.delete(`/characters/${masters.characters[0].id}`)

    expect(response.status).toBe(401)
  })
})

describe('2. admin権限 (一般ユーザーは403)', () => {
  it('POST /characters (alice=user) は403', async () => {
    const response = await alice.client.post('/characters', {
      json: { indexNumber: uniqueIndexNumber(), monsterName: 'X', element: '火', type: '恒常' },
    })

    expect(response.status).toBe(403)
  })

  it('PATCH /characters/{id} (alice) は403', async () => {
    const response = await alice.client.patch(`/characters/${masters.characters[0].id}`, {
      json: { monsterName: 'X' },
    })

    expect(response.status).toBe(403)
  })

  it('DELETE /characters/{id} (alice) は403', async () => {
    const response = await alice.client.delete(`/characters/${masters.characters[0].id}`)

    expect(response.status).toBe(403)
  })
})

describe('3. 所有権 (他人のリソースは404)', () => {
  it('GET /accounts/{bobAcct}/characters (alice) は404', async () => {
    expect((await alice.client.get(`/accounts/${bobAccount}/characters`)).status).toBe(404)
  })

  it('POST /accounts/{bobAcct}/characters (alice) は404', async () => {
    const response = await alice.client.post(`/accounts/${bobAccount}/characters`, {
      json: { characterMasterId: masters.characters[0].id },
    })

    expect(response.status).toBe(404)
  })

  it('GET /owned-characters/{bobOwned} (alice) は404', async () => {
    expect((await alice.client.get(`/owned-characters/${bobOwnedCharacterId}`)).status).toBe(404)
  })

  it('DELETE /owned-characters/{bobOwned} (alice) は404', async () => {
    expect((await alice.client.delete(`/owned-characters/${bobOwnedCharacterId}`)).status).toBe(404)
  })

  it('PUT /owned-characters/{bobOwned}/wakuwaku (alice) は404', async () => {
    const response = await alice.client.put(
      `/owned-characters/${bobOwnedCharacterId}/wakuwaku`,
      { json: { slots: [] } }
    )

    expect(response.status).toBe(404)
  })
})

describe('4. 参照系 (正常)', () => {
  it('GET /characters (alice) は200でページネーション情報を含む', async () => {
    const response = await alice.client.get('/characters')

    expect(response.status).toBe(200)
    expect(response.body.pagination.perPage).toBe(50)
    expect(response.body.pagination.total).toBeGreaterThan(0)
    // 既定の perPage=50 を超えて返さない
    expect(response.body.data.length).toBeLessThanOrEqual(50)
    expect(response.body.data.length).toBe(
      Math.min(50, response.body.pagination.total)
    )
  })

  it('GET /characters?element=火&perPage=5 は絞り込みとページサイズが効く', async () => {
    const response = await alice.client.get('/characters', {
      query: '?element=%E7%81%AB&perPage=5',
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(5)
    // 返ってきた要素が全て「火」であること
    expect([...new Set(response.body.data.map((c: any) => c.element))]).toEqual(['火'])
  })

  it('GET /characters?search=すさのお はかなを区別せずヒットする', async () => {
    const response = await alice.client.get('/characters', {
      query: '?search=%E3%81%99%E3%81%95%E3%81%AE%E3%81%8A',
    })

    expect(response.status).toBe(200)
    expect(response.body.pagination.total).toBeGreaterThan(0)
    // ひらがなで検索してカタカナ名のキャラが引けていること
    const names: string[] = response.body.data.map((c: any) => c.monsterName)
    expect(names.some((name) => name.includes('スサノオ'))).toBe(true)
  })

  it('GET /characters/{id} は200', async () => {
    const response = await alice.client.get(`/characters/${masters.characters[0].id}`)

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(masters.characters[0].id)
  })

  it('GET /characters/{存在しない} は404', async () => {
    expect((await alice.client.get('/characters/nonexistent-id')).status).toBe(404)
  })

  it('GET /accounts (alice) は自分の4アカウントのみを返す', async () => {
    const response = await alice.client.get('/accounts')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(4)
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      'accountNumber',
      'id',
      'name',
      'ownedCharacterCount',
    ])
    // 他人(bob)のアカウントが混ざっていないこと
    const ids: string[] = response.body.data.map((a: any) => a.id)
    expect(ids).not.toContain(bobAccount)
  })

  it('GET /wakuwaku-masters は200でマスター一覧を返す', async () => {
    const response = await alice.client.get('/wakuwaku-masters')

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
  })
})

describe('5. バリデーション', () => {
  it('POST /characters indexNumber=文字列 は422', async () => {
    const response = await admin.client.post('/characters', {
      json: { indexNumber: 'abc', monsterName: 'X', element: '火', type: '恒常' },
    })

    expect(response.status).toBe(422)
  })

  it('POST /characters element=不正 は422', async () => {
    const response = await admin.client.post('/characters', {
      json: { indexNumber: uniqueIndexNumber(), monsterName: 'X', element: '雷', type: '恒常' },
    })

    expect(response.status).toBe(422)
  })

  it('POST /characters monsterName空 は422', async () => {
    const response = await admin.client.post('/characters', {
      json: { indexNumber: uniqueIndexNumber(), monsterName: '', element: '火', type: '恒常' },
    })

    expect(response.status).toBe(422)
  })

  it('POST /characters 壊れたJSON は422', async () => {
    const response = await admin.client.post('/characters', { raw: '{oops' })

    expect(response.status).toBe(422)
  })

  it('POST /accounts/{a}/characters 存在しないmasterId は422', async () => {
    const response = await alice.client.post(`/accounts/${aliceAccount}/characters`, {
      json: { characterMasterId: 'nope' },
    })

    expect(response.status).toBe(422)
  })
})

describe('6. キャラマスターCRUD (admin)', () => {
  let createdId: string
  let createdIndexNumber: number

  it('POST /characters 作成 は201', async () => {
    createdIndexNumber = uniqueIndexNumber()

    const response = await admin.client.post('/characters', {
      json: {
        indexNumber: createdIndexNumber,
        monsterName: 'デバッグ用キャラ',
        element: '光',
        type: '限定',
      },
    })

    expect(response.status).toBe(201)
    expect(response.body.monsterName).toBe('デバッグ用キャラ')
    expect(response.headers.get('location')).toBe(`/api/v1/characters/${response.body.id}`)

    createdId = response.body.id
  })

  it('POST /characters indexNumber重複 は409', async () => {
    const response = await admin.client.post('/characters', {
      json: {
        indexNumber: createdIndexNumber,
        monsterName: '別名',
        element: '火',
        type: '恒常',
      },
    })

    expect(response.status).toBe(409)
  })

  it('PATCH /characters/{id} 部分更新 は200で他のフィールドを維持する', async () => {
    const response = await admin.client.patch(`/characters/${createdId}`, {
      json: { monsterName: '改名後' },
    })

    expect(response.status).toBe(200)
    expect(response.body.monsterName).toBe('改名後')
    // 指定しなかったフィールドは元のまま
    expect(response.body.element).toBe('光')
    expect(response.body.type).toBe('限定')
  })

  it('PATCH /characters/{id} 空ボディ は200(変更なし)', async () => {
    const response = await admin.client.patch(`/characters/${createdId}`, { json: {} })

    expect(response.status).toBe(200)
    expect(response.body.monsterName).toBe('改名後')
  })

  it('PATCH indexNumber他と重複 は409', async () => {
    const response = await admin.client.patch(`/characters/${createdId}`, {
      json: { indexNumber: masters.characters[0].indexNumber },
    })

    expect(response.status).toBe(409)
  })

  it('DELETE /characters/{id} は204', async () => {
    const response = await admin.client.delete(`/characters/${createdId}`)

    expect(response.status).toBe(204)
  })

  it('DELETE /characters/{id} 再度 は404', async () => {
    const response = await admin.client.delete(`/characters/${createdId}`)

    expect(response.status).toBe(404)
  })
})

describe('7. 所持キャラCRUD (alice)', () => {
  let ownedCharacterId: string

  it('POST 所持キャラ登録 は201でLocationヘッダを返す', async () => {
    const response = await alice.client.post(`/accounts/${aliceAccount}/characters`, {
      json: { characterMasterId: masters.characters[0].id },
    })

    expect(response.status).toBe(201)
    ownedCharacterId = response.body.id
    expect(response.headers.get('location')).toBe(`/api/v1/owned-characters/${ownedCharacterId}`)
  })

  it('POST 同キャラ2体目 は201 (複数所持可)', async () => {
    const response = await alice.client.post(`/accounts/${aliceAccount}/characters`, {
      json: { characterMasterId: masters.characters[0].id },
    })

    expect(response.status).toBe(201)
    // 同じキャラでも別レコードとして作成される(冪等ではない)
    expect(response.body.id).not.toBe(ownedCharacterId)
  })

  it('GET 所持キャラ一覧 は200', async () => {
    const response = await alice.client.get(`/accounts/${aliceAccount}/characters`)

    expect(response.status).toBe(200)
    expect(response.body.pagination.total).toBe(2)
  })

  it('GET /owned-characters/{id} は200', async () => {
    const response = await alice.client.get(`/owned-characters/${ownedCharacterId}`)

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(ownedCharacterId)
  })
})

describe('8. わくわくセット', () => {
  let ownedCharacterId: string

  beforeAll(async () => {
    const response = await alice.client.post(`/accounts/${alice.accounts[1].id}/characters`, {
      json: { characterMasterId: masters.characters[0].id },
    })

    ownedCharacterId = response.body.id
  })

  const wakuwakuPath = () => `/owned-characters/${ownedCharacterId}/wakuwaku`

  it('GET わくわく (空) は200でmaxSlots=4', async () => {
    const response = await alice.client.get(wakuwakuPath())

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(0)
    expect(response.body.maxSlots).toBe(4)
  })

  it('PUT わくわく4個 (上限) は200でdisplayOrder昇順に並ぶ', async () => {
    const [w0, w1, w2, w3] = masters.wakuwaku

    // わざと displayOrder の昇順ではない順序で送る
    const response = await alice.client.put(wakuwakuPath(), {
      json: {
        slots: [
          { wakuwakuMasterId: w3.id, level: 'L' },
          { wakuwakuMasterId: w1.id, level: 'EL' },
          { wakuwakuMasterId: w0.id, level: 'L' },
          { wakuwakuMasterId: w2.id, level: 'EL' },
        ],
      },
    })

    expect(response.status).toBe(200)

    const slotNumbers = response.body.data.map((s: any) => s.slotNumber)
    const displayOrders = response.body.data.map((s: any) => s.wakuwakuMaster.displayOrder)

    // slotNumber は 1..4 の連番
    expect(slotNumbers).toEqual([1, 2, 3, 4])
    // displayOrder 昇順にソートされて格納されている
    expect(displayOrders).toEqual([...displayOrders].sort((a: number, b: number) => a - b))
    expect(displayOrders).toEqual([w0, w1, w2, w3].map((w) => w.displayOrder))
    // level は各わくわくに紐づいたまま保持される
    const levelByMasterId = Object.fromEntries(
      response.body.data.map((s: any) => [s.wakuwakuMaster.id, s.level])
    )
    expect(levelByMasterId[w0.id]).toBe('L')
    expect(levelByMasterId[w1.id]).toBe('EL')
    expect(levelByMasterId[w2.id]).toBe('EL')
    expect(levelByMasterId[w3.id]).toBe('L')
  })

  it('PUT わくわく5個 (上限超過) は422', async () => {
    const response = await alice.client.put(wakuwakuPath(), {
      json: {
        slots: masters.wakuwaku.slice(0, 5).map((w) => ({ wakuwakuMasterId: w.id, level: 'L' })),
      },
    })

    expect(response.status).toBe(422)
  })

  it('PUT わくわく重複ID は422', async () => {
    const response = await alice.client.put(wakuwakuPath(), {
      json: {
        slots: [
          { wakuwakuMasterId: masters.wakuwaku[0].id, level: 'L' },
          { wakuwakuMasterId: masters.wakuwaku[0].id, level: 'L' },
        ],
      },
    })

    expect(response.status).toBe(422)
  })

  it('PUT わくわく存在しないID は422', async () => {
    const response = await alice.client.put(wakuwakuPath(), {
      json: { slots: [{ wakuwakuMasterId: 'nope', level: 'L' }] },
    })

    expect(response.status).toBe(422)
  })

  it('PUT level不正 は422', async () => {
    const response = await alice.client.put(wakuwakuPath(), {
      json: { slots: [{ wakuwakuMasterId: masters.wakuwaku[0].id, level: 'XL' }] },
    })

    expect(response.status).toBe(422)
  })

  it('422になった一連のPUTの後も4個のまま維持されている(ロールバック確認)', async () => {
    const response = await alice.client.get(wakuwakuPath())

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(4)
    expect(response.body.data.map((s: any) => s.wakuwakuMaster.displayOrder)).toEqual(
      masters.wakuwaku.slice(0, 4).map((w) => w.displayOrder)
    )
  })

  it('DELETE スロット2 は204で残りが1..Nへ詰め直される', async () => {
    const response = await alice.client.delete(`${wakuwakuPath()}/2`)

    expect(response.status).toBe(204)

    const after = await alice.client.get(wakuwakuPath())

    expect(after.body.data.map((s: any) => s.slotNumber)).toEqual([1, 2, 3])
    // 削除されたのは displayOrder=1 のわくわく。残りは displayOrder 昇順のまま
    expect(after.body.data.map((s: any) => s.wakuwakuMaster.displayOrder)).toEqual([
      masters.wakuwaku[0].displayOrder,
      masters.wakuwaku[2].displayOrder,
      masters.wakuwaku[3].displayOrder,
    ])
  })

  it('DELETE 範囲外スロット (5) は422', async () => {
    expect((await alice.client.delete(`${wakuwakuPath()}/5`)).status).toBe(422)
  })

  it('DELETE 範囲外スロット (0) は422', async () => {
    expect((await alice.client.delete(`${wakuwakuPath()}/0`)).status).toBe(422)
  })

  it('DELETE 非数値スロット は422', async () => {
    expect((await alice.client.delete(`${wakuwakuPath()}/abc`)).status).toBe(422)
  })

  it('DELETE 空きスロット (4) は404', async () => {
    expect((await alice.client.delete(`${wakuwakuPath()}/4`)).status).toBe(404)
  })

  it('PUT 空配列 (全解除) は200', async () => {
    const response = await alice.client.put(wakuwakuPath(), { json: { slots: [] } })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(0)
  })
})

describe('9. 所持キャラ削除 (カスケード)', () => {
  let ownedCharacterId: string

  beforeAll(async () => {
    const response = await alice.client.post(`/accounts/${alice.accounts[2].id}/characters`, {
      json: { characterMasterId: masters.characters[0].id },
    })

    ownedCharacterId = response.body.id
  })

  it('PUT わくわく2個 は200', async () => {
    const response = await alice.client.put(`/owned-characters/${ownedCharacterId}/wakuwaku`, {
      json: [masters.wakuwaku[0], masters.wakuwaku[1]].reduce(
        (acc, w) => ({ slots: [...acc.slots, { wakuwakuMasterId: w.id, level: 'L' }] }),
        { slots: [] as { wakuwakuMasterId: string; level: string }[] }
      ),
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
  })

  it('DELETE /owned-characters/{id} は204', async () => {
    expect((await alice.client.delete(`/owned-characters/${ownedCharacterId}`)).status).toBe(204)
  })

  it('GET 削除後 は404', async () => {
    expect((await alice.client.get(`/owned-characters/${ownedCharacterId}`)).status).toBe(404)
  })

  it('わくわくスロットもカスケード削除されている', async () => {
    const remaining = await testPrisma().ownedCharacterWakuwaku.count({
      where: { ownedCharacterId },
    })

    expect(remaining).toBe(0)
  })
})
