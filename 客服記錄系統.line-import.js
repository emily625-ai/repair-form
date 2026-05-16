const LINE_IMPORT_STATUS_LABELS = {
  pending: 'Pending',
  classified: 'Classified',
  linked: 'Linked',
  archived: 'Archived',
  error: 'Needs review'
};

const LINE_IMPORT_WARNING_LABELS = {
  none: '-',
  duplicate: 'Duplicate',
  hash_missing: 'Check required',
  possible_duplicate: 'Possible duplicate'
};

let lineImportPreviewRows = [];

const lineImportPendingRows = [
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

function renderLineImport() {
  setupLineImportDropZone();
  renderLineImportPreview();
  renderLinePendingMessages();
  updateLineImportStats();
}

function setupLineImportDropZone() {
  const dropZone = document.getElementById('lineDropZone');
  if (!dropZone || dropZone.dataset.bound === '1') return;

  dropZone.dataset.bound = '1';
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    handleLineCsvFile(event.dataTransfer.files[0]);
  });
}

function setLineImportLoading(isLoading) {
  const loading = document.getElementById('lineImportLoading');
  if (loading) loading.style.display = isLoading ? 'flex' : 'none';
}

function showLineImportAlert(message, type = 'info') {
  const alert = document.getElementById('lineImportAlert');
  if (!alert) return;

  alert.textContent = message || '';
  alert.dataset.type = type;
  alert.style.display = message ? 'block' : 'none';
}

function handleLineCsvFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showLineImportAlert('Please upload a CSV file.', 'error');
    return;
  }

  setLineImportLoading(true);
  const reader = new FileReader();
  reader.onload = event => {
    try {
      lineImportPreviewRows = parseLineImportCsv(event.target.result);
      renderLineImportPreview();
      updateLineImportStats();
      showLineImportAlert(`Preview loaded: ${lineImportPreviewRows.length} row(s). Mock only, not saved.`, 'success');
    } catch (error) {
      showLineImportAlert(error.message || 'CSV parse failed.', 'error');
    } finally {
      setLineImportLoading(false);
    }
  };
  reader.onerror = () => {
    setLineImportLoading(false);
    showLineImportAlert('Unable to read this file.', 'error');
  };
  reader.readAsText(file, 'utf-8');
}

function parseLineImportCsv(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');

  const headers = parseCsvLine(lines[0]).map(header => header.trim().toLowerCase());
  const requiredHeaders = ['received_at', 'sender_name', 'message'];
  const missing = requiredHeaders.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const rawRow = {};
    headers.forEach((header, headerIndex) => {
      rawRow[header] = values[headerIndex] || '';
    });
    return normalizeLineImportRow(rawRow, index);
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(value => value.trim());
}

function normalizeLineImportRow(row, index) {
  const rawMessage = row.message || row.raw_message || '';
  const senderName = row.sender_name || row.sender || 'Unknown';
  const senderId = row.sender_id || '';
  const receivedAt = row.received_at || row.time || '';
  const normalizedMessage = normalizeLineMessageText(rawMessage);
  const duplicateHash = buildLineDuplicateHash(senderId || senderName, receivedAt, normalizedMessage);

  return {
    id: `preview-${index + 1}`,
    source: row.source || 'csv',
    sender_name: senderName,
    sender_id: senderId,
    raw_message: rawMessage,
    normalized_message: normalizedMessage,
    received_at: receivedAt,
    status: 'pending',
    case_id: '',
    duplicate_hash: duplicateHash,
    duplicate_warning: getLineDuplicateWarning(senderId, receivedAt, normalizedMessage)
  };
}

function normalizeLineMessageText(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildLineDuplicateHash(sender, receivedAt, normalizedMessage) {
  if (!sender || !receivedAt || !normalizedMessage) return '';
  return `${sender}|${receivedAt}|${normalizedMessage}`;
}

function getLineDuplicateWarning(senderId, receivedAt, normalizedMessage) {
  if (!receivedAt || !normalizedMessage) return 'hash_missing';
  if (!senderId) return 'possible_duplicate';
  return 'none';
}

function loadLineMockCsv() {
  lineImportPreviewRows = [
    normalizeLineImportRow({
      source: 'csv',
      sender_name: 'Demo customer',
      sender_id: 'demo-u001',
      received_at: '2026-05-16 13:20:00',
      message: 'Invoice cannot be issued. Please help check vehicle ABCD-1234.'
    }, 0),
    normalizeLineImportRow({
      source: 'csv',
      sender_name: 'Demo customer',
      sender_id: 'demo-u001',
      received_at: '2026-05-16 13:20:00',
      message: 'Invoice cannot be issued. Please help check vehicle ABCD-1234.'
    }, 1)
  ];
  lineImportPreviewRows[1].duplicate_warning = 'duplicate';
  renderLineImportPreview();
  updateLineImportStats();
  showLineImportAlert('Mock CSV preview loaded. Nothing has been saved.', 'success');
}

function clearLinePreview() {
  lineImportPreviewRows = [];
  const input = document.getElementById('lineCsvInput');
  if (input) input.value = '';
  renderLineImportPreview();
  updateLineImportStats();
  showLineImportAlert('', 'info');
}

function parseManualLineMessages() {
  const textarea = document.getElementById('lineManualPaste');
  const text = textarea ? textarea.value : '';
  const rows = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((message, index) => normalizeLineImportRow({
      source: 'manual_paste',
      sender_name: 'Manual paste',
      sender_id: '',
      received_at: '',
      message
    }, index));

  lineImportPreviewRows = rows;
  renderLineImportPreview();
  updateLineImportStats();
  showLineImportAlert(`Manual paste preview loaded: ${rows.length} row(s).`, rows.length ? 'success' : 'info');
}

function mockImportLinePreview() {
  if (!lineImportPreviewRows.length) {
    showLineImportAlert('No preview rows to import.', 'error');
    return;
  }
  showLineImportAlert('Mock import completed. DB write is intentionally disabled for MVP.', 'success');
}

function renderLineImportPreview() {
  const tbody = document.getElementById('linePreviewBody');
  if (!tbody) return;

  if (!lineImportPreviewRows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No preview rows yet.</td></tr>';
    return;
  }

  tbody.innerHTML = lineImportPreviewRows.map(row => buildLineImportRow(row, 'preview')).join('');
}

function renderLinePendingMessages() {
  const tbody = document.getElementById('linePendingBody');
  if (!tbody) return;
  tbody.innerHTML = lineImportPendingRows.map(row => buildLineImportRow(row, 'pending')).join('');
}

function buildLineImportRow(row, sourceName) {
  const messagePreview = row.raw_message.length > 70 ? `${row.raw_message.slice(0, 70)}...` : row.raw_message;
  return `
    <tr>
      <td>${escapeHtml(row.sender_name)}</td>
      <td>${escapeHtml(messagePreview)}</td>
      <td>${escapeHtml(row.received_at || '-')}</td>
      <td>${buildLineStatusBadge(row.status)}</td>
      <td>${buildLineWarningBadge(row.duplicate_warning)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openLineMessageDetail('${escapeHtml(row.id)}','${sourceName}')">Detail</button></td>
    </tr>
  `;
}

function buildLineStatusBadge(status) {
  const label = LINE_IMPORT_STATUS_LABELS[status] || status || 'Unknown';
  return `<span class="line-status-badge line-status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function buildLineWarningBadge(warning) {
  const key = warning || 'none';
  const label = LINE_IMPORT_WARNING_LABELS[key] || key;
  const className = key === 'none' ? 'line-warning-none' : 'line-warning-on';
  return `<span class="line-warning-badge ${className}">${escapeHtml(label)}</span>`;
}

function updateLineImportStats() {
  setText('linePendingCount', lineImportPendingRows.filter(row => row.status === 'pending').length);
  setText('linePreviewCount', lineImportPreviewRows.length);
  setText('lineDuplicateCount', lineImportPreviewRows.filter(row => row.duplicate_warning && row.duplicate_warning !== 'none').length);
  setText('lineErrorCount', lineImportPendingRows.filter(row => row.status === 'error').length);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function openLineMessageDetail(id, sourceName) {
  const rows = sourceName === 'preview' ? lineImportPreviewRows : lineImportPendingRows;
  const row = rows.find(item => item.id === id);
  if (!row) return;

  setText('lineDetailTitle', row.sender_name || 'Message detail');
  setText('lineDetailMeta', `${row.source || '-'} | ${row.received_at || '-'}`);
  setText('lineDetailRaw', row.raw_message || '-');
  setText('lineDetailNormalized', row.normalized_message || '-');
  setText('lineDetailStatus', LINE_IMPORT_STATUS_LABELS[row.status] || row.status || '-');
  setText('lineDetailDuplicate', LINE_IMPORT_WARNING_LABELS[row.duplicate_warning] || row.duplicate_warning || '-');

  const modal = document.getElementById('lineDetailModal');
  if (modal) modal.classList.add('show');
}

function closeLineMessageDetail() {
  const modal = document.getElementById('lineDetailModal');
  if (modal) modal.classList.remove('show');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
