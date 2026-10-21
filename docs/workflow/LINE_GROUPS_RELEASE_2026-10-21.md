# 新進 LINE 對話群組整合（待上線）

以目前正式部署 a8770d93f648279ffef7e5f18e598de5f62b7c53 為基底，整合 direct-FK 群組草案。原工作區的其他未提交變更保留在原處；此次在獨立目錄整理。

## 行為

新 pending／error INSERT line_messages 在同一交易執行共用分組 trigger：source + sender_id，與最新 conversation.last_message_at 相距 0～30 分鐘沿用，否則開新串；封存、建案、合併或人工拆分後的 sealed 串不再接收。缺 sender_id 時從既有 raw_message JSON 的 source.groupId/roomId/userId 找穩定識別，否則每則獨立。缺時間或晚到早於最新時間另開。

每則 INSERT 更新 started_at、last_message_at、message_count、combined_message、version，寫 activity_log；任何一步失敗整筆回滾。原始訊息不覆寫，不自動建案，不回填已存在訊息。duplicate_hash 或有穩定身份／時間的精確原文比對去重；身份與時間皆不足時，API 重試必須提供穩定事件 hash 才可保證去重。

前端一 conversation 一列，顯示來源、發話者、摘要、起訖與數量，明細讀原始訊息。保留人工建立案件、合併、封存、拆分。歷史未分組訊息另以唯讀範圍查看，原本訊息不會因為切換群組畫面而消失。

人工建案接受 V2 與目前正式 V3.1；V3.1 在資料庫核對分類代碼、FMS 專案、產品、案件類型、大類與次分類的有效組合。SQL 內固化 131 個使用中分類 tuple，後續字典更新必須同步更新 RPC。保留最新版的專案選擇、分類、原版面及授權，更新受影響模組的快取版本。

手動匯入先提供 JSON 陣列；每批 1～500 筆，白名單禁止指定案件／對話 ID 或處理後 status。不新增依賴。

## 驗證

- tests/direct-fk-grouping.cjs：時間窗、來源／sender 分隔、fallback、缺 ID、重複 ID、原輸入保留、匯入白名單、時間驗證、讀取不回填通過。
- tests/classification-release.cjs：131 個有效分類 × 正確／錯誤專案，262 項檢查通過；原有分類模組沒有修改。
- JavaScript 語法與 git diff --check 通過。
- tests/browser-line-groups.cjs：已備妥離線瀏覽器驗證，所有請求攔截、不碰正式資料。直接啟動本機 Chromium／Chrome 受環境限制；已改由 tests/build-browser-validation.cjs 產生自足的合成資料測試頁，使用既有瀏覽器執行，12 項檢查通過。所有測試請求由 fixture 攔截，未呼叫正式 API。這是畫面／DOM 合成驗收，仍須真實登入與 PostgREST 整合驗收。
- tests/build-direct-fk-validation.cjs：產生 rollback-only、獨立 schema 的完整資料庫測試，包含指定六種情境、彙總、拆分／合併／封存、V3.1 人工建案、錯誤專案拒絕、稽核拒絕回滾、anon 拒絕。
- **最新版 SQL 已完成重驗**：恢復 staging 後，於獨立 schema 執行 rollback-only 測試通過，包含 V3.1 人工建案與錯誤專案拒絕。執行後唯讀確認 test_schema_removed=true。staging 原表與正式環境均未修改；這是合成資料／RLS fixture 測試，不代表實際 PostgREST 或 webhook 端到端驗收完成。

## 上線前仍需完成

1. 已完成 staging 獨立交易測試及清理驗證；仍須在真實整合環境核對 RLS／activity_log 序列／PostgREST 權限。
2. 12 項合成瀏覽器檢查通過；仍需實際登入、PostgREST、雙客服競爭與匯入失敗的整合驗收。
3. 已核對正式 report-api 96395f90：寫 public.line_messages、文字 pending／媒體 error、簽章驗證存在、收件不自動建案。已準備配套修正：groupId／roomId 優先、保留舊 hash、正確識別資料庫去重空回傳。SQL 接受 pending／error，人工操作支援混合狀態串。22 項後端契約／真實 Flask 測試及週月報回歸通過；仍需真實簽章 LINE 與 PostgREST 端到端驗收。
4. 依 AGENTS.md「Supabase schema, RLS, and policy changes should be stored as SQL references or migration drafts only.」本次只提供草案；正式 SQL 安裝與發版需另行明確執行。先備份 schema metadata、grants、policies，不匯出客戶原文。
5. 先安裝 direct-fk-grouping-draft.sql，再 direct-fk-actions-draft.sql；如果已有同名物件 CREATE 會拒絕，必須先審核定義。不要套用舊 membership/fixed-window 草案。安裝不 UPDATE 歷史資料、不修改既有 RLS。
6. 再部署前端，核對新訊息實際出現 conversation_id，並確認歷史未分組資料仍未回填；本次正式查核基準為 3605 筆訊息、0 linked、0 conversations，正式筆數可能因日常收件繼續增加。

## 回滾

先停新匯入、切回上一前端，再依序執行 direct-fk-actions-rollback.sql、direct-fk-grouping-rollback.sql。保留所有 cases、原訊息、對話 ID、摘要與活動紀錄，不刪除客戶資料。部署失敗時不要靠回填或改寫原訊息修復。

## 範圍

只修改客服記錄系統.html、data.js、line-import.js，新增 line-conversations.js、4 個 SQL 草案／回滾、5 個測試／產生器及本文件；其他正式模組保持基底版本。

## 發佈阻擋與交付

GitHub connector 的 create_branch/create_tree 仍回應 403 Resource not accessible by integration；改用已登入的 GitHub 網頁，已成功建立 feature/line-conversations-release 分支並提交修改。後續以草稿 PR 審核，不修改 main。staging 經使用者恢復後已可連線，隔離交易測試通過；不要把分支提交誤認為正式上線。

首次交付提供以 a8770d93 為基底的 13 檔 ZIP／修補檔；後續新增瀏覽器產生器與 webhook 相容修正，最新版本以 PR 為準。原 repair-form-deploy 目錄及同步參考資料未被修改。正式部署前仍須完成以上 staging／瀏覽器與 webhook 驗收。

## Webhook 相容性修正

新 error 訊息（如圖片）同樣經共用 trigger 分組。人工操作只接受 pending／classified／error 原訊息，仍核對 case relation、版本、訊息快照，拒絕已 linked／archived 的訊息；不改既有 RLS。最新版 staging 隔離測試已加入文字／圖片混合群組與整串封存並通過。

正式 API 的預設程式 schema 雖為 staging，實際 Render 設定已核對為 cs-system/public.line_messages。後端程式與正式部署 commit 一致。配套 API 修正需與 SQL 一併審核，不能只部署前端。
