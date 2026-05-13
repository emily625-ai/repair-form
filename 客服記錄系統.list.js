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
  };
}

function matchesWarrantyFilter(record, warranty){
  if(!warranty) return true;
  const value=record.warranty||'';
  if(warranty==='靽??) return value==='靽?? || value==='靽';
  if(warranty==='靽憭?) return value==='靽憭?;
  return true;
}

function buildSearchHaystack(record){
  return [
    record.id,
    record.company,
    record.plate,
    record.category,
    record.subcategory,
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
  if(state.query && !buildSearchHaystack(record).includes(state.query)) return false;
  return true;
}

function applyFilters(){
  const filterState=getFilterState();
  filtered=records.filter(record=>recordMatchesFilters(record, filterState));
  page=1;
  document.getElementById('filterResultInfo').textContent=filtered.length!==records.length?`蝭拚蝯?嚗?{filtered.length} 蝑:'';
  renderTable();
}

function clearFilters(){
  ['searchInput'].forEach(id=>document.getElementById(id).value='');
  ['filterStatus','filterCategory','filterWarranty','filterHandler','filterChannel'].forEach(id=>document.getElementById(id).value='');
  ['filterDateFrom','filterDateTo'].forEach(id=>document.getElementById(id).value='');
  showOverdue=false;
  invoiceOnly='';
  document.getElementById('overdueBtn').classList.remove('active');
  document.getElementById('filterResultInfo').textContent='';
  applyFilters();
}

function fdt(dt){
  if(!dt)return'??;
  const d=toDateValue(dt);if(!d)return dt;
  return d.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).replace(/\//g,'-');
}

function calcDur(s,e){
  if(!s||!e)return null;
  const start=toDateValue(s);
  const end=toDateValue(e);
  if(!start || !end) return null;
  const ms=end-start;
  if(ms<=0)return null;
  const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);
  if(h>=24){const d=Math.floor(h/24),rh=h%24;return rh>0?`${d}憭?{rh}撠?`:`${d}憭奈;}
  return h>0?`${h}撠?${m}?:`${m}??`;
}

function hl(t,q){
  if(!t||!q)return t||'';
  return String(t).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>`<span class="highlight">${m}</span>`);
}

function getDurationBadge(record){
  const duration=calcDur(record.date,record.closeDate);
  if(duration){
    const color=duration.includes('憭?)&&parseInt(duration)>7?'var(--orange)':'var(--green)';
    return `<span style="font-size:12px;color:${color}">${duration}</span>`;
  }
  if(isClosedStatus(record.status)) return '<span style="font-size:12px;color:var(--text3)">??/span>';
  return '<span style="font-size:12px;color:var(--text3)">?脰?銝?/span>';
}

function getWarrantyBadge(record){
  return record.warranty
    ? `<span class="badge badge-${record.warranty}">${record.warranty}</span>`
    : '<span style="color:var(--text3);font-size:12px">??/span>';
}

function getInvoiceBadge(record){
  if(!record.invoice) return '<span style="color:var(--text3);font-size:12px">??/span>';
  const background=record.invoice==='敺?蝡?
    ? 'rgba(248,113,113,.15)'
    : record.invoice==='撌脤?蝡?
      ? 'rgba(52,211,153,.15)'
      : 'rgba(100,116,139,.15)';
  const color=record.invoice==='敺?蝡?
    ? 'var(--red)'
    : record.invoice==='撌脤?蝡?
      ? 'var(--green)'
      : 'var(--text3)';
  return `<span class="badge" style="background:${background};color:${color}">${record.invoice}</span>`;
}

function getRowVisualMeta(record){
  const visualState=getCaseVisualState(record);
  if(visualState==='overdue'){
    return {
      rowClass:'overdue-row',
      statusNote:'<span style="font-size:10px;color:var(--orange);margin-left:4px">??憭?/span>'
    };
  }
  if(visualState==='warning'){
    return {
      rowClass:'warning-row',
      statusNote:'<span style="font-size:10px;color:var(--yellow);margin-left:4px">?啣翰?唳?</span>'
    };
  }
  return {rowClass:'',statusNote:''};
}

function escapeSingleQuote(value){
  return String(value||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

function renderStatusDropdown(recordIndex, record){
  return `<div class="status-dropdown" style="position:relative;display:inline-block">
    <span class="badge badge-${record.status}" style="cursor:pointer" onclick="toggleStatusMenu(event,${recordIndex})" title="暺?敹恍?寧???>${record.status} ??/span>
  </div>`;
}

function renderRecordRow(record, recordIndex, query){
  const visualMeta=getRowVisualMeta(record);
  return `<tr class="${visualMeta.rowClass}" data-idx="${recordIndex}">
    <td style="text-align:center"><input type="checkbox" class="rowCheck" value="${recordIndex}" onclick="updateBatchBar()"></td>
    <td><span class="mono">${hl(record.id,query)}</span>${visualMeta.statusNote}</td>
    <td style="font-size:13px;color:var(--text2);white-space:nowrap">${fdt(record.date)}</td>
    <td style="font-size:13px;color:var(--text2)">${record.channel||'??}</td>
    <td><strong style="font-size:15px;cursor:pointer;color:var(--accent)" onclick="showCompanyHistory('${escapeSingleQuote(record.company)}')" title="?亦?${record.company}???隞?>${hl(record.company,query)}</strong></td>
    <td style="font-size:14px;color:var(--text2)">${hl(record.plate,query)||'??}</td>
    <td style="font-size:14px">${hl(record.category,query)}</td>
    <td style="font-size:14px;color:var(--text2)">${hl(record.subcategory,query)}</td>
    <td>${renderStatusDropdown(recordIndex, record)}</td>
    <td style="font-size:14px">${hl(record.handler,query)||'??}</td>
    <td>${getDurationBadge(record)}</td>
    <td>${getWarrantyBadge(record)}</td>
    <td>${getInvoiceBadge(record)}</td>
    <td><div class="row-actions">
      <button class="btn btn-outline btn-sm" onclick="showDetail(${recordIndex})">閰單?</button>
      <button class="btn btn-outline btn-sm" onclick="openEdit(${recordIndex})">蝺刻摩</button>
      <button class="btn btn-sm" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:var(--red)" onclick="deleteRecord(${recordIndex})">?芷</button>
    </div></td>
  </tr>`;
}

function getPaginationWindow(totalPages){
  const startPage=Math.max(1,page-2);
  const endPage=Math.min(totalPages,startPage+4);
  return {startPage,endPage};
}

function renderPagination(total, totalPages, startIndex){
  document.getElementById('pageInfo').textContent=`憿舐內 ${Math.min(startIndex+1,total)}??{Math.min(startIndex+PER,total)} / ??${total} 蝑;
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

function renderDetailItem(label, value, options={}){
  const style=options.style ? ` style="${options.style}"` : '';
  const gridSpan=options.fullWidth ? ' style="grid-column:1/-1"' : '';
  return `<div class="di"${gridSpan}><div class="dl">${label}</div><div class="dv"${style}>${value||'??}</div></div>`;
}

function renderDetailSection(title, content){
  return `<div class="dst">${title}</div>${content}`;
}

function renderDetailGrid(items){
  return `<div class="dg">${items.join('')}</div>`;
}

function renderInvoiceText(record){
  if(!record.invoice) return '??;
  const color=record.invoice==='敺?蝡?
    ? 'var(--red)'
    : record.invoice==='撌脤?蝡?
      ? 'var(--green)'
      : 'var(--text3)';
  return `<span style="color:${color}">${record.invoice}</span>`;
}

function renderDetailHeader(record){
  const duration=calcDur(record.date,record.closeDate);
  return duration
    ? `<div class="pt"><div><div class="ptv">${duration}</div><div class="ptl">????嚗脩? ??蝯?嚗?/div></div></div>`
    : '';
}

function renderCustomerDetailSection(record){
  return renderDetailSection('摰Ｘ鞈?', renderDetailGrid([
    renderDetailItem('?砍?迂', escapeHtml(record.company||'??)),
    renderDetailItem('頠??Ⅳ', escapeHtml(record.plate||'??)),
    renderDetailItem('?Ｗ???, escapeHtml(record.product||'??)),
  ]));
}

function renderIssueDetailSection(record){
  return renderDetailSection('??鞈?', renderDetailGrid([
    renderDetailItem('??憭折?', escapeHtml(record.category||'??)),
    renderDetailItem('??甈∪?憿?, escapeHtml(record.subcategory||'??)),
    renderDetailItem('靽???, escapeHtml(record.warranty||'??)),
    renderDetailItem('?潛巨???, renderInvoiceText(record)),
  ]));
}

function renderDescriptionSection(record){
  return renderDetailSection('??閰喟敦?膩', `<div class="dd">${escapeHtml(record.description||'嚗?膩嚗?)}</div>`);
}

function renderProcessDetailSection(record){
  return renderDetailSection('??鞈?', renderDetailGrid([
    renderDetailItem('?????, `<span class="badge badge-${record.status}">${record.status}</span>`),
    renderDetailItem('鞎痊??鈭箏', escapeHtml(record.handler||'??)),
    renderDetailItem('瘣曉極?交???', fdt(record.dispatchDate), {style:'font-size:11px'}),
    renderDetailItem('蝯??交???', fdt(record.closeDate), {style:'font-size:11px'}),
    renderDetailItem('?蝯?????, escapeHtml(record.result||'??), {fullWidth:true}),
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
  document.getElementById('dMeta').textContent=`?脩?嚗?{fdt(r.date)}?蝞⊿?嚗?{r.channel||'??}`;
  document.getElementById('dBody').innerHTML=renderDetailBody(r);
  document.getElementById('dEditBtn').onclick=()=>{closeDetail();openEdit(idx);};
  document.getElementById('dChildBtn')._record = r;
  const notifyBtn = document.getElementById('dNotifyBtn');
  notifyBtn.style.display = r.status==='蝯?' ? '' : 'none';
  notifyBtn._record = r;
  document.getElementById('detailModal').classList.add('open');
}

function closeDetail(){document.getElementById('detailModal').classList.remove('open');}

function showCompanyHistory(company){
  const history = records.filter(r=>r.company===company).slice(0,30);
  document.getElementById('historyTitle').textContent = company + ' 甇瑕獢辣';
  document.getElementById('historyMeta').textContent = '??'+history.length+' 蝑???;
  const closed = history.filter(r=>r.status==='蝯?').length;
  const body = document.getElementById('historyBody');
  body.innerHTML = `
    <div style="padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;gap:16px;font-size:12px">
      <span>蝮賣?隞塚?<strong style="color:var(--accent)">${history.length}</strong></span>
      <span>撌脩?獢?<strong style="color:var(--green)">${closed}</strong></span>
      <span>?芰?獢?<strong style="color:var(--yellow)">${history.length-closed}</strong></span>
    </div>
    <div style="overflow-y:auto;max-height:400px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--surface2)">
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">?脩??交?</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">頠?</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">??甈∪?憿?/th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">???/th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">鞎痊鈭?/th>
        </tr></thead>
        <tbody>
          ${history.map((r,i)=>`<tr style="background:${i%2===0?'var(--surface)':'var(--surface2)'}">
            <td style="padding:8px 12px;color:var(--text2)">${getDateOnlyText(r.date)||'??}</td>
            <td style="padding:8px 12px"><span style="cursor:pointer;color:var(--accent)" onclick="closeHistory();searchByPlate('${r.plate}')" title="??甇方?????隞?>${r.plate||'??}</span></td>
            <td style="padding:8px 12px;color:var(--text2)">${r.subcategory||'??}</td>
            <td style="padding:8px 12px"><span class="badge badge-${r.status}">${r.status}</span></td>
            <td style="padding:8px 12px">${r.handler||'??}</td>
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
