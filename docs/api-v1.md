# REST API リファレンス (`/api/v1`)

モンストDBが提供する `/api/v1/...` のREST APIリファレンスです。

このAPIは既存の `/api/register` `/api/import/*` `/api/export/*` `/api/admin/characters` とは独立した新設のAPI群で、キャラクターマスター・所持キャラクター・わくわくの実の装着状態をJSONベースのRESTインターフェースで操作できます。既存APIは後方互換のためそのまま残っています(詳細はリポジトリルートの[README.md](../README.md#api)を参照してください)。

OpenAPI 3.1形式の機械可読な仕様は [openapi.yaml](./openapi.yaml) を参照してください。

## 目次

- [認証](#認証)
- [共通エラーレスポンス](#共通エラーレスポンス)
- [ページング](#ページング)
- [エンドポイント一覧](#エンドポイント一覧)
- [わくわくの実について](#わくわくの実について)
- [エンドポイント詳細](#エンドポイント詳細)
- [curl実行例](#curl実行例)

## 認証

このAPIは **NextAuth.js のセッションクッキー** と **スコープ付きAPIキー(`Authorization: Bearer`)** の2方式で認証します。

### セッションCookie(ブラウザからの利用)

- ログインは Google OAuth (`/api/auth/[...nextauth]`) 経由で行います。ログインに成功すると `next-auth.session-token`(本番環境ではSecure属性付きの `__Secure-next-auth.session-token`)というCookieがブラウザに保存されます。
- `/api/v1/...` の各エンドポイントは、リクエストにこのセッションCookieが付与されていることを前提としています。つまり **ブラウザから同一オリジンでリクエストする(または対応するCookieを明示的に付与する)ことが前提** で、サーバー間連携など別オリジンからの直接呼び出しは想定していません。
- セッションCookieが無い、または無効な場合は `401 unauthorized` を返します。
- エンドポイントによっては、セッションに加えてDB上の `User.role` が `admin` であることを要求します(下記「エンドポイント一覧」の「必要権限」列を参照)。admin判定は都度DBを参照して行われるため、権限が剥奪された場合は次のリクエストから即座に反映されます。

### APIキー(サーバー間連携)

- リクエストに `Authorization: Bearer <key>` ヘッダを付与すると、セッションCookieの代わりにAPIキーで認証できます。同一オリジン制約が無く、サーバー間連携など別オリジンからの直接呼び出しにはこちらを使います。
- **APIキーを発行できるのは admin ロールのユーザーのみ**です(発行方法は[APIキー管理](#apiキー管理)を参照)。
- キーは**発行者のユーザーとして振る舞います**が、発行時に指定した**スコープで許可された操作しかできません**(最小権限の原則)。キー保有者本人のゲームアカウント・所持キャラのみアクセスできる点はセッション認証と同じです(所有権チェックはスコープに関わらず常に有効です)。
- スコープの一覧は以下の通りです。

  | スコープ | 説明 |
  | --- | --- |
  | `characters:read` | キャラクターマスターの参照(`GET /api/v1/characters`, `/characters/{id}`, `/wakuwaku-masters`) |
  | `characters:write` | キャラクターマスターの作成・更新・削除(admin相当の操作。`POST`/`PATCH`/`DELETE /api/v1/characters*`) |
  | `accounts:read` | 自分のゲームアカウント・所持キャラ・わくわくの実の参照 |
  | `accounts:write` | 所持キャラの登録・削除、わくわくの実のセット・解除 |

- `characters:write` は admin相当の操作を許可するスコープです。**admin本人が発行したキーであっても、`characters:write` スコープが無ければマスターデータの書き換えはできません**(read専用キーの流出だけではマスターデータを書き換えられない設計)。
- キーに無いスコープの操作を行おうとした場合は `403 forbidden` を返します。
- キーが失効済み(`revokedAt` 設定済み)、または有効期限(`expiresAt`)切れの場合は `401 unauthorized` を返します。
- **APIキーを使って新しいAPIキーを発行することはできません**(権限昇格の踏み台になるため)。[APIキー管理](#apiキー管理)の全エンドポイントはセッション認証限定です。

## 共通エラーレスポンス

エラー時は常に以下の形式のJSONを返します。

```json
{
  "error": {
    "code": "validation_error",
    "message": "リクエストの内容が不正です",
    "details": null
  }
}
```

- `code`: エラー種別を表す文字列(下表参照)
- `message`: 人間向けの日本語メッセージ
- `details`: 追加情報(省略される場合があります)。バリデーションエラーの場合はZodの `issues` 配列が入ります

### エラーコード一覧

| code | HTTPステータス | 意味 |
| --- | --- | --- |
| `unauthorized` | 401 | ログインしていない、またはセッションが無効 |
| `forbidden` | 403 | ログインはしているが、その操作に必要な権限(admin)がない |
| `not_found` | 404 | 指定されたリソースが存在しない、または自分の所有物ではない |
| `validation_error` | 422 | リクエストボディ・クエリパラメータ・パスパラメータの形式や内容が不正 |
| `conflict` | 409 | 一意制約に違反する(例: `indexNumber`の重複) |
| `internal_error` | 500 | サーバー内部エラー。詳細はレスポンスに含まれずサーバーログにのみ出力される |

補足:

- 所有権チェック(`GameAccount`・`OwnedCharacter`が自分のものか)に失敗した場合、「存在しない」場合と「他人のものである」場合を区別せず一律 `not_found` を返します。これはIDの存在有無を第三者に推測されないようにするための意図的な設計です。
- リクエストボディがJSONとしてパースできない場合も `validation_error` (422) になります。
- Prismaの一意制約違反(`P2002`)は `conflict` (409) に、対象レコードが見つからない旨のPrismaエラー(`P2025`)は `not_found` (404) に自動変換されます。

## ページング

一覧取得系のエンドポイント(`GET /api/v1/characters`、`GET /api/v1/accounts/{accountId}/characters`)は、クエリパラメータ `page` / `perPage` によるページングに対応しています。

| パラメータ | 型 | 既定値 | 上限・下限 |
| --- | --- | --- | --- |
| `page` | 整数 | `1` | `1`以上 |
| `perPage` | 整数 | `50` | `1`以上 `100`以下 |

範囲外の値やパース不能な値を指定した場合は `422 validation_error` になります。

レスポンスには以下の `pagination` オブジェクトが含まれます。

```json
{
  "page": 1,
  "perPage": 50,
  "total": 123,
  "totalPages": 3
}
```

`total` はフィルタ(後述の `element` / `type` / `search`)適用後の全件数、`totalPages` は `Math.ceil(total / perPage)` です。

## エンドポイント一覧

| メソッド | パス | 必要権限 | 説明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/characters` | ログイン済み | キャラクターマスター一覧取得(ページング・絞り込み対応) |
| `POST` | `/api/v1/characters` | admin | キャラクターマスター新規作成 |
| `GET` | `/api/v1/characters/{id}` | ログイン済み | キャラクターマスター単体取得 |
| `PATCH` | `/api/v1/characters/{id}` | admin | キャラクターマスター部分更新 |
| `DELETE` | `/api/v1/characters/{id}` | admin | キャラクターマスター削除 |
| `GET` | `/api/v1/accounts` | ログイン済み(自分の分のみ) | 自分のゲームアカウント一覧取得 |
| `GET` | `/api/v1/accounts/{accountId}/characters` | 本人(アカウント所有者) | 指定アカウントの所持キャラ一覧取得(ページング・絞り込み対応) |
| `POST` | `/api/v1/accounts/{accountId}/characters` | 本人(アカウント所有者) | 所持キャラ登録 |
| `GET` | `/api/v1/owned-characters/{id}` | 本人(所持キャラ所有者) | 所持キャラ単体取得 |
| `DELETE` | `/api/v1/owned-characters/{id}` | 本人(所持キャラ所有者) | 所持キャラ削除 |
| `GET` | `/api/v1/owned-characters/{id}/wakuwaku` | 本人(所持キャラ所有者) | わくわくの実セット取得 |
| `PUT` | `/api/v1/owned-characters/{id}/wakuwaku` | 本人(所持キャラ所有者) | わくわくの実セット一括置換(冪等) |
| `DELETE` | `/api/v1/owned-characters/{id}/wakuwaku/{slotNumber}` | 本人(所持キャラ所有者) | わくわくの実スロット1個解除 |
| `GET` | `/api/v1/wakuwaku-masters` | ログイン済み | わくわくの実マスター一覧取得 |
| `GET` | `/api/v1/api-keys` | admin(セッション限定) | 自分が発行したAPIキー一覧取得 |
| `POST` | `/api/v1/api-keys` | admin(セッション限定) | APIキー発行 |
| `DELETE` | `/api/v1/api-keys/{id}` | admin(セッション限定) | APIキー失効 |

「本人」列のエンドポイントは、対象リソースが自分に紐づかない場合(存在しない・他人のものである)一律 `404 not_found` になります。

「必要権限」欄が「◯◯(セッション限定)」のエンドポイントは、[前述の通り](#apiキー)Authorization: Bearerでの呼び出しを受け付けず、常にセッションCookieでの認証を要求します。

## わくわくの実について

- 1体のキャラクターに装着できるわくわくの実は **最大4個**(`slotNumber` は1〜4)です。
- `PUT /api/v1/owned-characters/{id}/wakuwaku` は、渡した配列でスロットを**完全に置き換える冪等な一括置換API**です。何度呼んでも同じ `slots` を渡せば結果は同じになります。
- **空配列 `{ "slots": [] }` を渡すと、装着中のわくわくの実を全て解除した状態になります。**
- 同じわくわくの実を複数スロットに重複指定することはできません(`422 validation_error`)。
- 存在しない `wakuwakuMasterId` を指定した場合も `422 validation_error` になります。
- レスポンスの `slotNumber` は、常にわくわくの実マスターの `displayOrder` 順で1から詰め直されます。個別解除(`DELETE .../wakuwaku/{slotNumber}`)を行った場合も同様に、残ったスロットが自動的に1..Nへ振り直されます。

## エンドポイント詳細

### `GET /api/v1/characters`

キャラクターマスター一覧を取得します。ログイン済みユーザーなら誰でも呼び出せます。

**クエリパラメータ**

| 名前 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `page` | 整数 | 任意 | [ページング](#ページング)参照 |
| `perPage` | 整数 | 任意 | [ページング](#ページング)参照 |
| `element` | `火` \| `水` \| `木` \| `光` \| `闇` | 任意 | 属性で絞り込み |
| `type` | `限定` \| `恒常` | 任意 | キャラ種別で絞り込み |
| `search` | 文字列 | 任意 | モンスター名のあいまい検索(ひらがな・カタカナを区別しない) |

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl0abc123def456ghi789jkl",
      "indexNumber": 1,
      "monsterName": "サンプルモンスター",
      "element": "火",
      "type": "限定",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "perPage": 50, "total": 1, "totalPages": 1 }
}
```

**起こりうるエラー**: `401 unauthorized`、`422 validation_error`(クエリパラメータ不正)

---

### `POST /api/v1/characters`

キャラクターマスターを新規作成します。**admin限定。**

**リクエストボディ**

```json
{
  "indexNumber": 9999,
  "monsterName": "新キャラ名",
  "element": "火",
  "type": "限定"
}
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `indexNumber` | 正の整数 | 必須 | 図鑑番号に相当する一意な番号 |
| `monsterName` | 文字列(1文字以上) | 必須 | モンスター名 |
| `element` | `火` \| `水` \| `木` \| `光` \| `闇` | 必須 | 属性 |
| `type` | `限定` \| `恒常` | 必須 | キャラ種別 |

**成功レスポンス例** (`201`、`Location: /api/v1/characters/{id}` ヘッダ付き)

```json
{
  "id": "cl0abc123def456ghi789jkl",
  "indexNumber": 9999,
  "element": "火",
  "type": "限定",
  "monsterName": "新キャラ名",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`(admin以外)、`422 validation_error`、`409 conflict`(`indexNumber`重複)

---

### `GET /api/v1/characters/{id}`

キャラクターマスターを1件取得します。ログイン済みユーザーなら誰でも呼び出せます。

**成功レスポンス例** (`200`): `POST`と同じ形式のオブジェクト単体

**起こりうるエラー**: `401 unauthorized`、`404 not_found`

---

### `PATCH /api/v1/characters/{id}`

キャラクターマスターを部分更新します。**admin限定。**

**リクエストボディ**: `POST`と同じフィールドの部分集合(すべて任意)。空オブジェクト `{}` を渡した場合は何も更新せず、現在のリソースをそのまま `200` で返します。

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`、`404 not_found`、`422 validation_error`、`409 conflict`(`indexNumber`を他レコードと重複する値に変更しようとした場合)

---

### `DELETE /api/v1/characters/{id}`

キャラクターマスターを削除します。**admin限定。** 紐づく`OwnedCharacter`は`onDelete: Cascade`によりまとめて削除されます。

**成功レスポンス**: `204 No Content`(ボディなし)

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`、`404 not_found`(Prismaの`P2025`経由)

---

### `GET /api/v1/accounts`

自分のゲームアカウント一覧を取得します。`userId`で必ず絞り込まれるため、他人のアカウントが返ることはありません。ゲームアカウント自体の作成・削除はこのAPIでは行いません(ログイン時に自動作成されます)。

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl1acc111def456ghi789jkl",
      "accountNumber": 1,
      "name": "メインアカウント",
      "ownedCharacterCount": 42
    }
  ]
}
```

**起こりうるエラー**: `401 unauthorized`

---

### `GET /api/v1/accounts/{accountId}/characters`

指定したゲームアカウントの所持キャラ一覧を取得します。`accountId`が自分のゲームアカウントでない場合は`404`になります。

**パスパラメータ**: `accountId` — ゲームアカウントのID

**クエリパラメータ**: `GET /api/v1/characters`と同じ(`page` / `perPage` / `element` / `type` / `search`)

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl2own222def456ghi789jkl",
      "gameAccountId": "cl1acc111def456ghi789jkl",
      "characterMasterId": "cl0abc123def456ghi789jkl",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "characterMaster": {
        "id": "cl0abc123def456ghi789jkl",
        "indexNumber": 1,
        "monsterName": "サンプルモンスター",
        "element": "火",
        "type": "限定"
      },
      "wakuwakuSlots": [
        {
          "id": "cl3wak333def456ghi789jkl",
          "slotNumber": 1,
          "level": "L",
          "wakuwakuMaster": { "id": "cl4wm444def456ghi789jkl", "name": "パワー" }
        }
      ]
    }
  ],
  "pagination": { "page": 1, "perPage": 50, "total": 1, "totalPages": 1 }
}
```

**起こりうるエラー**: `401 unauthorized`、`404 not_found`(`accountId`が自分のものでない)、`422 validation_error`

---

### `POST /api/v1/accounts/{accountId}/characters`

所持キャラを登録します。**同じキャラを複数所持することはユニーク制約違反にならないため、呼び出すたびに常に新規レコードが作成される非冪等な操作です。**

**パスパラメータ**: `accountId` — ゲームアカウントのID

**リクエストボディ**

```json
{ "characterMasterId": "cl0abc123def456ghi789jkl" }
```

**成功レスポンス**: `201`(`Location: /api/v1/owned-characters/{id}` ヘッダ付き)。ボディは`GET /api/v1/accounts/{accountId}/characters`の`data`要素1件と同じ形式

**起こりうるエラー**: `401 unauthorized`、`404 not_found`(`accountId`が自分のものでない)、`422 validation_error`(`characterMasterId`が存在しない、または未指定)

---

### `GET /api/v1/owned-characters/{id}`

所持キャラを1件取得します。自分のゲームアカウントに紐づく所持キャラのみ取得できます。

**成功レスポンス例** (`200`): `POST /api/v1/accounts/{accountId}/characters`のレスポンスと同じ形式のオブジェクト単体

**起こりうるエラー**: `401 unauthorized`、`404 not_found`

---

### `DELETE /api/v1/owned-characters/{id}`

所持キャラを削除します。装着中のわくわくの実(`OwnedCharacterWakuwaku`)は`onDelete: Cascade`によりまとめて削除されます。

**成功レスポンス**: `204 No Content`

**起こりうるエラー**: `401 unauthorized`、`404 not_found`

---

### `GET /api/v1/owned-characters/{id}/wakuwaku`

指定した所持キャラのわくわくの実セットを取得します。

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl3wak333def456ghi789jkl",
      "slotNumber": 1,
      "level": "L",
      "wakuwakuMaster": { "id": "cl4wm444def456ghi789jkl", "name": "パワー", "displayOrder": 1 }
    }
  ],
  "maxSlots": 4
}
```

**起こりうるエラー**: `401 unauthorized`、`404 not_found`

---

### `PUT /api/v1/owned-characters/{id}/wakuwaku`

わくわくの実セットを一括置換します。[「わくわくの実について」](#わくわくの実について)を参照してください。

**リクエストボディ**

```json
{
  "slots": [
    { "wakuwakuMasterId": "cl4wm444def456ghi789jkl", "level": "L" },
    { "wakuwakuMasterId": "cl5wm555def456ghi789jkl" }
  ]
}
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `slots` | 配列(最大4件) | 必須(空配列可) | 装着するわくわくの実のリスト |
| `slots[].wakuwakuMasterId` | 文字列 | 必須 | わくわくの実マスターのID |
| `slots[].level` | `L` \| `EL` | 任意(既定値`L`) | レベル |

全解除する場合は `{ "slots": [] }` を送信します。

**成功レスポンス**: `200`。`GET .../wakuwaku`と同じ形式(置換後の状態)

**起こりうるエラー**:

- `401 unauthorized`
- `404 not_found`(`id`が自分の所持キャラでない)
- `422 validation_error`(`slots`が5件以上、同じ`wakuwakuMasterId`の重複指定、存在しない`wakuwakuMasterId`の指定、`level`が`L`/`EL`以外)

---

### `DELETE /api/v1/owned-characters/{id}/wakuwaku/{slotNumber}`

指定したスロット番号のわくわくの実を1個解除します。解除後、残りのスロットは自動的に1..Nへ詰め直されます。

**パスパラメータ**

| 名前 | 型 | 説明 |
| --- | --- | --- |
| `id` | 文字列 | 所持キャラのID |
| `slotNumber` | 1〜4の整数 | 解除するスロット番号 |

**成功レスポンス**: `204 No Content`

**起こりうるエラー**: `401 unauthorized`、`404 not_found`(所持キャラが自分のものでない、または指定スロットが空)、`422 validation_error`(`slotNumber`が1〜4の範囲外・非数値)

---

### `GET /api/v1/wakuwaku-masters`

わくわくの実マスターの一覧を取得します。`PUT .../wakuwaku`に渡す`wakuwakuMasterId`を引くためのエンドポイントで、ページングはありません。ログイン済みユーザーなら誰でも呼び出せます。

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl4wm444def456ghi789jkl",
      "name": "パワー",
      "description": "攻撃力が上昇する",
      "displayOrder": 1
    }
  ]
}
```

**起こりうるエラー**: `401 unauthorized`

---

### `GET /api/v1/api-keys`

自分(admin)が発行したAPIキーの一覧を取得します。**admin限定・セッション認証限定。**

`keyHash`(ハッシュ値)は一切レスポンスに含まれません。平文キーは発行時(`POST`)のレスポンスでのみ一度返され、以降は二度と取得できません。

**成功レスポンス例** (`200`)

```json
{
  "data": [
    {
      "id": "cl5key555def456ghi789jkl",
      "name": "集計バッチ",
      "keyPrefix": "mdb_live_abc",
      "scopes": ["characters:read", "accounts:read"],
      "lastUsedAt": "2024-01-02T00:00:00.000Z",
      "expiresAt": null,
      "revokedAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`(admin以外、またはAPIキーでの呼び出し)

---

### `POST /api/v1/api-keys`

APIキーを発行します。**admin限定・セッション認証限定。**

**リクエストボディ**

```json
{
  "name": "集計バッチ",
  "scopes": ["characters:read", "accounts:read"],
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `name` | 文字列(1文字以上) | 必須 | 用途がわかる表示名 |
| `scopes` | 配列(1件以上) | 必須 | [スコープ](#apiキー)の一覧 |
| `expiresAt` | ISO日時文字列 | 任意 | 有効期限。省略時は無期限 |

**成功レスポンス例** (`201`)。**平文キー(`key`)はこのレスポンスにのみ含まれます。**忘れずに控えてください。以降はAPIから再取得できません。

```json
{
  "key": "mdb_live_QW5kZWxpbmVfMzJfYnl0ZV9yYW5kb20",
  "apiKey": {
    "id": "cl5key555def456ghi789jkl",
    "name": "集計バッチ",
    "keyPrefix": "mdb_live_QW5",
    "scopes": ["characters:read", "accounts:read"],
    "lastUsedAt": null,
    "expiresAt": "2025-01-01T00:00:00.000Z",
    "revokedAt": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`(admin以外、またはAPIキーでの呼び出し)、`422 validation_error`(`scopes`が空・不正な値を含む等)

---

### `DELETE /api/v1/api-keys/{id}`

APIキーを失効させます。**admin限定・セッション認証限定。** 物理削除はせず `revokedAt` を立てるのみです(発行履歴は残ります)。失効後のキーで認証しようとすると `401 unauthorized` になります。

自分が発行したキー以外を指定した場合は「存在しない」場合と区別せず一律 `404 not_found` を返します。

**成功レスポンス**: `204 No Content`

**起こりうるエラー**: `401 unauthorized`、`403 forbidden`(admin以外、またはAPIキーでの呼び出し)、`404 not_found`(存在しない、または他人が発行したキー)

## curl実行例

セッションCookieはブラウザでログイン後にDevToolsなどから取得し、`cookies.txt`(Netscape形式)として保存するか、`-b`オプションで直接渡してください。

**キャラクターマスター一覧を検索・絞り込み付きで取得**

```bash
curl -b cookies.txt \
  "http://localhost:3000/api/v1/characters?element=火&type=限定&search=サンプル&page=1&perPage=20"
```

**自分のゲームアカウント一覧を取得**

```bash
curl -b cookies.txt "http://localhost:3000/api/v1/accounts"
```

**所持キャラを登録**

```bash
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"characterMasterId":"cl0abc123def456ghi789jkl"}' \
  "http://localhost:3000/api/v1/accounts/cl1acc111def456ghi789jkl/characters"
```

**わくわくの実を2個セット**

```bash
curl -b cookies.txt -X PUT \
  -H "Content-Type: application/json" \
  -d '{"slots":[{"wakuwakuMasterId":"cl4wm444def456ghi789jkl","level":"EL"},{"wakuwakuMasterId":"cl5wm555def456ghi789jkl"}]}' \
  "http://localhost:3000/api/v1/owned-characters/cl2own222def456ghi789jkl/wakuwaku"
```

**わくわくの実を全解除**

```bash
curl -b cookies.txt -X PUT \
  -H "Content-Type: application/json" \
  -d '{"slots":[]}' \
  "http://localhost:3000/api/v1/owned-characters/cl2own222def456ghi789jkl/wakuwaku"
```

**キャラクターマスターを新規作成(admin限定)**

```bash
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"indexNumber":9999,"monsterName":"新キャラ名","element":"火","type":"限定"}' \
  "http://localhost:3000/api/v1/characters"
```

**APIキーを発行(admin限定・セッション認証限定)**

```bash
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"集計バッチ","scopes":["characters:read","accounts:read"]}' \
  "http://localhost:3000/api/v1/api-keys"
```

**発行したAPIキーでキャラクターマスター一覧を取得**

```bash
curl -H "Authorization: Bearer mdb_live_..." \
  "http://localhost:3000/api/v1/characters"
```
