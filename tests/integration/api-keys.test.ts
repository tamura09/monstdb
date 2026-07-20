import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { anonymousClient, createApiClient, type ApiClient } from './helpers/client'
import {
  createTestUser,
  loadMasterFixtures,
  uniqueIndexNumber,
  type MasterFixtures,
} from './helpers/fixtures'
import { testPrisma, disconnectTestPrisma } from './helpers/db'

// scratchpad/keytest.sh (25項目) の移植。APIキーの権限昇格・漏洩シナリオ検証。
//
// 移植元は固定の indexNumber (98801等) を使っていたため2回目の実行で409になった。
// ここでは uniqueIndexNumber() で毎回別の値を採番し、何度実行しても通るようにしている。

let adminUser: Awaited<ReturnType<typeof createTestUser>>
let normalUser: Awaited<ReturnType<typeof createTestUser>>
let otherUser: Awaited<ReturnType<typeof createTestUser>>
let anon: ApiClient
let masters: MasterFixtures

// 全権キー(4スコープ全部)
let fullKey: string
let fullClient: ApiClient
// 読取専用キー
let readOnlyClient: ApiClient
// 失効テスト用
let revocableKey: string
let revocableKeyId: string
// 期限切れキー
let expiredKey: string

// 他人(otherUser)のリソース。全権キーでもアクセスできてはいけない。
let otherAccountId: string
let otherOwnedCharacterId: string

async function issueKey(name: string, scopes: string[], expiresAt?: string) {
  const response = await adminUser.client.post('/api-keys', {
    json: { name, scopes, ...(expiresAt ? { expiresAt } : {}) },
  })

  expect(response.status, `キー発行に失敗: ${JSON.stringify(response.body)}`).toBe(201)

  return { key: response.body.key as string, id: response.body.apiKey.id as string }
}

beforeAll(async () => {
  anon = anonymousClient()
  masters = await loadMasterFixtures()

  adminUser = await createTestUser('admin')
  normalUser = await createTestUser('user')
  otherUser = await createTestUser('user')

  otherAccountId = otherUser.accounts[0].id

  const otherOwned = await testPrisma().ownedCharacter.create({
    data: { gameAccountId: otherAccountId, characterMasterId: masters.characters[0].id },
  })
  otherOwnedCharacterId = otherOwned.id

  const full = await issueKey('全権キー', [
    'characters:read',
    'characters:write',
    'accounts:read',
    'accounts:write',
  ])
  fullKey = full.key
  fullClient = createApiClient({ bearer: fullKey })

  const readOnly = await issueKey('読取専用', ['characters:read', 'accounts:read'])
  readOnlyClient = createApiClient({ bearer: readOnly.key })

  const revocable = await issueKey('失効テスト', ['characters:read'])
  revocableKey = revocable.key
  revocableKeyId = revocable.id

  const expired = await issueKey('期限切れ', ['characters:read'], '2020-01-01T00:00:00.000Z')
  expiredKey = expired.key
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe('平文キーが再取得できないこと', () => {
  it('一覧レスポンスに keyHash も平文キーも含まれない', async () => {
    const response = await adminUser.client.get('/api-keys')

    expect(response.status).toBe(200)

    const serialized = JSON.stringify(response.body)

    // 平文キーの断片(secret部分)が一切現れないこと
    expect(serialized).not.toContain(fullKey)
    expect(serialized).not.toContain(fullKey.slice(20, 50))
    expect(serialized).not.toContain('keyHash')

    // 返ってよいフィールドのみであること
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'keyPrefix',
      'lastUsedAt',
      'name',
      'revokedAt',
      'scopes',
    ])
  })

  it('keyPrefix は平文キーの先頭12文字のみ(secretは含まない)', async () => {
    const response = await adminUser.client.get('/api-keys')
    const prefixes: string[] = response.body.data.map((k: any) => k.keyPrefix)

    for (const prefix of prefixes) {
      expect(prefix).toHaveLength(12)
      expect(fullKey.length).toBeGreaterThan(prefix.length)
    }

    expect(prefixes).toContain(fullKey.slice(0, 12))
  })

  it('DBに平文キーが保存されていない', async () => {
    const keys = await testPrisma().apiKey.findMany({ where: { userId: adminUser.id } })

    expect(keys.length).toBeGreaterThan(0)

    for (const key of keys) {
      // SHA-256 hex (64文字) であること
      expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/)
      expect(key.keyHash).not.toContain(fullKey)
    }

    // 平文キーの断片を含む行が存在しないこと
    const leaked = keys.filter((key) => key.keyHash.includes(fullKey.slice(20, 40)))
    expect(leaked).toHaveLength(0)
  })
})

describe('キーでの正常アクセス', () => {
  it('GET /characters (全権キー) は200', async () => {
    expect((await fullClient.get('/characters')).status).toBe(200)
  })

  it('GET /characters (読取専用キー) は200', async () => {
    expect((await readOnlyClient.get('/characters')).status).toBe(200)
  })

  it('GET /accounts (全権キー) は200', async () => {
    expect((await fullClient.get('/accounts')).status).toBe(200)
  })

  it('POST /characters (全権キー) は201', async () => {
    const response = await fullClient.post('/characters', {
      json: {
        indexNumber: uniqueIndexNumber(),
        monsterName: 'キーテスト',
        element: '火',
        type: '恒常',
      },
    })

    expect(response.status).toBe(201)
  })
})

describe('スコープ外の拒否 (最重要)', () => {
  it('POST /characters (読取専用キー) は403', async () => {
    const response = await readOnlyClient.post('/characters', {
      json: {
        indexNumber: uniqueIndexNumber(),
        monsterName: 'X',
        element: '火',
        type: '恒常',
      },
    })

    expect(response.status).toBe(403)
  })

  it('DELETE /characters/{id} (読取専用キー) は403', async () => {
    const response = await readOnlyClient.delete(`/characters/${masters.characters[0].id}`)

    expect(response.status).toBe(403)
  })

  it('POST 所持キャラ (読取専用キー) は403', async () => {
    // 読取専用キーの持ち主(admin本人)の自アカウントに対しても、
    // accounts:write スコープが無ければ書き込めない。
    const response = await readOnlyClient.post(
      `/accounts/${adminUser.accounts[0].id}/characters`,
      { json: { characterMasterId: masters.characters[0].id } }
    )

    expect(response.status).toBe(403)
  })
})

describe('権限昇格の防止 (最重要)', () => {
  // APIキー管理APIは常にセッション認証を要求する。
  // APIキーで新しいキーを発行できると権限昇格の踏み台になるため。
  it('POST /api-keys (全権キーで発行) は401', async () => {
    const response = await fullClient.post('/api-keys', {
      json: { name: '昇格', scopes: ['characters:write'] },
    })

    expect(response.status).toBe(401)
  })

  it('GET /api-keys (全権キーで一覧) は401', async () => {
    expect((await fullClient.get('/api-keys')).status).toBe(401)
  })

  it('DELETE /api-keys/{id} (全権キー) は401', async () => {
    expect((await fullClient.delete(`/api-keys/${revocableKeyId}`)).status).toBe(401)
  })
})

describe('所有権はキー認証でも維持される (最重要)', () => {
  it('GET 他人のアカウント (全権キー) は404', async () => {
    expect((await fullClient.get(`/accounts/${otherAccountId}/characters`)).status).toBe(404)
  })

  it('GET 他人の所持キャラ (全権キー) は404', async () => {
    expect((await fullClient.get(`/owned-characters/${otherOwnedCharacterId}`)).status).toBe(404)
  })

  it('DELETE 他人の所持キャラ (全権キー) は404', async () => {
    expect((await fullClient.delete(`/owned-characters/${otherOwnedCharacterId}`)).status).toBe(404)
  })

  it('PUT 他人のわくわく (全権キー) は404', async () => {
    const response = await fullClient.put(
      `/owned-characters/${otherOwnedCharacterId}/wakuwaku`,
      { json: { slots: [] } }
    )

    expect(response.status).toBe(404)
  })
})

describe('無効なキーの拒否', () => {
  // 失効前 → 失効 → 失効後 の順に依存するため、この describe 内は順序に意味がある。
  it('失効前のキーは200', async () => {
    const response = await createApiClient({ bearer: revocableKey }).get('/characters')

    expect(response.status).toBe(200)
  })

  it('失効後のキーは401', async () => {
    const revoke = await adminUser.client.delete(`/api-keys/${revocableKeyId}`)
    expect(revoke.status).toBe(204)

    const response = await createApiClient({ bearer: revocableKey }).get('/characters')

    expect(response.status).toBe(401)
  })

  it('期限切れキーは401', async () => {
    const response = await createApiClient({ bearer: expiredKey }).get('/characters')

    expect(response.status).toBe(401)
  })

  it('存在しないキーは401', async () => {
    const response = await createApiClient({
      bearer: 'mdb_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }).get('/characters')

    expect(response.status).toBe(401)
  })

  it('デタラメな文字列は401', async () => {
    expect((await createApiClient({ bearer: 'garbage' }).get('/characters')).status).toBe(401)
  })

  it('空のBearerは401', async () => {
    expect((await createApiClient({ bearer: '' }).get('/characters')).status).toBe(401)
  })

  it('1文字のキーは401', async () => {
    expect((await createApiClient({ bearer: 'x' }).get('/characters')).status).toBe(401)
  })

  it('正しいprefix + 誤ったsecret は401', async () => {
    // keyPrefix でレコードは引けるが、ハッシュ比較で弾かれることを確認する。
    const response = await createApiClient({
      bearer: `${fullKey.slice(0, 12)}WRONGSECRETWRONGSECRETWRONGSECRET`,
    }).get('/characters')

    expect(response.status).toBe(401)
  })
})

describe('非adminはキーを扱えない', () => {
  it('POST /api-keys (一般ユーザーのセッション) は403', async () => {
    const response = await normalUser.client.post('/api-keys', {
      json: { name: 'x', scopes: ['characters:read'] },
    })

    expect(response.status).toBe(403)
  })

  it('GET /api-keys (一般ユーザーのセッション) は403', async () => {
    expect((await normalUser.client.get('/api-keys')).status).toBe(403)
  })

  it('POST /api-keys (未認証) は401', async () => {
    const response = await anon.post('/api-keys', {
      json: { name: 'x', scopes: ['characters:read'] },
    })

    expect(response.status).toBe(401)
  })
})
