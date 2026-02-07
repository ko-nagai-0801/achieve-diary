# achieve-diary

ローカル（`localStorage`）に「今日できたこと」を保存し、**履歴検索**と**簡易インサイト集計**まで行える Next.js アプリです。

- `/today`：今日の「できたこと」を追加・編集・削除（タグ補完あり）
- `/history`：全日データを一覧・検索（本文/タグ）
- `/insights`：全日スキャンして集計（総日数/総件数/頻出ワード）＋ **表記ゆれ辞書（aliases）編集**

> データはサーバーではなく **ブラウザの localStorage に保存**されます（端末/ブラウザごとに独立）。

---

## Tech Stack

- Next.js 16.1.6（App Router / Turbopack）
- TypeScript
- ESLint
- UI: Tailwind CSS

---

## Getting Started

### 1) Install

```bash
pnpm install
```

### 2) Dev

```bash
pnpm dev
```

- http://localhost:3000

### 3) Lint / Typecheck

```bash
pnpm run lint
pnpm exec tsc --noEmit
```

---

## Data Storage

- `localStorage` に日別データを保存します
- ブラウザを変えるとデータは引き継がれません
- シークレットモード等では保持が不安定な場合があります

---

## Routes

- `/today`：入力・編集（タグ候補は「表示中だけ」読み込み＆idle集計で体感改善）
- `/history`：全データ検索（本文/タグ）
- `/insights`：集計 + 表記ゆれ辞書の編集（保存後に同一タブ即反映）

---

## Project Structure

```
app/
  today/      ... Today page (Client)
  history/    ... History page (Client)
  insights/   ... Insights page (Client)
components/
  today/      ... Today UI parts (AddBox / TodayList / MoodPicker / MemoBox)
lib/
  storage.ts          ... localStorage 永続化・キー・同一タブ通知
  days-store.ts       ... DayEntry の購読/キャッシュ（useSyncExternalStore）
  days-refresh.ts     ... idle/間引き/二重予約防止
  aliases-store.ts    ... TagAliases の購読/キャッシュ（useSyncExternalStore）
  diary.ts            ... tags/aliases の正規化・抽出など
  tags/*              ... タグ補助（アクティブトークン、候補生成）
  useDaysData.ts      ... 画面からの入口（enabled条件/更新方針）
  useTagAliases.ts    ... 辞書の参照口（更新方針を統一）
  useTagSuggest.ts    ... 候補UI表示中だけ読み込み＆idle集計
```

詳しくは `lib/README.md` を参照してください。  
- `lib/README.md`

---

## Development Notes

- TypeScript：`any` は使わない（`unknown` + 型ガード）
- Effect 内で同期 `setState` はしない（idle / setTimeout 等で制御）
- 重い処理（全日スキャン・集計）は「必要な時だけ」＋「idleで」実行

---

## License

## License

Copyright (c) 2026 Kou Nagai

このリポジトリは個人開発のため公開しています。
学習目的での閲覧・参考はOKですが、転載は禁止複製・再配布・商用利用はご遠慮ください。
