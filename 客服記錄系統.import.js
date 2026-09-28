let importRows = [];

function importExcel(event){
  const file=event.target.files[0];
  event.target.value='';
  if(!file) return;
  const reader=new FileReader();
  reader.onload=readerEvent=>{
    try{
      const workbook=XLSX.read(readerEvent.target.result,{type:'array',cellDates:true});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(sheet,{raw:false,dateNF:'yyyy-mm-dd HH:mm:ss'});
      if(!data.length){
        alert('Excel 無資料');
        return;
      }
      importRows=data.map(mapImportRow);
      renderImportPreview(importRows);
      document.getElementById('importModal').classList.add('open');
    }catch(error){
      alert('匯入失敗：'+error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function mapImportRow(row){
  const columnMap={
    '編號':'id','進線日期':'date','進線管道':'channel','公司名稱':'company',
    '車牌':'plate','產品別':'product','問題大類':'category','問題次分類':'subcategory',
    '問題詳細描述':'description','處理狀態':'status','派工日期':'dispatch_date',
    '負責處理人員':'handler','最終處理結果':'result','結案日期':'close_date',
    '保固狀態':'warranty','其他原因 / 補充說明':'subcategory_note'
  };
  V2_FIELDS.forEach((key,i)=>columnMap[V2_LABELS[i]]=key);
  Object.assign(columnMap,{'進線日期時間':'date','派工日期時間':'dispatch_date','結案日期時間':'close_date'});
  const mapped={};
  Object.entries(columnMap).forEach(([label,key])=>{
    if(row[label]!==undefined) mapped[key]=row[label]||null;
  });
  if(!mapped.id) throw new Error('匯入每列必須有編號，避免同批產生重複編號');
  if(!mapped.date || !mapped.company) throw new Error('匯入需填進線日期及公司名稱');
  if(V2_FIELDS.some(key=>mapped[key])){
    if(mapped.classification_version!==V2_VERSION) throw new Error('不支援的 V2 分類版本');
    validateV2Classification(mapped);
    if(!['manual','line_rule','ai_suggested','historical_migration'].includes(mapped.classification_source)) throw new Error('分類來源無效');
    if(!['confirmed','pending_review'].includes(mapped.classification_status)) throw new Error('分類確認狀態無效');
    // V2 exports keep their original legacy values. Do not infer over them.
    if(!mapped.product || !mapped.category || !mapped.subcategory) throw new Error('V2 匯入須保留舊產品／大類／次分類相容值');
  }
  return mapped;
}

function splitImportRows(rows){
  const existingIds=new Set(records.map(record=>record.id));
  const seen=new Set();
  for(const row of rows){if(seen.has(row.id)) throw new Error('同批匯入編號重複：'+row.id);seen.add(row.id);}
  return {
    existingIds,
    newRows:rows.filter(row=>!existingIds.has(row.id)),
    duplicateRows:rows.filter(row=>existingIds.has(row.id))
  };
}

function renderImportPreview(rows){
  const {existingIds,newRows,duplicateRows}=splitImportRows(rows);
  document.getElementById('importMeta').textContent=
    `共 ${rows.length} 筆　新增 ${newRows.length} 筆　重複 ${duplicateRows.length} 筆（跳過）`;
  document.getElementById('importPreview').innerHTML=buildImportPreviewMarkup(rows,existingIds,newRows.length,duplicateRows.length);
  document.getElementById('importConfirmBtn').disabled=newRows.length===0;
}

function buildImportPreviewMarkup(rows, existingIds, newCount, duplicateCount){
  return `
    <div class="import-summary">
      <span style="color:var(--green)">✅ 新增：${newCount} 筆</span>
      <span style="color:var(--text3)">⏭ 跳過重複：${duplicateCount} 筆</span>
    </div>
    <table class="import-preview-table">
      <thead><tr>
        <th>狀態</th>
        <th>編號</th>
        <th>進線日期</th>
        <th>公司</th>
        <th>車牌</th>
        <th>問題</th>
      </tr></thead>
      <tbody>${rows.map((row,index)=>buildImportPreviewRow(row,index,existingIds)).join('')}</tbody>
    </table>`;
}

function buildImportPreviewRow(row, index, existingIds){
  const isDuplicate=existingIds.has(row.id);
  const rowClass=isDuplicate?'import-row-duplicate':index%2===0?'import-row-even':'import-row-odd';
  return `<tr class="${rowClass}">
    <td>${isDuplicate?'<span class="import-status-duplicate">跳過</span>':'<span class="import-status-new">✅新增</span>'}</td>
    <td class="import-code">${escapeHtml(row.id||'—')}</td>
    <td class="import-muted">${getDateOnlyText(row.date)||'—'}</td>
    <td class="import-company">${escapeHtml(row.company||'—')}</td>
    <td class="import-muted">${escapeHtml(row.plate||'—')}</td>
    <td class="import-muted">${escapeHtml(row.subcategory||row.description?.slice(0,20)||'—')}</td>
  </tr>`;
}

function closeImport(){
  document.getElementById('importModal').classList.remove('open');
  importRows=[];
}

async function confirmImport(){
  const {newRows}=splitImportRows(importRows);
  if(!newRows.length){
    alert('沒有新資料可匯入');
    return;
  }
  setLoading(true);
  closeImport();
  try{
    for(let index=0;index<newRows.length;index+=30){
      const batch=newRows.slice(index,index+30);
      await sbFetch('cases',{method:'POST',body:JSON.stringify(batch)});
      for(const row of batch) await logActivity(row.id,'新增','Excel 匯入案件');
    }
    showToast(`✅ 成功匯入 ${newRows.length} 筆資料`);
    await loadRecords();
  }catch(error){
    showToast('匯入失敗：'+error.message,'var(--red)');
  }
  setLoading(false);
}
