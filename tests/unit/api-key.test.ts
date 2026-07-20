import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKeyPlaintext } from '@/lib/api/api-key'

// lib/api/api-key.ts のうちDBに依存しない部分(生成・ハッシュ化)のテスト。
// verifyApiKey は prisma を参照するため統合テスト(tests/integration/api-keys.test.ts)側で検証する。

// 平文キーの先頭何文字を keyPrefix として保存するか(api-key.ts の KEY_PREFIX_LENGTH と一致させる)
const KEY_PREFIX_LENGTH = 12

describe('generateApiKey', () => {
  it('キー形式が mdb_{live|test}_{base64url} である', () => {
    const { plaintextKey } = generateApiKey()

    expect(plaintextKey).toMatch(/^mdb_(live|test)_[A-Za-z0-9_-]+$/)
  })

  it('環境識別子はテスト実行時(非production)には test になる', () => {
    const { plaintextKey } = generateApiKey()

    expect(plaintextKey.startsWith('mdb_test_')).toBe(true)
  })

  it('ランダム部は crypto.randomBytes(32) 相当の長さを持つ', () => {
    const { plaintextKey } = generateApiKey()
    const randomPart = plaintextKey.replace(/^mdb_(live|test)_/, '')

    // 32バイトを base64url エンコードすると43文字(パディングなし)
    expect(randomPart).toHaveLength(43)
  })

  it('keyPrefix が平文キーの先頭12文字と一致する(prefixの一貫性)', () => {
    for (let i = 0; i < 20; i++) {
      const { plaintextKey, keyPrefix } = generateApiKey()

      expect(keyPrefix).toBe(plaintextKey.slice(0, KEY_PREFIX_LENGTH))
      expect(keyPrefix).toHaveLength(KEY_PREFIX_LENGTH)
    }
  })

  it('keyHash が返却する平文キーのSHA-256と一致する', () => {
    const { plaintextKey, keyHash } = generateApiKey()

    expect(keyHash).toBe(hashApiKeyPlaintext(plaintextKey))
  })

  it('毎回異なるキーを生成する(推測不能性)', () => {
    const keys = new Set<string>()
    const hashes = new Set<string>()

    for (let i = 0; i < 200; i++) {
      const { plaintextKey, keyHash } = generateApiKey()
      keys.add(plaintextKey)
      hashes.add(keyHash)
    }

    expect(keys.size).toBe(200)
    expect(hashes.size).toBe(200)
  })
})

describe('hashApiKeyPlaintext', () => {
  it('ハッシュが平文と異なる', () => {
    const { plaintextKey, keyHash } = generateApiKey()

    expect(keyHash).not.toBe(plaintextKey)
  })

  it('ハッシュに平文キーが含まれない(DB保存値から平文を復元できない)', () => {
    const { plaintextKey, keyHash } = generateApiKey()
    const secretPart = plaintextKey.slice(KEY_PREFIX_LENGTH)

    expect(keyHash).not.toContain(plaintextKey)
    expect(keyHash).not.toContain(secretPart)
  })

  it('同じ平文は必ず同じハッシュになる(決定的)', () => {
    const plaintext = 'mdb_test_fixed-plaintext-for-determinism'

    expect(hashApiKeyPlaintext(plaintext)).toBe(hashApiKeyPlaintext(plaintext))
  })

  it('SHA-256 の hex 文字列(64文字)を返す', () => {
    expect(hashApiKeyPlaintext('mdb_test_whatever')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('1文字違うだけでハッシュが変わる', () => {
    expect(hashApiKeyPlaintext('mdb_test_aaa')).not.toBe(hashApiKeyPlaintext('mdb_test_aab'))
  })

  it('既知のベクタと一致する(ハッシュアルゴリズムの回帰防止)', () => {
    // echo -n "monstdb" | shasum -a 256
    expect(hashApiKeyPlaintext('monstdb')).toBe(
      'fa1a037ad095a89a9451ffdb26c145ff1d336a18a236cc4f07371dae1b601c5f'
    )
  })
})
