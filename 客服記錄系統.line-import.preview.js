const LINE_IMPORT_STATUS_LABELS = {
  pending: '待分類',
  classified: '已分類',
  linked: '已連結',
  archived: '已封存',
  error: '需處理'
};

const LINE_IMPORT_WARNING_LABELS = {
  none: '-',
  duplicate: '重複',
  hash_missing: '缺必要欄位',
  possible_duplicate: '可能重複'
};

const LINE_SENDER_MAPPING_STORAGE_KEY = 'cs_line_sender_mappings';

const LINE_SUGGEST_LABELS = { case: '建議建案', archive: '建議封存', review: '待看' };
const LINE_COMPANY_BASIS_LABELS = {
  group: '群組對應',
  sender: '發話者對應',
  conflict: '待確認',
  plate: '車號推定',
  local: '本機對應',
  none: '待歸戶'
};

let lineSenderCompanyMap = {};
let lineSenderCompanyLoaded = false;
let lineImportBootstrapped = false;
let lineImportStorageMode = 'local';
let lineImportStatusFilter = 'pending';

let lineImportPendingRows = [
  {
    id: 'mock-line-001',
    source: 'csv',
    sender_name: 'Wang',
    sender_id: 'mock-u001',
    raw_message: 'Vehicle cannot locate. Please check KPC-5270.',
    normalized_message: 'vehicle cannot locate please check kpc-5270',
    received_at: '2026-05-16 09:30:00',
    status: 'pending',
    case_id: '',
    duplicate_warning: 'none'
  },
  {
    id: 'mock-line-002',
    source: 'manual_paste',
    sender_name: 'Chen',
    sender_id: '',
    raw_message: 'Login failed. Screen keeps showing loading.',
    normalized_message: 'login failed screen keeps showing loading',
    received_at: '2026-05-16 10:12:00',
    status: 'error',
    case_id: '',
    duplicate_warning: 'hash_missing'
  },
  {
    id: 'mock-line-003',
    source: 'csv',
    sender_name: 'Harbor',
    sender_id: 'mock-u003',
    raw_message: 'Camera is foggy, black screen, blue screen, unclear image.',
    normalized_message: 'camera is foggy black screen blue screen unclear image',
    received_at: '2026-05-16 11:18:00',
    status: 'pending',
    case_id: '',
    duplicate_warning: 'possible_duplicate'
  }
];

async function renderLineImport() {
  if (!lineImportBootstrapped) {
    await refreshLineImportPendingRows({ silent: true });
    lineImportBootstrapped = true;
  }
  renderLinePendingMessages();
  updateLineImportStats();
}

async function refreshLineImportPendingRows(options = {}) {
  if (typeof loadLineMessageRecords !== 'function') {
    if (!options.silent) showLineImportAlert('目前找不到 LINE 訊息讀取功能。', 'error');
    return;
  }
  setLineImportLoading(true, '重新讀取 LINE 訊息中...');
  try {
    lineImportStatusFilter = getLineImportStatusFilter();
    await loadLineSenderCompanyMap();
    const rows = await loadLineMessageRecords(lineImportStatusFilter);
    lineImportPendingRows = Array.isArray(rows) ? rows.map(mapLineMessageRecordToUiRow) : [];
    lineImportStorageMode = 'remote';
    renderLinePendingMessages();
    updateLineImportStats();
    if (!options.silent) showLineImportAlert(`已重新讀取 ${lineImportPendingRows.length} 筆 LINE 訊息。`, 'success');
  } catch (error) {
    lineImportStorageMode = 'local';
    console.warn('LINE import refresh failed:', error);
    if (!options.silent) showLineImportAlert(`LINE 訊息讀取失敗：${error.message || error}`, 'error');
  } finally {
    setLineImportLoading(false);
  }
}

function setLineImportLoading(isLoading, message = '處理中...') {
  const loading = document.getElementById('lineImportLoading');
  if (!loading) return;
  loading.textContent = message;
  loading.style.display = isLoading ? 'block' : 'none';
}

function showLineImportAlert(message, type = 'info') {
  const alert = document.getElementById('lineImportAlert');
  if (!alert) return;

  alert.textContent = message || '';
  alert.dataset.type = type;
  alert.style.display = message ? 'block' : 'none';
}

function mapLineMessageRecordToUiRow(row) {
  const rawMessage = row.raw_message || '';
  const displayMessage = formatLineMessagePreview(rawMessage);
  const senderId = row.sender_id || '';
  const groupId = row.group_id || '';
  const groupName = String(row.group_name || '').trim();
  const originalSenderName = normalizeLineSenderName(row.sender_name);
  const mappedSender = getLineSenderMapping(senderId);
  const companyInfo = resolveLineCompany({ senderId, groupId, rawMessage, localMapping: mappedSender });
  const displaySender = mappedSender?.contact ? `${originalSenderName}（${mappedSender.contact}）` : originalSenderName;
  return {
    id: row.id,
    source: row.source || 'line_webhook',
    sender_name: groupName ? `${groupName}｜${displaySender}` : displaySender,
    original_sender_name: originalSenderName,
    sender_id: senderId,
    group_id: groupId,
    group_name: groupName,
    mapped_company: companyInfo.company,
    company_basis: companyInfo.basis,
    company_note: companyInfo.note,
    suggestion: suggestLineIntake(rawMessage),
    mapped_contact: mappedSender?.contact || '',
    raw_message: displayMessage,
    original_raw_message: rawMessage,
    normalized_message: row.normalized_message || normalizeLineMessageText(displayMessage),
    received_at: normalizeStoredDateTime(row.received_at),
    status: row.status || 'pending',
    case_id: row.case_id || '',
    duplicate_hash: row.duplicate_hash || '',
    duplicate_warning: row.duplicate_hash ? (row.sender_id ? 'none' : 'possible_duplicate') : 'hash_missing'
  };
}

function normalizeLineSenderName(value) {
  const name = String(value || '').trim();
  if (name === 'group') return 'LINE 群組';
  if (name === 'user') return 'LINE 用戶';
  if (name === 'room') return 'LINE 多人聊天室';
  return name || 'LINE 客戶';
}

function formatLineMessagePreview(rawMessage) {
  const text = String(rawMessage || '').trim();
  if (!text) return '';
  if (!text.startsWith('{')) return text;
  try {
    const payload = JSON.parse(text);
    const messageType = payload.message_type || payload.type || '';
    const labels = {
      image: '圖片訊息',
      sticker: '貼圖訊息',
      video: '影片訊息',
      audio: '語音訊息',
      file: '檔案訊息',
      location: '位置訊息'
    };
    return labels[messageType] ? `${labels[messageType]}（暫不建立案件）` : '非文字 LINE 訊息（暫不建立案件）';
  } catch (error) {
    return text;
  }
}

function normalizeStoredDateTime(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Taipei'
    }).replace(/\//g, '-');
  }
  return text.replace('T', ' ').slice(0, 19);
}

function normalizeLineMessageText(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function renderLinePendingMessages() {
  const tbody = document.getElementById('linePendingBody');
  const empty = document.getElementById('linePendingEmpty');
  setText('linePendingListTitle', getLineImportStatusLabel(lineImportStatusFilter));
  if (!tbody) return;
  const suggestFilter = getLineSuggestFilter();
  const visibleRows = suggestFilter === 'all'
    ? lineImportPendingRows
    : lineImportPendingRows.filter(row => row.suggestion === suggestFilter);
  if (!visibleRows.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = visibleRows.map(row => buildLineImportRow(row)).join('');
}

function buildLineImportRow(row) {
  const messagePreview = row.raw_message.length > 70 ? `${row.raw_message.slice(0, 70)}...` : row.raw_message;
  const actions = [
    `<button class="btn btn-outline btn-sm" onclick="openLineMessageDetail('${escapeHtml(row.id)}')">詳細</button>`,
    (row.status === 'pending' || row.status === 'error') ? `<button class="btn btn-primary btn-sm" onclick="createCaseFromLineMessage('${escapeHtml(row.id)}')">建立案件</button>` : '',
    row.status !== 'archived' ? `<button class="btn btn-outline btn-sm" onclick="updateLinePendingStatus('${escapeHtml(row.id)}','archived')">封存</button>` : ''
  ].filter(Boolean).join(' ');
  return `
    <tr>
      <td>${escapeHtml(row.sender_name)}</td>
      <td>${buildLineCompanyCell(row)}</td>
      <td>${escapeHtml(messagePreview)}</td>
      <td>${buildLineSuggestBadge(row.suggestion)}</td>
      <td>${escapeHtml(row.received_at || '-')}</td>
      <td>${buildLineStatusBadge(row.status)}</td>
      <td>${buildLineWarningBadge(row.duplicate_warning)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

function buildLineStatusBadge(status) {
  const label = LINE_IMPORT_STATUS_LABELS[status] || status || 'Unknown';
  return `<span class="line-status-badge line-status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function getLineImportStatusFilter() {
  const select = document.getElementById('lineStatusFilter');
  return select ? select.value || 'pending' : 'pending';
}

function getLineImportStatusLabel(statusFilter) {
  if (statusFilter === 'all') return '全部';
  return LINE_IMPORT_STATUS_LABELS[statusFilter] || '待分類';
}

function buildLineWarningBadge(warning) {
  const key = warning || 'none';
  const label = LINE_IMPORT_WARNING_LABELS[key] || key;
  const className = key === 'none' ? 'line-warning-none' : 'line-warning-on';
  return `<span class="line-warning-badge ${className}">${escapeHtml(label)}</span>`;
}

function updateLineImportStats() {
  setText('linePendingCount', lineImportPendingRows.filter(row => row.status === 'pending').length);
  setText('lineSuggestCaseCount', lineImportPendingRows.filter(row => row.status === 'pending' && row.suggestion === 'case').length);
  setText('lineUnmappedCount', lineImportPendingRows.filter(row => row.status === 'pending' && row.company_basis === 'none').length);
  setText('lineDuplicateCount', lineImportPendingRows.filter(row => row.duplicate_warning && row.duplicate_warning !== 'none').length);
  setText('lineErrorCount', lineImportPendingRows.filter(row => row.status === 'error').length);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function openLineMessageDetail(id) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!row) return;
  window._currentLineDetailId = id;

  setText('lineDetailTitle', row.sender_name || 'LINE 訊息明細');
  setText('lineDetailMeta', `${row.source || '-'} | ${row.received_at || '-'}`);
  const body = document.getElementById('lineDetailBody');
  if (body) {
    body.innerHTML = `
      <div class="line-detail-grid">
        <div class="di">
          <div class="dl">狀態</div>
          <div class="dv">${escapeHtml(LINE_IMPORT_STATUS_LABELS[row.status] || row.status || '-')}</div>
        </div>
        <div class="di">
          <div class="dl">重複警示</div>
          <div class="dv">${escapeHtml(LINE_IMPORT_WARNING_LABELS[row.duplicate_warning] || row.duplicate_warning || '-')}</div>
        </div>
        <div class="di">
          <div class="dl">發話者</div>
          <div class="dv">${escapeHtml(row.sender_name || '-')}</div>
        </div>
        <div class="di">
          <div class="dl">公司對應</div>
          <div class="dv">${escapeHtml(row.mapped_company || '未設定')}（${escapeHtml(LINE_COMPANY_BASIS_LABELS[row.company_basis] || '-')}）</div>
        </div>
        <div class="di">
          <div class="dl">聯絡人對應</div>
          <div class="dv">${escapeHtml(row.mapped_contact || '未設定')}</div>
        </div>
        <div class="di">
          <div class="dl">進線時間</div>
          <div class="dv">${escapeHtml(row.received_at || '-')}</div>
        </div>
        <div class="di">
          <div class="dl">建議處理</div>
          <div class="dv">${escapeHtml(LINE_SUGGEST_LABELS[row.suggestion] || '-')}</div>
        </div>
        <div class="di">
          <div class="dl">建議分類</div>
          <div class="dv">${escapeHtml(formatLineClassificationSuggestion(row))}</div>
        </div>
      </div>
      <div class="line-import-actions" style="margin-bottom:14px">
        <button class="btn btn-outline btn-sm" onclick="configureLineSenderMapping('${escapeHtml(row.id)}')">設定公司對應</button>
      </div>
      <div class="dst">訊息內容</div>
      <div class="line-detail-message">${escapeHtml(row.raw_message || '-')}</div>
      <div class="dst">搜尋用文字</div>
      <div class="line-detail-message">${escapeHtml(row.normalized_message || '-')}</div>
    `;
  }

  const modal = document.getElementById('lineDetailModal');
  if (modal) modal.classList.add('open');
}

async function updateLinePendingStatus(id, nextStatus) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!row) return;
  const previousStatus = row.status;
  row.status = nextStatus;
  renderLinePendingMessages();
  updateLineImportStats();
  const saved = await persistLinePendingPatch(row.id, { status: nextStatus });
  if (!saved) {
    row.status = previousStatus;
    renderLinePendingMessages();
    updateLineImportStats();
    showLineImportAlert('LINE 訊息狀態未能儲存，請稍後再試。', 'error');
  }
}

async function persistLinePendingPatch(id, patch) {
  if (lineImportStorageMode !== 'remote' || typeof updateLineMessageRecord !== 'function') return true;
  try {
    await updateLineMessageRecord(id, patch);
    return true;
  } catch (error) {
    console.warn('LINE import patch failed:', error);
    return false;
  }
}

const LINE_CLASSIFY_EXCLUDED_SUBCATEGORIES = new Set(['其他', '進度追蹤', '問題進度追蹤', '報修進度追蹤', '資料提供']);

// Short, high-frequency terms that the auto-derived keyword list (below) misses
// because they only appear as part of a longer subcategory phrase (e.g. "發票問題"
// won't substring-match "發票開立有問題"). Kept short on purpose: exact-phrase
// matches from SUBMAP always win ties via lineClassifyKeywordWeight, so these only
// fire when nothing more specific matched.
const LINE_CLASSIFY_EXTRA_KEYWORDS = [
  { category: '平台系統', subcategory: '登入失敗', keyword: '登入' },
  { category: '平台系統', subcategory: '定位異常', keyword: '定位' },
  { category: 'GPS設備', subcategory: 'GPS離線', keyword: 'gps' },
  { category: '帳務問題', subcategory: '發票問題', keyword: '發票' },
  { category: '雷達設備', subcategory: '匯款單據', keyword: '匯款' },
  { category: '平台系統', subcategory: '溫度異常', keyword: '溫度' }
];

let lineClassifyKeywordIndex = null;

function buildLineClassifyKeywordIndex() {
  const index = [];
  Object.keys(SUBMAP || {}).forEach(category => {
    (SUBMAP[category] || []).forEach(subcategory => {
      if (LINE_CLASSIFY_EXCLUDED_SUBCATEGORIES.has(subcategory)) return;
      subcategory.split(/[、,\/]/).map(part => part.trim()).filter(Boolean).forEach(keyword => {
        if (keyword.length < 2) return;
        index.push({ category, subcategory, keyword: keyword.toLowerCase() });
      });
    });
  });
  LINE_CLASSIFY_EXTRA_KEYWORDS.forEach(entry => index.push({ ...entry, keyword: entry.keyword.toLowerCase() }));
  return index;
}

function lineClassifyKeywordWeight(keyword) {
  let weight = 0;
  for (const char of keyword) weight += /[㐀-鿿]/.test(char) ? 2 : 1;
  return weight;
}

function classifyLineMessageText(text) {
  const normalized = normalizeLineMessageText(text);
  if (!normalized) return null;
  if (!lineClassifyKeywordIndex) lineClassifyKeywordIndex = buildLineClassifyKeywordIndex();

  let best = null;
  let bestWeight = 0;
  lineClassifyKeywordIndex.forEach(entry => {
    if (!normalized.includes(entry.keyword)) return;
    const weight = lineClassifyKeywordWeight(entry.keyword);
    if (weight > bestWeight) {
      best = entry;
      bestWeight = weight;
    }
  });
  return best ? { category: best.category, subcategory: best.subcategory, matchedKeyword: best.keyword } : null;
}

function formatLineClassificationSuggestion(row) {
  const suggestion = classifyLineMessageText(`${row.raw_message || ''} ${row.normalized_message || ''}`);
  return suggestion ? `${suggestion.category} / ${suggestion.subcategory}（關鍵字：${suggestion.matchedKeyword}）` : '未判斷，請人工選擇 V2 分類';
}

function applyLineClassificationSuggestion(row) {
  const suggestion = classifyLineMessageText(`${row.raw_message || ''} ${row.normalized_message || ''}`);

  const categoryInput = document.getElementById('fCategory');
  if (categoryInput) categoryInput.value = suggestion ? suggestion.category : '平台系統';
  if (typeof updateSub === 'function') updateSub();

  if (suggestion) {
    const subcategoryInput = document.getElementById('fSubcategory');
    if (subcategoryInput) subcategoryInput.value = suggestion.subcategory;
    if (typeof toggleSubcategoryNote === 'function') toggleSubcategoryNote();
  }

  return suggestion;
}

function createCaseFromLineMessage(id) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!row) return;
  if (typeof openNewForm === 'function') openNewForm();

  const dateInput = document.getElementById('fDate');
  if (dateInput && row.received_at) dateInput.value = toFormDateTimeValue(row.received_at);

  const channelInput = document.getElementById('fChannel');
  if (channelInput) channelInput.value = '官方LINE';

  const companyInput = document.getElementById('fCompany');
  const companyName = inferLineCompanyName(row);
  if (companyInput && companyName) {
    companyInput.value = companyName;
    if (typeof handleCompanyChange === 'function') handleCompanyChange();
  }

  const plateInput = document.getElementById('fPlate');
  if (plateInput) plateInput.value = extractLinePlate(row.raw_message || '');

  const suggestion = applyLineClassificationSuggestion(row);

  const statusInput = document.getElementById('fStatus');
  if (statusInput) statusInput.value = '客服處理中';

  const descriptionInput = document.getElementById('fDescription');
  if (descriptionInput) descriptionInput.value = buildLineCaseDescription(row);

  window._lineImportContext = { lineMessageId: row.id };

  showLineImportAlert(
    suggestion
      ? `已依關鍵字「${suggestion.matchedKeyword}」自動帶入分類「${suggestion.category} / ${suggestion.subcategory}」，請確認是否正確。`
      : '無法自動判斷分類，請完整選擇並人工確認 V2 分類。',
    'info'
  );
}

function createChildCaseFromLineMessage(id) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!row) return;
  if (!Array.isArray(records) || !records.length) {
    alert('目前沒有案件資料，請先回到案件列表重新整理。');
    return;
  }

  const parentId = prompt('請輸入母案編號，例如 20260608-001', '');
  if (parentId === null) return;
  const normalizedParentId = parentId.trim();
  const parent = records.find(record => record.id === normalizedParentId);
  if (!parent) {
    alert(`找不到母案：${normalizedParentId}`);
    return;
  }

  const childId = buildNextChildCaseId(parent.id);
  if (typeof openNewForm === 'function') openNewForm();
  closeLineMessageDetail();

  const title = document.getElementById('formTitle');
  if (title) title.textContent = `建立子案（母案：${parent.id}）`;

  const dateInput = document.getElementById('fDate');
  if (dateInput && row.received_at) dateInput.value = toFormDateTimeValue(row.received_at);

  setLineFormValue('fChannel', '官方LINE');
  fillLineChildCompany(parent.company || row.mapped_company || '');
  setLineFormValue('fPlate', parent.plate || '');
  setLineFormValue('fProduct', parent.product || '');
  setLineFormValue('fCategory', parent.category || '平台系統');
  if (typeof updateSub === 'function') updateSub();
  setLineFormValue('fSubcategory', parent.subcategory || '');
  initializeV2Form(parent);
  setPreservedSelect('fTrackingType','維修進度追蹤');
  setLineFormValue('fStatus', '客服處理中');
  setLineFormValue('fHandler', '');
  setLineFormValue('fDispatchDate', '');
  setLineFormValue('fWarranty', parent.warranty || '');
  setLineFormValue('fInvoice', '');
  setLineFormValue('fCloseDate', '');
  setLineFormChecked('fSurveySent', false);
  setLineFormChecked('fSurveyReplied', false);
  setLineFormValue('fDescription', buildLineChildCaseDescription(parent, row));
  setLineFormValue('fResult', '');

  window._customId = childId;
  window._lineImportContext = { lineMessageId: row.id };
  showLineImportAlert(`已準備建立子案 ${childId}，請確認內容後按儲存。`, 'success');
}

function buildLineCaseDescription(row) {
  return [
    `LINE 客戶：${row.sender_name || '-'}`,
    row.mapped_company ? `公司對應：${row.mapped_company}` : '',
    row.mapped_contact ? `聯絡人：${row.mapped_contact}` : '',
    row.received_at ? `進線時間：${row.received_at}` : '',
    '',
    '【LINE 訊息】',
    row.raw_message || ''
  ].filter(Boolean).join('\n');
}

function buildLineChildCaseDescription(parent, row) {
  return [
    `【衍生自 ${parent.id}】`,
    parent.subcategory ? `母案問題：${parent.subcategory}` : '',
    row.sender_name ? `LINE 客戶：${row.sender_name}` : '',
    row.mapped_contact ? `聯絡人：${row.mapped_contact}` : '',
    row.received_at ? `進線時間：${row.received_at}` : '',
    '',
    '【本次 LINE 訊息】',
    row.raw_message || ''
  ].filter(Boolean).join('\n');
}

function buildNextChildCaseId(parentId) {
  const baseId = String(parentId || '').split('-').slice(0, 2).join('-');
  const existingChildren = records.filter(record => record.id && record.id.startsWith(`${baseId}-`) && record.id !== baseId);
  const maxSub = existingChildren.reduce((max, record) => {
    const parts = String(record.id || '').split('-');
    const value = parts.length === 3 ? parseInt(parts[2], 10) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  return `${baseId}-${String(maxSub + 1).padStart(2, '0')}`;
}

function getLineChildSubcategory(parent) {
  const select = document.getElementById('fSubcategory');
  if (!select) return parent.subcategory || '';
  const progressOption = Array.from(select.options || []).find(option => option.value === '進度追蹤');
  return progressOption ? '進度追蹤' : (parent.subcategory || '');
}

function fillLineChildCompany(company) {
  if (typeof fillCompanyField === 'function') {
    fillCompanyField(company || '');
    return;
  }
  setLineFormValue('fCompany', company || '');
}

function setLineFormValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || '';
}

function setLineFormChecked(id, value) {
  const element = document.getElementById(id);
  if (element) element.checked = !!value;
}

function inferLineCompanyName(row) {
  if (row.mapped_company) return row.mapped_company;
  const companyInput = document.getElementById('fCompany');
  if (!companyInput) return '';
  const candidates = Array.from(companyInput.options || [])
    .map(option => option.value || option.textContent || '')
    .filter(value => value && value !== '__new__' && !value.startsWith('--'));
  const searchText = normalizeLineCompanyText([
    row.sender_name,
    row.raw_message,
    row.normalized_message
  ].filter(Boolean).join(' '));
  return candidates.find(company => searchText.includes(normalizeLineCompanyText(company))) || '';
}

function normalizeLineCompanyText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\-－_＿]/g, '');
}

function getLineSenderMappings() {
  try {
    return JSON.parse(localStorage.getItem(LINE_SENDER_MAPPING_STORAGE_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

function getLineSenderMapping(senderId) {
  if (!senderId) return null;
  const mappings = getLineSenderMappings();
  return mappings[senderId] || null;
}

function saveLineSenderMapping(senderId, mapping) {
  if (!senderId) return;
  const mappings = getLineSenderMappings();
  mappings[senderId] = {
    company: String(mapping.company || '').trim(),
    contact: String(mapping.contact || '').trim(),
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(LINE_SENDER_MAPPING_STORAGE_KEY, JSON.stringify(mappings));
}

function formatLineMappedSenderName(mapping, fallbackName) {
  const parts = [mapping.company, mapping.contact].filter(Boolean);
  return parts.length ? parts.join(' ') : fallbackName;
}

async function configureLineSenderMapping(id) {
  const row = lineImportPendingRows.find(item => item.id === id);
  if (!row) return;
  if (!row.sender_id && !row.group_id) {
    alert('這筆 LINE 訊息沒有發話者或群組 ID，無法建立固定對應。');
    return;
  }
  const company = prompt('請輸入公司名稱（需與案件公司下拉選單一致）', row.mapped_company || inferLineCompanyName(row) || '');
  if (company === null) return;
  const trimmedCompany = company.trim();
  if (!trimmedCompany) return;
  const contact = prompt('請輸入聯絡人名稱（可留空）', row.mapped_contact || '');
  if (contact === null) return;

  // 有群組 ID 時預設對應整個群組：群組裡也有奇雲同仁，用人對公司容易錯
  const useGroup = !!row.group_id && confirm(`要把整個群組「${row.group_name || row.group_id}」都對應到「${trimmedCompany}」嗎？\n按「取消」則只對應這位發話者。`);
  const key = useGroup ? row.group_id : row.sender_id;
  if (!key) {
    alert('這筆訊息沒有發話者 ID，請改用群組對應。');
    return;
  }

  if (row.sender_id) saveLineSenderMapping(row.sender_id, { company: trimmedCompany, contact });
  const saved = await saveLineSenderCompanyRemote(key, useGroup ? 'group' : 'user', trimmedCompany,
    useGroup ? `群組：${row.group_name || ''}` : `發話者：${row.original_sender_name || ''}`);

  lineImportPendingRows = lineImportPendingRows.map(item => {
    const original = { ...item };
    const info = resolveLineCompany({
      senderId: item.sender_id,
      groupId: item.group_id,
      rawMessage: item.original_raw_message,
      localMapping: getLineSenderMapping(item.sender_id)
    });
    return { ...original, mapped_company: info.company, company_basis: info.basis, company_note: info.note,
      mapped_contact: item.sender_id === row.sender_id ? contact.trim() : item.mapped_contact };
  });
  renderLinePendingMessages();
  updateLineImportStats();
  openLineMessageDetail(id);
  showLineImportAlert(saved
    ? `已儲存公司對應「${trimmedCompany}」，之後${useGroup ? '這個群組' : '這位發話者'}的訊息會自動帶出公司。`
    : '公司對應只存在這台電腦（雲端儲存失敗），請稍後再試一次。', saved ? 'success' : 'error');
}

// ===== 公司對應（Supabase line_sender_company） =====
async function loadLineSenderCompanyMap(force = false) {
  if (lineSenderCompanyLoaded && !force) return lineSenderCompanyMap;
  if (typeof sbFetch !== 'function') return lineSenderCompanyMap;
  try {
    const rows = await sbFetch('line_sender_company?select=sender_id,company,status,key_type,note&limit=5000');
    const map = {};
    (Array.isArray(rows) ? rows : []).forEach(item => {
      if (item && item.sender_id) map[item.sender_id] = item;
    });
    lineSenderCompanyMap = map;
    lineSenderCompanyLoaded = true;
  } catch (error) {
    console.warn('line_sender_company load failed:', error);
  }
  return lineSenderCompanyMap;
}

async function saveLineSenderCompanyRemote(key, keyType, company, note) {
  if (typeof sbFetch !== 'function') return false;
  const payload = {
    sender_id: key,
    key_type: keyType,
    company,
    status: 'confirmed',
    source: 'manual',
    note,
    updated_at: new Date().toISOString()
  };
  try {
    await sbFetch('line_sender_company?on_conflict=sender_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });
    lineSenderCompanyMap[key] = payload;
    if (typeof logActivity === 'function') {
      await logActivity(null, 'LINE公司對應', `${keyType === 'group' ? '群組' : '發話者'} ${key} → ${company}`);
    }
    return true;
  } catch (error) {
    console.warn('line_sender_company save failed:', error);
    return false;
  }
}

function normalizeLinePlateKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

let linePlateCompanyCache = { size: -1, map: null };
function getLinePlateCompanyMap() {
  const list = typeof records !== 'undefined' && Array.isArray(records) ? records : [];
  if (linePlateCompanyCache.map && linePlateCompanyCache.size === list.length) return linePlateCompanyCache.map;
  const map = new Map();
  list.forEach(record => {
    const key = normalizeLinePlateKey(record && record.plate);
    if (key.length >= 5 && record.company && !map.has(key)) map.set(key, record.company);
  });
  linePlateCompanyCache = { size: list.length, map };
  return map;
}

function findLineCompanyByPlate(rawMessage) {
  const text = normalizeLinePlateKey(rawMessage);
  if (text.length < 5) return null;
  for (const [plate, company] of getLinePlateCompanyMap()) {
    if (text.includes(plate)) return { company, plate };
  }
  return null;
}

// 判斷順序：群組 → 發話者 → 本機舊對應 → 車號反查 → 待歸戶
function resolveLineCompany({ senderId, groupId, rawMessage, localMapping }) {
  const groupHit = groupId ? lineSenderCompanyMap[groupId] : null;
  if (groupHit && groupHit.company) return { company: groupHit.company, basis: 'group', note: groupHit.note || '' };
  const senderHit = senderId ? lineSenderCompanyMap[senderId] : null;
  if (senderHit && senderHit.company) {
    return { company: senderHit.company, basis: senderHit.status === 'conflict' ? 'conflict' : 'sender', note: senderHit.note || '' };
  }
  if (localMapping && localMapping.company) return { company: localMapping.company, basis: 'local', note: '' };
  const plateHit = findLineCompanyByPlate(rawMessage);
  if (plateHit) return { company: plateHit.company, basis: 'plate', note: `車號 ${plateHit.plate}` };
  return { company: '', basis: 'none', note: '' };
}

function buildLineCompanyCell(row) {
  if (!row.mapped_company) return '<span class="line-warning-badge line-warning-on">待歸戶</span>';
  const basis = LINE_COMPANY_BASIS_LABELS[row.company_basis] || '';
  const needsCheck = row.company_basis === 'conflict' || row.company_basis === 'plate';
  return `${escapeHtml(row.mapped_company)}${needsCheck ? ` <span class="line-warning-badge line-warning-on">${escapeHtml(basis)}</span>` : ''}`;
}

// ===== 建議處理（建議建案／建議封存／待看） =====
const LINE_COURTESY_PATTERN = /^(好的?|好喔|好唷|好滴|ok|okay|有?收到了?|謝謝|感謝|謝啦|辛苦了?|了解|瞭解|沒問題|不客氣|麻煩了?|再麻煩|早安|午安|晚安|你好|您好|嗯+|喔+|哦+|對|是的?|讚|👍|🙏|[!！。.~～、，,\s])+$/i;
const LINE_ROUTINE_LOG_PATTERN = /^@?[^\d]{0,12}\d{3,4}(開始|結束)(丟|清運|作業|進場|倒)?[^\d]{0,8}$/;
const LINE_CASE_KEYWORDS = /(故障|異常|不能|無法|沒有?(訊號|定位|畫面|資料|溫度|回傳|上傳)|壞|離線|斷線|不動|不亮|黑屏|藍屏|報修|維修|叫修|拆機|拆除|安裝|新裝|移機|換車|定位|鏡頭|主機|溫度|GPS|行車|影像|畫面|登入|帳號|密碼|發票|報價|雷達|監控|數據|冷凍|冷藏|顯示器|螢幕)/i;

function suggestLineIntake(rawMessage) {
  const text = String(rawMessage || '').trim();
  if (!text) return 'review';
  if (text.startsWith('{')) return 'review'; // 圖片／貼圖等非文字訊息：可能是報修照片，先待看
  const compact = text.replace(/\s+/g, '');
  if (compact.length <= 20 && LINE_COURTESY_PATTERN.test(compact)) return 'archive';
  if (LINE_ROUTINE_LOG_PATTERN.test(compact)) return 'archive'; // 例：1400開始丟回收物、1130結束（利澤等現場作業回報）
  if (extractLinePlate(text) || findLineCompanyByPlate(text)) return 'case';
  if (LINE_CASE_KEYWORDS.test(text) || classifyLineMessageText(text)) return 'case';
  return 'review';
}

function buildLineSuggestBadge(suggestion) {
  const label = LINE_SUGGEST_LABELS[suggestion] || '-';
  const color = suggestion === 'case' ? 'line-status-pending' : suggestion === 'archive' ? 'line-status-archived' : 'line-status-classified';
  return `<span class="line-status-badge ${color}">${escapeHtml(label)}</span>`;
}

function getLineSuggestFilter() {
  const select = document.getElementById('lineSuggestFilter');
  return select ? select.value || 'all' : 'all';
}

async function archiveSuggestedLineMessages() {
  const targets = lineImportPendingRows.filter(row => row.status === 'pending' && row.suggestion === 'archive');
  if (!targets.length) {
    showLineImportAlert('目前沒有「建議封存」的待分類訊息。', 'info');
    return;
  }
  if (!confirm(`要把 ${targets.length} 筆「建議封存」的訊息一次封存嗎？（之後可在「已封存」找回）`)) return;
  setLineImportLoading(true, '封存中...');
  try {
    const ids = targets.map(row => row.id);
    if (lineImportStorageMode === 'remote' && typeof sbFetch === 'function') {
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
        await sbFetch(`line_messages?id=in.(${chunk})`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
      }
      if (typeof logActivity === 'function') await logActivity(null, 'LINE批次封存', `建議封存 ${ids.length} 筆`);
    }
    targets.forEach(row => { row.status = 'archived'; });
    if (lineImportStatusFilter === 'pending') {
      lineImportPendingRows = lineImportPendingRows.filter(row => row.status === 'pending');
    }
    renderLinePendingMessages();
    updateLineImportStats();
    showLineImportAlert(`已封存 ${ids.length} 筆客套話訊息。`, 'success');
  } catch (error) {
    showLineImportAlert(`批次封存失敗：${error.message || error}`, 'error');
  } finally {
    setLineImportLoading(false);
  }
}

function applyLineSenderMappingToRows(senderId) {
  const mapping = getLineSenderMapping(senderId);
  if (!mapping) return;
  lineImportPendingRows.forEach(row => {
    if (row.sender_id !== senderId) return;
    row.mapped_company = mapping.company || '';
    row.mapped_contact = mapping.contact || '';
    row.sender_name = formatLineMappedSenderName(mapping, row.original_sender_name || row.sender_name);
  });
}

async function handleLineCaseCreated(caseId) {
  const lineMessageId = window._lineImportContext?.lineMessageId;
  if (!lineMessageId) return;
  const row = lineImportPendingRows.find(item => item.id === lineMessageId);
  if (!row) return;
  const previousStatus = row.status;
  const previousCaseId = row.case_id;
  row.case_id = caseId;
  row.status = 'linked';
  const saved = await persistLinePendingPatch(row.id, { case_id: caseId, status: 'linked' });
  if (!saved) {
    row.case_id = previousCaseId;
    row.status = previousStatus;
    showLineImportAlert(`案件 ${caseId} 已建立，但 LINE 待分類狀態未能儲存。`, 'error');
    return;
  }
  renderLinePendingMessages();
  updateLineImportStats();
  showLineImportAlert(`已將 LINE 訊息連結到案件 ${caseId}。`, 'success');
  window._lineImportContext = null;
}

function toFormDateTimeValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.includes('T')) return text.slice(0, 19);
  return text.replace(' ', 'T').slice(0, 19);
}

function extractLinePlate(message) {
  const match = String(message || '').match(/\b([A-Z0-9]{2,4}[-\s][A-Z0-9]{2,4})\b/i);
  return match ? match[1].toUpperCase().replace(/\s+/g, '-') : '';
}

function closeLineMessageDetail() {
  const modal = document.getElementById('lineDetailModal');
  if (modal) modal.classList.remove('open');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
