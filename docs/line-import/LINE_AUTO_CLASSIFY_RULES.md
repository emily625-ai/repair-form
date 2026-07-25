# LINE Import Auto Classification (Rule-Based, MVP)

Status: Implemented (rule-based only, no AI/API call)
File: `客服記錄系統.line-import.js`

## What it does

When an operator clicks `建立案件` on a pending LINE message, the system now
guesses `category` / `subcategory` from the message text instead of always
defaulting to `平台系統`. The same suggestion is shown in the message detail
modal (`建議分類`) before the operator opens the case form, so they can judge
the message faster.

This is intentionally simple: substring keyword matching against the existing
`SUBMAP` category/subcategory list (`客服記錄系統.core.js`). No external API,
no new dependency, no data mutation — it only changes what gets prefilled in
the create-case form. The operator still reviews and saves through the
existing case creation flow, so `activity_log` coverage is unchanged.

## How matching works

1. Every subcategory string in `SUBMAP` is split into keyword fragments
   (on `、`, `,`, `/`) and lowercased. Fragments shorter than 2 characters are
   dropped.
2. A small hardcoded list, `LINE_CLASSIFY_EXTRA_KEYWORDS`, adds short
   high-frequency terms (e.g. `登入`, `定位`, `發票`, `gps`, `匯款`, `溫度`)
   that would otherwise never substring-match because they only appear inside
   a longer subcategory phrase (e.g. `發票問題` won't match `發票開立有問題`).
3. Generic catch-all subcategories (`其他`, `進度追蹤`, `問題進度追蹤`,
   `報修進度追蹤`, `資料提供`) are excluded from the auto-derived keyword list
   — they are too generic and would cause false positives.
4. `classifyLineMessageText(text)` finds every keyword that appears as a
   substring of the (lowercased, whitespace-normalized) message text, and
   picks the one with the highest "specificity weight": each CJK character
   counts as 2, each other character counts as 1. This keeps exact Chinese
   subcategory phrases from losing to shorter/incidental Latin substrings
   (e.g. `登入失敗` should win over `loading` even though `loading` has more
   characters).
5. If nothing matches, the result is `null` and the form falls back to the
   previous default (`平台系統`), with a toast telling the operator to
   confirm manually.

## Known limitations

- Pure substring matching — no synonyms, stemming, or fuzzy matching.
- Keyword list is Chinese-only (mirrors `SUBMAP`), so English-only messages
  will rarely match beyond the small extra-keyword list (`gps`, `loading`).
- A message can plausibly belong to more than one category (e.g. `定位異常`
  exists under both `平台系統` and `GPS設備`); ties are broken by keyword
  order in `SUBMAP`, which currently favors `平台系統`.
- This is a suggestion only — the operator must still confirm the category
  on the case form before saving.

## Extending it

- Add more subcategory phrases directly in `SUBMAP` (`客服記錄系統.core.js`)
  and they will automatically be picked up as keywords.
- Add short/common terms to `LINE_CLASSIFY_EXTRA_KEYWORDS` in
  `客服記錄系統.line-import.js` when a real message misses classification
  because the relevant term only appears as a fragment of a longer phrase.
- If accuracy becomes insufficient for daily use, the next step (already
  scoped as Phase 2 in `LINE_IMPORT_SPEC.md` / `LINE_IMPORT_UI_SPEC.md`) is
  AI-assisted classification, which is out of scope for this change.
