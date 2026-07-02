/*
  Usage:
  1. Open https://chat.line.biz/account/@your-account in Chrome and sign in.
  2. Open DevTools Console on the chat list page.
  3. Paste this entire script and press Enter.
  4. Go back to repair-form and click "從 LINE 後台抓取聊天室清單".

  Result:
  - Captures the currently visible chat list rows.
  - Copies a JSON payload to clipboard with prefix LINE_CAPTURE_PAYLOAD::.
*/

(async () => {
  const PAYLOAD_PREFIX = 'LINE_CAPTURE_PAYLOAD::';

  function textOf(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function pickFirstText(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = textOf(node);
      if (value) return value;
    }
    return '';
  }

  function visibleElements(selector) {
    return Array.from(document.querySelectorAll(selector)).filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function guessChatRows() {
    const selectorGroups = [
      '[role="listitem"]',
      '[data-testid*="chat"]',
      '[class*="chat"][class*="item"]',
      '[class*="Chat"][class*="Item"]',
      'a[href*="/account/"]',
      'button'
    ];

    for (const selector of selectorGroups) {
      const nodes = visibleElements(selector);
      const rows = nodes.filter(node => {
        const href = node.getAttribute?.('href') || node.closest?.('a')?.getAttribute?.('href') || '';
        const text = textOf(node);
        return text && (href.includes('/account/') || text.length >= 6);
      });
      if (rows.length >= 3) return rows;
    }

    return [];
  }

  function extractChatId(row) {
    const hrefNode = row.closest?.('a[href]') || row.querySelector?.('a[href]');
    const href = hrefNode?.getAttribute?.('href') || '';
    const match = href.match(/\/account\/([^/?#]+)(?:\/chat\/([^/?#]+))?/i);
    if (match?.[2]) return match[2];
    if (row.dataset?.chatId) return row.dataset.chatId;
    if (row.getAttribute?.('data-chat-id')) return row.getAttribute('data-chat-id');
    return '';
  }

  function extractRow(row, index) {
    const senderName = pickFirstText(row, [
      '[class*="name"]',
      '[class*="Name"]',
      '[data-testid*="name"]',
      'strong',
      'h3',
      'h4'
    ]);

    const timeText = pickFirstText(row, [
      'time',
      '[class*="time"]',
      '[class*="Time"]',
      '[data-testid*="time"]'
    ]);

    const previewText = pickFirstText(row, [
      '[class*="message"]',
      '[class*="preview"]',
      '[class*="Preview"]',
      '[data-testid*="message"]',
      'p',
      'span'
    ]);

    const lineChatId = extractChatId(row);
    return {
      index: index + 1,
      sender_name: senderName || `LINE Chat ${index + 1}`,
      raw_message: previewText,
      received_at_text: timeText,
      line_chat_id: lineChatId,
      capture_page_url: location.href
    };
  }

  const candidateRows = guessChatRows();
  if (!candidateRows.length) {
    throw new Error('Could not find visible LINE chat rows on this page.');
  }

  const rows = candidateRows
    .map(extractRow)
    .filter(row => row.sender_name && row.raw_message);

  if (!rows.length) {
    throw new Error('Visible rows were found, but no valid sender/message pairs could be extracted.');
  }

  const payload = {
    source: 'line_oa_console_capture',
    captured_at: new Date().toISOString(),
    page_url: location.href,
    row_count: rows.length,
    rows
  };

  const payloadText = PAYLOAD_PREFIX + JSON.stringify(payload);
  await navigator.clipboard.writeText(payloadText);
  console.log(`Copied ${rows.length} LINE chat rows to clipboard.`);
  console.table(rows);
})();
