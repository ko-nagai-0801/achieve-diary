# lib/

アプリの「状態/永続化/localStorage購読/タグ処理」をまとめた層です。  
基本方針：**UIは app/components**、**状態の購読とキャッシュは store**、**画面からの利用は hooks** に寄せます。

---

## days（記録データ：DayEntry / AchieveDay）

- `days-store.ts`
  - DayEntry を **キャッシュ**し、`useSyncExternalStore` 向けに **subscribe / snapshot** を提供
  - 更新検知は **他タブ（storageイベント）**＋**同一タブ（subscribeStorageMutations）**
- `days-refresh.ts`
  - 更新の **idle実行 / 間引き（throttle）/ 二重予約防止** を担当（storeの負担を減らす）
- `useDaysData.ts`
  - 画面側の入口（enabled条件、mount/focus/visible などの更新ポリシーを集約）

---

## aliases（表記ゆれ辞書：TagAliases）

- `diary.ts`
  - aliasの **正規化 / load/save/reset / canonicalize / extractTags** など「純関数＋IO薄め」の集合
- `aliases-store.ts`
  - TagAliases を **キャッシュ**し、`useSyncExternalStore` 向けに **subscribe / snapshot** を提供
  - `notifyTagAliasesMutated()` により **同一タブ即反映**（編集UIの保存後に呼ぶ）
- `useTagAliases.ts`
  - 画面側の入口（更新タイミングやthrottleを統一）

---

## tags（入力補助：アクティブトークン / 候補生成）

- `tags/active-token.ts`
  - カーソル位置から「いま編集中の #トークン」を検出
- `tags/suggest.ts`
  - 既存データからタグ候補を作る（並び替え・集計など）
- `useTagSuggest.ts`
  - 「候補UI表示中だけ」読み込み・idle集計など、体感改善のための制御をまとめる

---

## storage（localStorage 永続化・キー・通知）

- `storage.ts`
  - `AchieveDay / AchieveItem` の型と、localStorageの **読み書き**、キー定義
  - `subscribeStorageMutations()` で **同一タブの変更通知** を提供（store側が購読して即反映）
- `client-scheduler.ts`
  - `runIdle()` など、UIブロックを避けるためのスケジューリング補助

---

## prefs（小さな永続設定）

- `prefs/bool.ts`
  - boolean設定の load/save を共通化（UIのトグルなどで使用）
