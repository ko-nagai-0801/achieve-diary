/* components/today/AddBox.tsx */
"use client";

import { useCallback, useRef, useState } from "react";
import { useTagSuggest } from "@/lib/useTagSuggest";

type AddBoxProps = {
  onAdd: (text: string) => boolean; // true: 追加成功
};

export default function AddBox(props: AddBoxProps) {
  const { onAdd } = props;

  const [text, setText] = useState<string>("");
  const [cursor, setCursor] = useState<number>(0);

  const [focused, setFocused] = useState<boolean>(false);
  const [suggestEnabled, setSuggestEnabled] = useState<boolean>(true);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const addLockRef = useRef<boolean>(false);

  const tagSuggest = useTagSuggest({
    text,
    cursor,
    focused,
    suggestEnabled,
    textareaRef: inputRef,
    setText,
    onAfterInsert: () => setSuggestEnabled(false),
  });

  const canAdd = text.trim().length > 0;

  const addItem = useCallback(() => {
    if (addLockRef.current) return;

    const v = text.trim();
    if (!v) return;

    addLockRef.current = true;

    try {
      const ok = onAdd(v);
      if (ok) {
        setText("");
        setCursor(0);
        setSuggestEnabled(true);
        inputRef.current?.focus();

        // 追加直後に候補更新（A+B+Cの共通経路）
        tagSuggest.refresh();
      }
    } finally {
      window.setTimeout(() => {
        addLockRef.current = false;
      }, 0);
    }
  }, [text, onAdd, tagSuggest]);

  function onAddKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;
    if (e.repeat) return;

    const isShortcut = e.metaKey || e.ctrlKey;
    if (!isShortcut) return;

    e.preventDefault();
    addItem();
  }

  const shouldRenderSuggest =
    tagSuggest.shouldShowSuggest && (tagSuggest.isComputing || tagSuggest.suggestions.length > 0);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">追加</h2>

      <div className="mt-3 space-y-2">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              setCursor(e.target.selectionStart ?? v.length);
              setSuggestEnabled(true);
            }}
            onKeyDown={(e) => {
              const el = e.currentTarget;
              setCursor(el.selectionStart ?? el.value.length);
              setSuggestEnabled(true);
              onAddKeyDown(e);
            }}
            onClick={(e) => {
              const el = e.currentTarget;
              setCursor(el.selectionStart ?? el.value.length);
              setSuggestEnabled(true);
            }}
            onKeyUp={(e) => {
              const el = e.currentTarget;
              setCursor(el.selectionStart ?? el.value.length);
            }}
            onFocus={() => {
              setFocused(true);
              setSuggestEnabled(true);
              tagSuggest.refresh();
            }}
            onBlur={() => setFocused(false)}
            placeholder={"できたことを複数行でOK（例：\n・洗い物した\n・5分歩いた #健康）"}
            rows={4}
            className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />

          {shouldRenderSuggest ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-lg">
              <div className="flex items-center justify-between px-2 pb-1">
                <div>
                  <p className="text-xs text-zinc-500">タグ候補（直近7日優先）</p>
                  <p className="text-[11px] text-zinc-500">
                    ヒント：<span className="font-semibold">#</span>の後に入力すると絞り込み
                  </p>
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => tagSuggest.refresh()}
                  className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  更新
                </button>
              </div>

              {tagSuggest.isComputing ? (
                <div className="px-2 pb-2 text-sm text-zinc-400">集計中…</div>
              ) : (
                <ul className="flex flex-wrap gap-2 px-2 pb-1">
                  {tagSuggest.suggestions.map((s) => (
                    <li key={s.tag}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => tagSuggest.insertTag(s.tag)}
                        className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-900"
                        title="挿入"
                      >
                        <span>#{s.tag}</span>{" "}
                        <span className="text-xs text-zinc-400">
                          7日×{s.recent7Count} / 全体×{s.totalCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-zinc-200">
                  <input
                    type="checkbox"
                    checked={tagSuggest.autoSpace}
                    onChange={(e) => tagSuggest.toggleAutoSpace(e.target.checked)}
                    className="h-4 w-4 accent-zinc-200"
                  />
                  候補クリック後に半角スペースを自動挿入
                </label>

                <span className="text-[11px] text-zinc-500">ON/OFFは保存されます</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-zinc-400">
            追加：Macは <span className="font-semibold">⌘ + Enter</span>、Windowsは{" "}
            <span className="font-semibold">Ctrl + Enter</span>（Enterは改行）
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={addItem}
              disabled={!canAdd}
              className="shrink-0 whitespace-nowrap rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              追加
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-400">※MVPでは #タグ を本文に書く方式（例：散歩した #健康）</p>
      </div>
    </section>
  );
}
