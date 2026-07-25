function getFilterState(){
  return {
    query:document.getElementById('searchInput').value.toLowerCase(),
    status:document.getElementById('filterStatus').value,
    category:document.getElementById('filterCategory').value,
    warranty:document.getElementById('filterWarranty').value,
    invoice:invoiceOnly,
    handler:document.getElementById('filterHandler').value,
    channel:document.getElementById('filterChannel').value,
    dateFrom:document.getElementById('filterDateFrom').value,
    dateTo:document.getElementById('filterDateTo').value,
    overdueOnly:showOverdue,
    surveyTodoMode,
  };
}

function matchesWarrantyFilter(record, warranty){
  if(!warranty) return true;
  return (record.warranty||'')===warranty;
}

function buildSearchHaystack(record){
  return [
    record.id,
    record.company,
    record.plate,
    record.category,
    record.subcategory,
    record.subcategoryNote,
    record.description,
    record.handler,
    record.result,
    record.channel
  ].join(' ').toLowerCase();
}

function recordMatchesFilters(record, state){
  if(state.status && record.status!==state.status) return false;
  if(state.category && record.category!==state.category) return false;
  if(!matchesWarrantyFilter(record, state.warranty)) return false;
  if(state.invoice && (record.invoice||'')!==state.invoice) return false;
  if(state.handler && record.handler!==state.handler) return false;
  if(state.channel && record.channel!==state.channel) return false;
  const caseDateOnly=getDateOnlyText(record.date);
  if(state.dateFrom && caseDateOnly && caseDateOnly<state.dateFrom) return false;
  if(state.dateTo && caseDateOnly && caseDateOnly>state.dateTo) return false;
  if(state.overdueOnly && !isDispatchOverdue(record)) return false;
  if(state.surveyTodoMode==='closed-unsent' && !(record.status==='結案' && !record.surveySent)) return false;
  if(state.surveyTodoMode==='sent-unreplied' && !(record.surveySent && !record.surveyReplied)) return false;
  if(state.query && !buildSearchHaystack(record).includes(state.query)) return false;
  return true;
}

function applyFilters(){
  const filterState=getFilterState();
  filtered=records.filter(record=>recordMatchesFilters(record, filterState));
  page=1;
  document.getElementById('filterResultInfo').textContent=
    filtered.length!==records.length ? `篩選結果：${filtered.length} 筆` : '';
  renderTable();
}

function clearFilters(){
  ['searchInput'].forEach(id=>document.getElementById(id).value='');
  ['filterStatus','filterCategory','filterWarranty','filterHandler','filterChannel'].forEach(id=>document.getElementById(id).value='');
  ['filterDateFrom','filterDateTo'].forEach(id=>document.getElementById(id).value='');
  showOverdue=false;
  invoiceOnly='';
  surveyTodoMode='';
  const overdueBtn=document.getElementById('overdueBtn');
  if(overdueBtn) overdueBtn.classList.remove('active');
  document.getElementById('filterResultInfo').textContent='';
  applyFilters();
}

function fdt(dt){
  if(!dt) return '—';
  const d=toDateValue(dt);
  if(!d) return dt;
  return d.toLocaleString('zh-TW',{
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hour12:false
  }).replace(/\//g,'-');
}

function calcDur(s,e){
  if(!s||!e) return null;
  const start=toDateValue(s);
  const end=toDateValue(e);
  if(!start || !end) return null;
  const ms=end-start;
  if(ms<=0) return null;
  const h=Math.floor(ms/3600000);
  const m=Math.floor((ms%3600000)/60000);
  if(h>=24){
    const d=Math.floor(h/24);
    const rh=h%24;
    return rh>0 ? `${d}天${rh}小時` : `${d}天`;
  }
  return h>0 ? `${h}小時${m}分` : `${m}分`;
}

function hl(t,q){
  // Delegate to highlightText so all main-table cells are HTML-escaped.
  // The previous inline version returned raw text (unescaped) when there was
  // no search query, which allowed stored HTML in company/plate/handler to run.
  return highlightText(t,q);
}

function getDurationBadge(record){
  const duration=calcDur(record.date,record.closeDate);
  if(duration){
    const color=duration.includes('天') && parseInt(duration,10)>7 ? 'var(--orange)' : 'var(--green)';
    return `<span style="font-size:15px;color:${color};font-weight:600">${duration}</span>`;
  }
  if(isClosedStatus(record.status)) return '<span style="font-size:14px;color:var(--text3)">—</span>';
  return '<span style="font-size:14px;color:var(--text3)">進行中</span>';
}

function getWarrantyBadge(record){
  return record.warranty
    ? `<span class="badge badge-${record.warranty}">${record.warranty}</span>`
    : '<span style="color:var(--text3);font-size:14px">—</span>';
}

function getInvoiceBadge(record){
  if(!record.invoice) return '<span style="color:var(--text3);font-size:14px">—</span>';
  const background=record.invoice==='待開立'
    ? 'rgba(248,113,113,.15)'
    : record.invoice==='已開立'
      ? 'rgba(52,211,153,.15)'
      : 'rgba(100,116,139,.15)';
  const color=record.invoice==='待開立'
    ? 'var(--red)'
    : record.invoice==='已開立'
      ? 'var(--green)'
      : 'var(--text3)';
  return `<span class="badge" style="background:${background};color:${color}">${record.invoice}</span>`;
}

function getRowVisualMeta(record){
  const visualState=getCaseVisualState(record);
  if(visualState==='overdue'){
    return {
      rowClass:'overdue-row',
      statusNote:'<span style="font-size:12px;color:var(--orange);margin-left:4px">已逾期</span>'
    };
  }
  if(visualState==='warning'){
    return {
      rowClass:'warning-row',
      statusNote:'<span style="font-size:12px;color:var(--yellow);margin-left:4px">快逾期</span>'
    };
  }
  return {rowClass:'',statusNote:''};
}

function showCompanyHistoryFromRow(recordIndex){
  const record=filtered[recordIndex];
  if(record) showCompanyHistory(record.company);
}

function searchByPlateFromEl(element){
  searchByPlate(element.getAttribute('data-plate')||'');
}

function getSubcategoryDisplay(record){
  if((record.category==='其他' || record.subcategory==='其他') && record.subcategoryNote){
    return `${record.subcategory||'其他'}：${record.subcategoryNote}`;
  }
  return record.subcategory||'';
}

function renderStatusDropdown(recordIndex, record){
  return `<div class="status-dropdown" style="position:relative;display:inline-block">
    <span class="badge badge-${record.status}" style="cursor:pointer" onclick="toggleStatusMenu(event,${recordIndex})" title="點擊可快速切換狀態">${record.status} ▾</span>
  </div>`;
}

function renderRecordRow(record, recordIndex, query){
  const visualMeta=getRowVisualMeta(record);
  return `<tr class="${visualMeta.rowClass}" data-idx="${recordIndex}">
    <td style="text-align:center"><input type="checkbox" class="rowCheck" value="${recordIndex}" onclick="updateBatchBar()"></td>
    <td class="col-id"><span class="mono">${hl(record.id,query)}</span>${visualMeta.statusNote}</td>
    <td class="col-date" style="color:var(--text2);white-space:nowrap">${fdt(record.date)}</td>
    <td class="col-channel" style="color:var(--text2);white-space:nowrap">${escapeHtml(record.channel||'—')}</td>
    <td class="col-company"><strong style="font-size:15px;cursor:pointer;color:var(--accent);white-space:nowrap" onclick="showCompanyHistoryFromRow(${recordIndex})" title="查看歷史案件">${hl(record.company,query)}</strong></td>
    <td class="col-plate" style="color:var(--text2);white-space:nowrap">${hl(record.plate,query)||'—'}</td>
    <td class="col-category" style="white-space:nowrap">${hl(record.category,query)}</td>
    <td class="col-subcategory" style="color:var(--text2)"><span class="subcategory-text">${highlightText(getSubcategoryDisplay(record),query)||'—'}</span></td>
    <td>${renderStatusDropdown(recordIndex, record)}</td>
    <td style="white-space:nowrap">${hl(record.handler,query)||'—'}</td>
    <td class="col-duration">${getDurationBadge(record)}</td>
    <td>${getInvoiceBadge(record)}</td>
    <td><div class="row-actions">
      <button class="btn btn-outline btn-sm" onclick="showDetail(${recordIndex})">詳細</button>
      <button class="btn btn-outline btn-sm" onclick="openEdit(${recordIndex})">編輯</button>
      <button class="btn btn-sm" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:var(--red)" onclick="deleteRecord(${recordIndex})">刪除</button>
    </div></td>
  </tr>`;
}

function getPaginationWindow(totalPages){
  const startPage=Math.max(1,page-2);
  const endPage=Math.min(totalPages,startPage+4);
  return {startPage,endPage};
}

function renderPagination(total, totalPages, startIndex){
  document.getElementById('pageInfo').textContent=`顯示 ${Math.min(startIndex+1,total)}-${Math.min(startIndex+PER,total)} / 共 ${total} 筆`;
  document.getElementById('prevBtn').disabled=page<=1;
  document.getElementById('nextBtn').disabled=page>=totalPages;
  const pageNumbers=document.getElementById('pageNums');
  pageNumbers.innerHTML='';
  const {startPage,endPage}=getPaginationWindow(totalPages);
  for(let currentPage=startPage;currentPage<=endPage;currentPage++){
    const button=document.createElement('button');
    button.className='page-btn'+(currentPage===page?' active':'');
    button.textContent=currentPage;
    button.onclick=()=>{page=currentPage;renderTable();};
    pageNumbers.appendChild(button);
  }
}

function renderTable(){
  const tbody=document.getElementById('tableBody');
  const empty=document.getElementById('emptyState');
  const total=filtered.length;
  const totalPages=Math.max(1,Math.ceil(total/PER));
  const startIndex=(page-1)*PER;
  const pageRecords=filtered.slice(startIndex,startIndex+PER);
  if(!total){
    tbody.innerHTML='';
    empty.style.display='';
  }else{
    empty.style.display='none';
  }
  const query=getFilterState().query;
  tbody.innerHTML=pageRecords.map((record,offset)=>renderRecordRow(record,startIndex+offset,query)).join('');
  renderPagination(total, totalPages, startIndex);
}

function changePage(d){page+=d;renderTable();}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function highlightText(value, query){
  const text=String(value??'');
  if(!query) return escapeHtml(text);
  const expression=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
  let output='';
  let lastIndex=0;
  text.replace(expression,(match,offset)=>{
    output+=escapeHtml(text.slice(lastIndex,offset));
    output+=`<span class="highlight">${escapeHtml(match)}</span>`;
    lastIndex=offset+match.length;
    return match;
  });
  return output+escapeHtml(text.slice(lastIndex));
}

function renderDetailItem(label, value, options={}){
  const style=options.style ? ` style="${options.style}"` : '';
  const gridSpan=options.fullWidth ? ' style="grid-column:1/-1"' : '';
  return `<div class="di"${gridSpan}><div class="dl">${label}</div><div class="dv"${style}>${value||'—'}</div></div>`;
}

function renderDetailSection(title, content){
  return `<div class="dst">${title}</div>${content}`;
}

function renderDetailGrid(items){
  return `<div class="dg">${items.join('')}</div>`;
}

function renderInvoiceText(record){
  if(!record.invoice) return '—';
  const color=record.invoice==='待開立'
    ? 'var(--red)'
    : record.invoice==='已開立'
      ? 'var(--green)'
      : 'var(--text3)';
  return `<span style="color:${color}">${record.invoice}</span>`;
}

function renderSurveyText(value){
  return value ? '<span style="color:var(--green);font-weight:700">是</span>' : '否';
}

function renderDetailHeader(record){
  const duration=calcDur(record.date,record.closeDate);
  return duration
    ? `<div class="pt"><div><div class="ptv">${duration}</div><div class="ptl">案件建立到結案的處理時間</div></div></div>`
    : '';
}

function renderCustomerDetailSection(record){
  return renderDetailSection('客戶資訊', renderDetailGrid([
    renderDetailItem('公司名稱', escapeHtml(record.company||'—')),
    renderDetailItem('車牌', escapeHtml(record.plate||'—')),
    renderDetailItem('產品別', escapeHtml(record.product||'—')),
  ]));
}

function renderIssueDetailSection(record){
  const items=[
    renderDetailItem('問題大類', escapeHtml(record.category||'—')),
    renderDetailItem('問題次分類', escapeHtml(record.subcategory||'—')),
    (record.category==='其他' || record.subcategory==='其他')
      ? renderDetailItem('其他原因 / 補充說明', escapeHtml(record.subcategoryNote||'—'), {fullWidth:true})
      : '',
    renderDetailItem('保固狀態', escapeHtml(record.warranty||'—')),
    renderDetailItem('發票狀態', renderInvoiceText(record)),
    renderDetailItem('是否發送問卷', renderSurveyText(record.surveySent)),
    renderDetailItem('是否收到回覆', renderSurveyText(record.surveyReplied)),
  ].filter(Boolean);
  return renderDetailSection('問題資訊', renderDetailGrid(items));
}

function renderDescriptionSection(record){
  return renderDetailSection('問題詳細描述', `<div class="dd">${escapeHtml(record.description||'未填寫')}</div>`);
}

function renderProcessDetailSection(record){
  return renderDetailSection('處理資訊', renderDetailGrid([
    renderDetailItem('處理狀態', `<span class="badge badge-${record.status}">${record.status}</span>`),
    renderDetailItem('負責處理人員', escapeHtml(record.handler||'—')),
    renderDetailItem('派工日期時間', fdt(record.dispatchDate)),
    renderDetailItem('結案日期時間', fdt(record.closeDate)),
    renderDetailItem('最終處理結果', escapeHtml(record.result||'未填寫'), {fullWidth:true}),
  ]));
}

function renderDetailBody(record){
  return [
    renderDetailHeader(record),
    renderCustomerDetailSection(record),
    renderIssueDetailSection(record),
    renderDescriptionSection(record),
    renderProcessDetailSection(record),
  ].join('');
}

function showDetail(idx){
  const r=filtered[idx];
  document.getElementById('dId').textContent=r.id;
  document.getElementById('dMeta').textContent=`建立時間：${fdt(r.date)} ｜ 管道：${r.channel||'—'}`;
  document.getElementById('dBody').innerHTML=renderDetailBody(r);
  document.getElementById('dEditBtn').onclick=()=>{closeDetail();openEdit(idx);};
  document.getElementById('dCopyBtn')._record = r;
  document.getElementById('dChildBtn')._record = r;
  const notifyBtn = document.getElementById('dNotifyBtn');
  notifyBtn.style.display = r.status==='結案' ? '' : 'none';
  notifyBtn._record = r;
  document.getElementById('detailModal').classList.add('open');
}

function closeDetail(){document.getElementById('detailModal').classList.remove('open');}

function showCompanyHistory(company){
  const history = records.filter(r=>r.company===company).slice(0,30);
  document.getElementById('historyTitle').textContent = company + ' 歷史案件';
  document.getElementById('historyMeta').textContent = `共 ${history.length} 筆`;
  const closed = history.filter(r=>r.status==='結案').length;
  const body = document.getElementById('historyBody');
  body.innerHTML = `
    <div style="padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;gap:16px;font-size:13px">
      <span>總筆數 <strong style="color:var(--accent)">${history.length}</strong></span>
      <span>已結案 <strong style="color:var(--green)">${closed}</strong></span>
      <span>未結案 <strong style="color:var(--yellow)">${history.length-closed}</strong></span>
    </div>
    <div style="overflow-y:auto;max-height:400px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--surface2)">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text3)">日期</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text3)">車牌</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text3)">問題次分類</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text3)">狀態</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text3)">負責人</th>
        </tr></thead>
        <tbody>
          ${history.map((r,i)=>`<tr style="background:${i%2===0?'var(--surface)':'var(--surface2)'}">
            <td style="padding:8px 12px;color:var(--text2)">${getDateOnlyText(r.date)||'—'}</td>
            <td style="padding:8px 12px"><span style="cursor:pointer;color:var(--accent)" data-plate="${escapeHtml(r.plate||'')}" onclick="closeHistory();searchByPlateFromEl(this)" title="搜尋同車牌案件">${escapeHtml(r.plate||'—')}</span></td>
            <td style="padding:8px 12px;color:var(--text2)">${escapeHtml(getSubcategoryDisplay(r)||'—')}</td>
            <td style="padding:8px 12px"><span class="badge badge-${r.status}">${escapeHtml(r.status||'—')}</span></td>
            <td style="padding:8px 12px">${escapeHtml(r.handler||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  document.getElementById('historyModal').classList.add('open');
}

function closeHistory(){
  document.getElementById('historyModal').classList.remove('open');
}

function searchByPlate(plate){
  document.getElementById('searchInput').value = plate;
  applyFilters();
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
  document.getElementById('view-records').classList.add('active');
  document.querySelector('.tab-btn').classList.add('active');
}
