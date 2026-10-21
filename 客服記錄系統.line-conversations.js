// No raw LINE content is persisted in browser storage. Preview never mutates data.
const LINE_CONVERSATION_WINDOW_MS = 30 * 60 * 1000;
let lineConversationActionInFlight = false;

function lineMessageTime(value) {
  if (!value) return NaN;
  const text = String(value).trim();
  // Offset-free manual imports use the project's Taipei timezone.
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(text) ? text : text.replace(' ', 'T') + '+08:00');
}

function groupLineMessages(messages) {
  const groups = [], latest = new Map();
  const unique = new Map(messages.map(row => [row.id, row]));
  const ordered = [...unique.values()].sort((a, b) =>
    (lineMessageTime(a.received_at) || 0) - (lineMessageTime(b.received_at) || 0) || String(a.id).localeCompare(String(b.id)));
  for (const message of ordered) {
    const time = lineMessageTime(message.received_at);
    // Missing stable identity or timestamp is never guessed from a display name.
    const key = message.conversation_id ? 'existing:' + message.conversation_id
      : JSON.stringify([message.source, lineGroupingIdentity(message), message.status || 'pending', message.case_id || '']);
    let group = latest.get(key);
    if (!group || (!message.conversation_id && (!Number.isFinite(time) || time - group.lastTime > LINE_CONVERSATION_WINDOW_MS || !Number.isFinite(group.lastTime)))) {
      group = { id: 'preview-' + (message.conversation_id || message.id), time, lastTime: time, source: message.source, sender_id: message.sender_id, messages: [] };
      groups.push(group); latest.set(key, group);
    }
    group.messages.push({ ...message });
    group.lastTime = time;
  }
  return groups.map(group => {
    const first = group.messages[0], last = group.messages.at(-1);
    const display = mapLineMessageRecordToUiRow(first);
    const combined = group.messages.map(row => `[${normalizeStoredDateTime(row.received_at) || '時間待確認'}] ${formatLineMessagePreview(row.raw_message)}`).join('\n');
    return { ...display, id: group.id, messages: group.messages, message_ids: group.messages.map(row => row.id),
      message_count: group.messages.length, started_at: normalizeStoredDateTime(first.received_at),
      last_message_at: normalizeStoredDateTime(last.received_at), combined_message: combined,
      raw_message: combined, normalized_message: normalizeLineMessageText(combined) };
  }).reverse();
}

async function loadAllLineRows(table, query = '') {
  const result = []; let cursor = '';
  for (;;) {
    const rows = await sbFetch(`${table}?${query}${cursor ? 'id=gt.' + encodeURIComponent(cursor) + '&' : ''}order=id.asc&limit=500`);
    if (!Array.isArray(rows)) throw new Error('LINE 服務回傳格式錯誤');
    result.push(...rows);
    if (rows.length < 500) return result;
    const next = rows.at(-1).id;
    if (!next || next === cursor) throw new Error('LINE 分頁游標無效');
    cursor = next;
  }
}

async function loadLineConversationQueue() {
  if (document.getElementById('lineQueueScope')?.value === 'legacy') {
    const records = await loadAllLineRows('line_messages', 'conversation_id=is.null&');
    return { mode: 'legacy', rows: records.map(message => ({ ...mapLineMessageRecordToUiRow(message),
      id: 'legacy-' + message.id, messages: [message], message_ids: [message.id], message_count: 1,
      started_at: normalizeStoredDateTime(message.received_at), last_message_at: normalizeStoredDateTime(message.received_at)
    })).sort((a,b) => lineMessageTime(b.started_at) - lineMessageTime(a.started_at)) };
  }
  try {
    const rows = await loadAllLineRows('line_conversation_queue');
    return { mode: 'remote', rows: rows.map(row => {
      const display = mapLineMessageRecordToUiRow({ ...row, sender_name: row.sender_name || row.grouping_key || '未識別來源', status: row.status === 'pending_review' ? 'pending' : row.status, raw_message: row.combined_message, received_at: row.started_at, case_id: row.primary_case_id });
      return { ...display, version: row.version, message_ids: row.message_ids,
        message_count: row.message_count, combined_message: row.combined_message,
        started_at: normalizeStoredDateTime(row.started_at), last_message_at: normalizeStoredDateTime(row.last_message_at),
        duplicate_warning: row.has_missing_hash ? 'hash_missing' : 'none' };
    }).sort((a,b) => lineMessageTime(b.started_at) - lineMessageTime(a.started_at)) };
  } catch (error) {
    // Only a missing schema/function permits preview. Auth/network/RLS errors fail closed.
    if (!/PGRST202|PGRST205|42P01|42883/.test(String(error.message))) throw error;
    return { mode: 'preview', rows: groupLineMessages(await loadAllLineRows('line_messages', 'conversation_id=not.is.null&')) };
  }
}

async function loadLineConversationMessages(id) {
  const members = await loadAllLineRows('line_messages', `conversation_id=eq.${encodeURIComponent(id)}&`);
  return members.sort((a,b) => lineMessageTime(a.received_at) - lineMessageTime(b.received_at) || a.id.localeCompare(b.id));
}

function canProcessLineConversation(row) {
  if (lineImportStorageMode !== 'remote') {
    showLineImportAlert(lineImportStorageMode === 'legacy' ? '歷史訊息僅供查看，未回填成對話串。' : '目前只能預覽；需先驗證並安裝 conversation schema。', 'error'); return false;
  }
  if (!row || !['pending', 'error', 'classified'].includes(row.status)) {
    showLineImportAlert('此對話串已處理，請重新整理後確認。', 'error'); return false;
  }
  return true;
}

async function lineConversationRpc(id, action, options = {}) {
  if (lineImportStorageMode !== 'remote') throw new Error('conversation 儲存功能尚未就緒');
  return sbFetch('rpc/line_conversation_action', { method: 'POST', body: JSON.stringify({
    p_id: id, p_action: action, p_version: options.expectedVersion,
    p_message_ids: options.expectedMessageIds, p_case_id: options.caseId || null,
    p_selected_ids: options.selectedIds || [], p_record: options.record || null
  }) });
}

async function performLineConversationAction(id, action, options = {}) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!canProcessLineConversation(row) || lineConversationActionInFlight) return;
  lineConversationActionInFlight = true;
  try {
    await lineConversationRpc(id, action, { ...options, expectedVersion: row.version, expectedMessageIds: row.message_ids });
    closeLineMessageDetail();
    await refreshLineImportPendingRows({ silent: true });
    if (lineImportStorageMode === 'remote') showLineImportAlert('對話串已處理，原始訊息保留。', 'success');
  } catch (error) { showLineImportAlert('對話串處理失敗，請重新整理後確認：' + error.message, 'error'); }
  finally { lineConversationActionInFlight = false; }
}

async function mergeLineConversation(id) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!canProcessLineConversation(row)) return;
  const caseId = prompt('輸入既有案件編號，整段對話將附加到案件描述：', '');
  if (!caseId?.trim()) return;
  await performLineConversationAction(id, 'merge', { caseId: caseId.trim() });
  if (lineImportStorageMode === 'remote' && typeof loadRecords === 'function') await loadRecords();
}

async function splitLineConversation(id) {
  const selectedIds = [...document.querySelectorAll('input[name="lineSplitMessage"]:checked')].map(node => node.value);
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!canProcessLineConversation(row)) return;
  if (!selectedIds.length || selectedIds.length >= row.message_count) {
    showLineImportAlert('請在原始訊息內勾選部分訊息，原對話串至少保留一則。', 'error'); return;
  }
  await performLineConversationAction(id, 'split', { selectedIds });
}

// Only IDs carried by existing raw LINE event metadata are stable fallbacks.
// Display names and the import channel alone are never used as an identity.
function lineGroupingIdentity(message) {
  if (String(message.sender_id || '').trim()) return 'sender:' + message.sender_id.trim();
  let event;
  try { event = JSON.parse(message.raw_message); } catch (_) { return 'message:' + message.id; }
  const source = event?.source;
  for (const field of ['groupId', 'roomId', 'userId']) {
    if (typeof source?.[field] === 'string' && source[field].trim()) return field + ':' + source[field].trim();
  }
  return 'message:' + message.id;
}

async function importLineMessageRecords(records) {
  if (!Array.isArray(records) || !records.length) throw new Error('請提供訊息陣列');
  const allowedSources = ['csv','manual_paste','browser_automation','line_webhook'];
  if (records.length > 500) throw new Error('一次最多匯入 500 則訊息');
  const rows = records.map(row => {
    if (!row || !allowedSources.includes(row.source) || typeof row.raw_message !== 'string' || !row.raw_message.trim())
      throw new Error('每則訊息必須有合法 source 與 raw_message');
    if ((row.sender_id != null && typeof row.sender_id !== 'string') || (row.sender_name != null && typeof row.sender_name !== 'string') || (row.duplicate_hash != null && typeof row.duplicate_hash !== 'string')) throw new Error('訊息識別欄位必須是文字');
    if (row.received_at && !Number.isFinite(lineMessageTime(row.received_at))) throw new Error('訊息時間格式錯誤');
    // Whitelist: callers cannot set case_id, conversation_id or processed status.
    return { source: row.source, sender_id: row.sender_id || null, sender_name: row.sender_name || null,
      raw_message: row.raw_message, received_at: row.received_at ? new Date(lineMessageTime(row.received_at)).toISOString() : null,
      normalized_message: normalizeLineMessageText(row.raw_message), duplicate_hash: row.duplicate_hash || null, status: 'pending' };
  });
  return sbFetch('rpc/line_import_messages', { method: 'POST', body: JSON.stringify({ p_rows: rows }) });
}

async function submitManualLineMessages() {
  const input = document.getElementById('lineManualInput');
  const button = document.getElementById('lineManualSubmit');
  button.disabled = true;
  try {
    const result = await importLineMessageRecords(JSON.parse(input.value));
    input.value = '';
    await refreshLineImportPendingRows({ silent: true });
    showLineImportAlert(`匯入 ${result.inserted} 則，略過重複 ${result.duplicates} 則。`, 'success');
  } catch (error) {
    showLineImportAlert('匯入失敗，請確認內容與服務狀態後再試：' + error.message, 'error');
  } finally { button.disabled = false; }
}
