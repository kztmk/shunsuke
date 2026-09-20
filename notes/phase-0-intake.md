# 旬助 Phase 0 受付記録

- 記録日時: 2026-09-20
- 正本手順書: `docs/shunsuke-gas-development-procedure.md`
- 状態: Phase 0 完了。ユーザー承認により Phase 1 を開始。

## リポジトリ固定点

| リポジトリ | ブランチ | HEAD | 未コミット変更 |
| --- | --- | --- | --- |
| `rakuten-watcher` | `phase/r4-scene-products` | `bbdb6c1` | 変更3件、新規2件 |
| 虎威 (`x_Autopost`) | `main` | `d43edc2` | なし |
| 翔 (`Autopost_Threads`) | `release` | `68d40c4` | `src/api/threadsAuth.ts` の変更1件 |

## `rakuten-watcher` の保全対象

- 変更: `src/Code.js`
- 変更: `src/GasAdapters.js`
- 変更: `test/phase2-adapters.test.js`
- 新規: `src/SceneProductService.js`
- 新規: `test/scene-product-service.test.js`

これらは既存の `phase/r4-scene-products` に属するユーザー成果物であり、旬助へ取り込む、保存する、別ブランチで継続する、破棄する、のいずれも未決定である。無断で移動、コミット、破棄、上書きしない。

## 承認済みの決定

1. 指定手順書を `approved` とする。
2. 既存差分はすべて元リポジトリに保全し、移動、上書き、コミット、破棄をしない。
3. 旬助の実装対象を新規 `GAS/Shunsuke` に変更する。
4. 新規リポジトリの実装ブランチを `phase/1-domain-state` とする。旧トリガー、既存Sheet、移行元データは実接続前に別途記録・承認する。

この決定により、手順書第25節の実装開始前条件を満たした。
