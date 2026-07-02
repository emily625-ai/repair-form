# repair-form 半自動 LINE 收件方案（含進線時間自動帶入規則）

Status: Draft
Project: repair-form
Location: F:\07_網站與專案\repair-form
Last Updated: 2026-05-30

## Summary
目標是讓 `repair-form` 能半自動從 LINE Official Account 後台收件，減少每週回頭逐筆翻 LINE 的時間，同時避免只用聊天室摘要造成客服紀錄失真。

第一版流程採兩段式：

1. 批次抓取 `聊天室清單摘要`，先勾選負責項目，匯入待分類池
2. 建案前再自動打開該聊天室，抓取 `目前可見的對話內容與可辨識時間`，補成較完整的客服紀錄

其中 `進線日期時間` 會盡量從 LINE 顯示時間自動帶入，但分成 `正式時間`、`暫定時間`、`需人工確認` 三種層級處理。

## Goals
- 降低週報前回頭翻 LINE 的成本
- 讓 LINE 收件先進系統，再進正式案件
- 保留人工判斷空間，避免把非負責聊天室或低價值訊息塞進週報
- 在正式建案前補足足夠的脈絡，降低客服紀錄失真

## Workflow
### 第一段：聊天室清單摘要批次抓取
- 使用者先在 Chrome 開啟並登入 `chat.line.biz`
- 在 `repair-form` 的 `LINE import` 畫面按 `從 LINE 後台抓取聊天室清單`
- 系統抓取可見聊天室摘要並顯示在 `capture preview`
- 使用者勾選自己負責或需要追蹤的項目
- 只有勾選的項目才匯入 `LINE pending pool`

### 第二段：建案前補抓可見對話
- 使用者在待分類池中對某一筆按 `建立新案件`
- 系統先自動開啟對應聊天室
- 抓取目前畫面可見的對話內容與可辨識時間
- 補回待分類資料與建案表單
- 使用者確認後再建立正式客服案件

## Scope
### In Scope
- 從 `chat.line.biz` 抓取聊天室清單摘要
- 匯入前勾選要收件的聊天室
- 建案前補抓目前可見對話
- 進線日期時間自動帶入與信心等級標記
- LINE 待分類池與正式客服案件銜接
- 週報持續由既有 `records` 產生

### Out of Scope
- 背景排程自動同步
- 無人值守全自動爬取
- 完整歷史聊天室逐字抓取
- 自動判定責任歸屬
- 直接從 LINE 摘要池產生週報

## Implementation Plan
### 1. 兩段式 LINE 收件流程
- 第一段：抓取聊天列表摘要
  - 從 `chat.line.biz` 可見聊天室清單抓取摘要
  - 先顯示勾選預覽，不直接落庫
  - 只有勾選項目才匯入待分類池
- 第二段：建案前補抓可見對話
  - 對要建案的待分類項目，自動開啟對應聊天室
  - 抓取可見對話內容與可辨識訊息時間
  - 補回待分類項目與建案表單

### 2. 聊天室清單抓取與勾選
- `LINE import` 畫面新增：
  - `從 LINE 後台抓取聊天室清單`
  - `匯入已勾選項目`
- `capture preview` 每列顯示：
  - 勾選框
  - 聊天室名稱
  - 最後訊息摘要
  - LINE 顯示時間文字
  - 重複警示
  - 匯入動作
- 提供批次操作：
  - `全選`
  - `全不選`
  - `只選未重複`
- 未勾選項目第一版不落庫

### 3. 匯入判斷與工作責任
- 第一版由使用者人工勾選決定是否匯入，因為有些聊天室不是自己負責
- 匯入後每筆待分類項目支援：
  - `建立新案件`
  - `連結既有案件`
  - `略過`
  - `非我負責`
  - `重複`
- 系統不自動判斷責任歸屬，先把判斷權留給使用者

### 4. 進線日期時間自動帶入規則
- 新增 `line_time_confidence` 概念，用來區分時間可信度：
  - `exact`：從聊天室可見訊息取得明確日期時間
  - `estimated`：只能從聊天列表摘要時間推算
  - `manual_required`：無法可靠取得，需人工確認
- 第一段摘要抓取時：
  - 如果列表時間是可解析格式，例如 `8:47`，先推算為當日 `08:47`，標記 `estimated`
  - 如果列表時間是 `昨天`、`週一` 這類相對描述，僅在可安全推算時填值，否則保留待確認
  - 如果時間文字不足以還原日期時間，標記 `manual_required`
- 第二段補抓聊天室時：
  - 若可從可見對話找到更完整的訊息時間，將 `進線日期時間` 升級為 `exact`
  - `exact` 時間可覆蓋先前的 `estimated`
- 建案規則：
  - `exact` -> 直接帶入正式 `date`
  - `estimated` -> 預填在表單中，但需明顯提示可修改
  - `manual_required` -> 建案前必須人工確認或輸入

### 5. 建案前自動補抓可見對話
- 當使用者按 `建立新案件`：
  - 先自動打開該聊天室
  - 抓取目前畫面可見的對話內容
  - 抓取可辨識的訊息時間
  - 產生 `captured_visible_conversation`
- 建案畫面需同時顯示：
  - 聊天室摘要
  - 可見對話補抓內容
  - 進線時間來源與可信度
- 若補抓失敗：
  - 允許退回 `摘要 + 人工補充`
  - 不阻塞整個建案流程

### 6. LINE 待分類池資料模型
- 每筆待分類項目至少包含：
  - `line_chat_id`
  - `sender_name`
  - `received_at_text`
  - `received_at`
  - `line_time_confidence`
  - `raw_message`
  - `captured_visible_conversation`
  - `source = line_backend_capture`
  - `capture_batch_id`
  - `duplicate_hash`
  - `duplicate_warning`
  - `status`
  - `case_id`
  - `link_mode`
- `status` 第一版固定：
  - `pending`
  - `capturing`
  - `created`
  - `linked`
  - `skipped`
  - `not_mine`
  - `duplicate`
  - `error`

### 7. 正式客服案件對應規則
- 建案時欄位對應：
  - `date` <- `received_at`
  - `channel` <- 固定 `官方LINE`
  - `company` <- 人工選填
  - `plate` <- 可由可見對話預填，無則人工補
  - `description` <- `raw_message` + `captured_visible_conversation`
- `description` 建議組合格式：
  - `聊天室摘要`
  - `可見對話內容`
  - `人工補充`
- 若 `line_time_confidence = manual_required`，建案前不允許直接略過時間欄位

### 8. 一筆摘要可對應多個案件
- 一筆 LINE 待分類項目不可被限制只能建立一案
- 同一筆項目要能：
  - 建立一案
  - 再建立第二案
  - 或連結多個既有案件
- 關聯資料需支援一對多，不可寫死一對一

### 9. 週報口徑
- 週報仍只從正式 `records` 產生
- 不納入：
  - 未勾選聊天室摘要
  - 待分類但未建案項目
  - 僅補抓但未轉正式案件資料
- analytics 可增加輔助指標：
  - `本週 LINE 待分類數`
  - `本週 LINE 已建案件數`
  - `本週 LINE 時間待確認數`

## File Ownership
### `客服記錄系統.html`
- 擴充 `LINE import` 畫面
- 新增抓取、勾選、匯入、補抓與時間顯示 UI

### `客服記錄系統.line-import.js`
- 將現有 mock LINE import 轉為正式前端控制流程
- 管理聊天室摘要抓取、勾選匯入、待分類狀態、建案前補抓

### `客服記錄系統.form.js`
- 建案表單預填
- 進線時間信心等級處理
- LINE 摘要與補抓內容組裝成正式 description

### `客服記錄系統.analytics.js`
- 維持既有週報下載功能
- 視需要補充 LINE 待分類輔助統計

### 資料層 / 後端
- 新增待分類池正式資料來源，例如 `line_import_messages`
- 維持既有 `cases/records` 作為正式週報來源

### Chrome / LINE 整合層
- 檢查 Chrome 可用
- 檢查 `chat.line.biz` 已登入
- 抓取聊天列表摘要
- 打開指定聊天室並抓取可見對話與時間

## Acceptance Criteria
- 可從 `chat.line.biz` 抓取可見聊天室摘要
- 匯入前可勾選項目，未勾選項目不落庫
- 待分類池可管理 `建立新案件 / 連結既有案件 / 略過 / 非我負責 / 重複`
- 點 `建立新案件` 時可先補抓可見對話與可辨識時間
- `進線日期時間` 支援 `exact / estimated / manual_required`
- 正式案件仍可進既有 analytics 與週報
- 未建案的 LINE 摘要不會污染週報統計

## Risks
- `chat.line.biz` DOM 結構可能變動，需容忍抓取失敗與回退流程
- Chrome 擴充連線可能不穩，需明確回報錯誤原因
- `聊天室摘要` 與 `可見對話` 仍不等於完整歷史聊天，因此需保留人工補充入口

## Rollback / Fallback
- 若 LINE 抓取失敗，仍可使用既有：
  - `貼上 LINE 訊息` 快速新增
  - `CSV 匯入`
- 若時間解析失敗，改由人工確認進線時間
- 若可見對話補抓失敗，允許摘要建案 + 人工補充
