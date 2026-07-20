import { loadTestEnv, assertLocalTestDatabase } from './helpers/env'

// 各テストワーカープロセスで実行される。globalSetup とは別プロセスのため、
// ここでも .env.test の読み込みと接続先のガードを行う。
loadTestEnv()
assertLocalTestDatabase()
