# 客服記錄系統變更整合紀錄

日期：2026-06-18

目的：整合近期客服記錄系統、LINE 匯入、報表 API、問卷追蹤與資料庫草案相關變更，避免規劃、實作與待驗收事項分散在對話紀錄中。

## 目前正式專案位置

- 正式前端 repo：`F:\07_網站與專案\repair-form`
- 正式報表 API repo：`C:\Users\emily\OneDrive\文件\New project\report-api`
- 暫存與參考區：`C:\Users\emily\OneDrive\文件\New project`

注意：`New project` 本身不是正式專案 root，只有其中的 `report-api` 是正式 API repo。

## 原規劃與實際走向

### 原規劃

- LINE 匯入先做 mock UI。
- 不接 Supabase production。
- migration 先 staging-first。
- 不修改 auth。
- 不大幅重構既有 UI。

### 實際走向

- LINE 匯入已從 mock UI 推進到正式 `line_messages` 讀取。
- 後端 `report-api` 已新增 LINE OA webhook endpoint。
- 前端 LINE 匯入頁已可讀取 webhook 寫入的 LINE 訊息。
- 已新增 LINE 健康檢查機制，用於判斷 webhook 是否停滯。
- 問卷追蹤功能已開始導入前端與資料欄位對應。

### 需補紀錄的偏移

- LINE 匯入不再只是 mock-only。
- `line_messages` 實際使用已從 staging 測試推進到 production `public.line_messages`。
- webhook 健康檢查屬於正式 API 功能，應補入 API 文件與部署驗收。
- 問卷追蹤涉及 Supabase schema；已確認 production `public.cases` 有 `survey_sent`、`survey_replied` 欄位，且 migration 草案包含 rollback。

## 已完成或已實作項目

### LINE OA Webhook

- 後端 repo：`report-api`
- 主要檔案：`app.py`
- 已新增或調整：
  - `POST /api/line/webhook`
  - LINE signature 驗證
  - LINE 文字訊息寫入 `line_messages`
  - 非文字訊息以 `error` 狀態保留 metadata
  - duplicate hash 避免重複匯入
  - `activity_log` 記錄匯入、略過、失敗事件
  - sender name 解析與群組 / user / room 基本對應
  - `GET /api/line/config-check`
  - `GET /api/line/supabase-check`
  - `GET /api/line/health`

### LINE 匯入前端

- 前端 repo：`repair-form`
- 主要檔案：
  - `客服記錄系統.html`
  - `客服記錄系統.data.js`
  - `客服記錄系統.line-import.js`
- 已新增或調整：
  - LINE 匯入 tab
  - 待分類訊息列表
  - CSV 匯入預覽
  - 手動 / 後台抓取流程雛形
  - 詳細視窗
  - 建立案件流程
  - 狀態標記：待分類、已分類、已連結、已封存、需處理
  - 重新整理 LINE 訊息按鈕回饋
  - 最後匯入時間卡片
  - webhook 健康狀態顯示
  - 超過 2 小時未更新時顯示醒目停滯警示

### 問卷追蹤

- 前端欄位：
  - 是否發送問卷
  - 是否收到回覆
- 對應資料欄位：
  - `survey_sent`
  - `survey_replied`
- 已涉及檔案：
  - `客服記錄系統.analytics.js`
  - `客服記錄系統.data.js`
  - `客服記錄系統.form.js`
  - `客服記錄系統.list.js`
  - `客服記錄系統.html`
- 已新增草案：
  - `docs/sql/cases_survey_tracking_migration.sql`

### 報表與案件規則

近期已完成 commit 包含：

- 使用進線日期計算逾期規則
- 新增或調整月報逾期欄位
- 調整週報 / 月報處理狀態總覽
- 新增問題大類 / 問題次分類
- 新增處理人員選項
- 新增複製案件 / 子案相關流程

## 目前未提交變更摘要

### 前端 repo：`repair-form`

目前尚有未提交修改：

- `客服記錄系統.analytics.js`
- `客服記錄系統.core.js`
- `客服記錄系統.data.js`
- `客服記錄系統.form.js`
- `客服記錄系統.html`
- `客服記錄系統.line-import.js`
- `客服記錄系統.list.js`
- `docs/line-import/LINE_OA_CHAT_CAPTURE_SNIPPET.js`
- `docs/line-import/LINE_SEMI_AUTO_INGEST_PLAN.md`
- `docs/sql/cases_survey_tracking_migration.sql`
- `docs/workflow/PROJECT_CHANGE_INTEGRATION_2026-06-18.md`

### API repo：`report-api`

目前尚有未提交修改：

- `app.py`

主要內容：

- 新增 `parse_line_datetime`
- 新增 `get_line_latest_message`
- 新增 `GET /api/line/health`

## 建議拆分 commit

不要把全部混成同一個 commit。建議拆成以下幾個：

1. `feat: add LINE webhook health check`
   - repo：`report-api`
   - 檔案：`app.py`

2. `feat: improve LINE import monitoring UI`
   - repo：`repair-form`
   - 檔案：
     - `客服記錄系統.html`
     - `客服記錄系統.data.js`
     - `客服記錄系統.line-import.js`

3. `feat: add survey tracking fields`
   - repo：`repair-form`
   - 檔案：
     - `客服記錄系統.analytics.js`
     - `客服記錄系統.data.js`
     - `客服記錄系統.form.js`
     - `客服記錄系統.list.js`
     - `客服記錄系統.html`
     - `docs/sql/cases_survey_tracking_migration.sql`

4. `docs: document LINE semi-auto import workflow`
   - repo：`repair-form`
   - 檔案：
     - `docs/line-import/LINE_OA_CHAT_CAPTURE_SNIPPET.js`
     - `docs/line-import/LINE_SEMI_AUTO_INGEST_PLAN.md`

5. `docs: consolidate current project change record`
   - repo：`repair-form`
   - 檔案：
     - `docs/workflow/PROJECT_CHANGE_INTEGRATION_2026-06-18.md`

## 驗收清單

### 前端基本功能

- 案件列表可載入。
- 新增案件可儲存。
- 編輯案件可儲存。
- 刪除案件流程仍正常。
- 複製案件與子案流程仍正常。
- 清除篩選按鈕可正常重置。
- 問題大類 / 問題次分類選項正常。
- 負責處理人員選項正常。

### LINE 匯入

- LINE 匯入 tab 可顯示。
- 重新整理 LINE 訊息按鈕有 loading 與最後更新時間。
- 新 webhook 訊息可出現在待分類列表。
- 詳細按鈕可開啟明細。
- 建立案件可帶入 LINE 訊息內容。
- 封存 / 已分類 / 已連結狀態可更新。
- 最後匯入卡片可顯示最新時間。
- 超過 2 小時未更新時，最後匯入卡片顯示停滯警示。

### 後端 API

- `GET /health` 正常。
- `GET /api/line/config-check` 正常。
- `GET /api/line/supabase-check` 正常。
- `GET /api/line/health?threshold_minutes=120` 正常。
- `POST /api/line/webhook` 可接 LINE Verify。
- LINE App 傳文字訊息後，Render Logs 有 `POST /api/line/webhook 200`。
- Supabase `line_messages` 有新增資料。

### Supabase / SQL

- `line_messages` table 已存在。
- `line_messages` 可 SELECT。
- `line_messages` 可由 webhook 寫入。
- `cases` 已確認存在 `survey_sent`、`survey_replied` 欄位。
- 問卷 migration 必須有 rollback。
- 不可直接把未驗證 SQL 套到 production。

### 報表

- 週報可下載。
- 月報可下載。
- 逾 7 天未結案使用進線日期計算。
- 月報逾期天數計算正確。
- 處理狀態總覽欄位符合最新需求。
- 問卷回收率若啟用，需確認統計數字正確。

## 風險與注意事項

- LINE webhook 只會收到設定完成後的新訊息，不會自動補歷史訊息。
- Render Free 可能休眠；健康檢查能顯示停滯，但不能保證 LINE 永不漏送。
- LINE OA Manager 與 LINE Developers 必須確認是同一個官方帳號 / Channel。
- 前端目前仍未加入登入權限，正式多人使用前需重新評估 auth。
- LINE 匯入與問卷追蹤已超出最初 mock-only 範圍，應補文件與分批 commit。
- 問卷欄位已確認存在；正式部署前仍需驗收新增 / 編輯案件是否能正確寫入。
- 不要把對話紀錄當唯一專案紀錄，需持續寫入 docs。

## 後續建議

1. 本機驗收 LINE 匯入與案件新增 / 編輯流程。
2. 分批建立 commit。
3. 先 push `report-api`，確認 Render deploy 成功。
4. 再 push `repair-form`，確認 GitHub Pages 更新。
5. 更新 `README.md` 或 `docs/workflow/CORE_SYSTEM_CHECKLIST.md`，加入 LINE 健康檢查與問卷追蹤驗收項目。

## 2026-06-23 問題次分類「其他」補充原因

### 需求

- 問題次分類選擇「其他」時，顯示「其他原因 / 補充說明」欄位。
- 原因必須填寫，並與問題次分類分開保存。
- 新增、編輯、複製案件與建立子案時，欄位狀態與內容需正確帶入。
- 列表、搜尋、案件詳細與公司歷史需可看到或找到補充原因。

### 資料庫部署順序

1. 先審核並執行 `docs/sql/cases_subcategory_note_migration.sql`。
2. 確認 `public.cases.subcategory_note` 已建立。
3. 再部署前端修改。
4. 驗收新增、編輯與重新載入資料。

### 注意事項

- migration 含 rollback，但本次只建立 SQL 草稿，不直接執行。
- 不建立資料庫強制 constraint，以避免既有「其他」案件沒有原因時 migration 失敗。
- 前端會對新儲存內容執行必填驗證。
