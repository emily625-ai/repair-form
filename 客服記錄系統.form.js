function getFormCompanyValue(){
  const selectedCompany=document.getElementById('fCompany').value;
  return selectedCompany==='__new__'
    ? document.getElementById('fCompanyNew').value.trim()
    : selectedCompany;
}

function buildRecordId(formDate){
  if(editIdx!==null) return editIdx;
  return window._customId || genId(formDate);
}

function validateRecordInput(record){
  if(!record.date || !record.company){
    alert('請填寫進線日期時間與公司名稱');
    return false;
  }
  if(!validateStatusTransition(record.status, record.dispatchDate)) return false;
  return true;
}

function collectRecordFormData(){
  const formDate=document.getElementById('fDate').value;
  const surveyReplied=document.getElementById('fSurveyReplied').checked;
  const surveySent=document.getElementById('fSurveySent').checked || surveyReplied;
  return {
    id:buildRecordId(formDate),
    date:formDate,
    channel:document.getElementById('fChannel').value,
    company:getFormCompanyValue(),
    plate:document.getElementById('fPlate').value.trim(),
    product:document.getElementById('fProduct').value,
    category:document.getElementById('fCategory').value,
    subcategory:document.getElementById('fSubcategory').value,
    status:document.getElementById('fStatus').value,
    dispatchDate:document.getElementById('fDispatchDate').value,
    handler:document.getElementById('fHandler').value,
    warranty:document.getElementById('fWarranty').value,
    invoice:document.getElementById('fInvoice').value,
    surveySent,
    surveyReplied,
    closeDate:document.getElementById('fCloseDate').value,
    description:document.getElementById('fDescription').value.trim(),
    result:document.getElementById('fResult').value.trim(),
  };
}

function buildRecordFromForm(){
  const record=collectRecordFormData();
  if(!validateRecordInput(record)) return null;
  return record;
}

function getDuplicateCaseWarning(record){
  if(editIdx!==null || !record.plate) return '';
  const duplicateCases=getDuplicateOpenPlateCases(record.plate, 30);
  if(!duplicateCases.length) return '';
  return '⚠️ 此車牌在30天內有 '+duplicateCases.length+' 筆未結案件：\n\n'
    + duplicateCases.map(item=>'・'+item.id+' ['+item.status+'] '+item.subcategory).join('\n')
    + '\n\n確定要建立新案件嗎？';
}

function confirmDuplicateCaseIfNeeded(record){
  const warningMessage=getDuplicateCaseWarning(record);
  if(!warningMessage) return true;
  return confirm(warningMessage);
}

async function persistRecord(record){
  const isEditing=editIdx!==null;
  if(isEditing){
    await updateCaseRecord(record);
    await logActivity(record.id,'編輯',buildActivityDetail('編輯', record));
    return {action:'edit',toast:'✅ 案件已更新'};
  }
  await createCaseRecord(record);
  await logActivity(record.id,'新增',buildActivityDetail('新增', record));
  return {action:'create',toast:'✅ 案件已新增'};
}

function resetSaveContext(){
  window._customId = null;
}

function openNewForm(){
  editIdx=null;
  window._customId=null;
  document.getElementById('formTitle').textContent='新增案件';
  const now=new Date();now.setSeconds(0,0);
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,19);
  document.getElementById('fDate').value=local;
  document.getElementById('fChannel').value='官方LINE';
  document.getElementById('fCompany').value='';
  document.getElementById('fCompanyNew').value='';
  document.getElementById('fCompanyNewGroup').style.display='none';
  document.getElementById('fPlate').value='';
  document.getElementById('fProduct').value='';
  document.getElementById('fCategory').value='平台系統';
  updateSub();
  document.getElementById('fStatus').value='客服處理中';
  document.getElementById('fDispatchDate').value='';
  document.getElementById('fHandler').value='';
  document.getElementById('fWarranty').value='';
  document.getElementById('fCloseDate').value='';
  document.getElementById('fDescription').value='';
  document.getElementById('fResult').value='';
  document.getElementById('fInvoice').value='';
  document.getElementById('fSurveySent').checked=false;
  document.getElementById('fSurveyReplied').checked=false;
  document.getElementById('formModal').classList.add('open');
}

function openEdit(idx){
  const r=filtered[idx];
  editIdx=r.id;
  document.getElementById('formTitle').textContent='編輯案件 '+r.id;
  document.getElementById('fDate').value=formatDateInputValue(r.date);
  document.getElementById('fChannel').value=r.channel||'官方LINE';
  const cs=document.getElementById('fCompany');
  const op=[...cs.options].find(o=>o.value===r.company);
  if(op){cs.value=r.company;document.getElementById('fCompanyNewGroup').style.display='none';}
  else{cs.value='__new__';document.getElementById('fCompanyNew').value=r.company;document.getElementById('fCompanyNewGroup').style.display='';}
  document.getElementById('fPlate').value=r.plate;
  document.getElementById('fProduct').value=r.product;
  document.getElementById('fCategory').value=r.category;
  updateSub();
  document.getElementById('fSubcategory').value=r.subcategory;
  document.getElementById('fStatus').value=r.status;
  document.getElementById('fDispatchDate').value=formatDateInputValue(r.dispatchDate);
  document.getElementById('fHandler').value=r.handler;
  document.getElementById('fWarranty').value=r.warranty;
  document.getElementById('fCloseDate').value=formatDateInputValue(r.closeDate);
  document.getElementById('fDescription').value=r.description;
  document.getElementById('fResult').value=r.result;
  document.getElementById('fInvoice').value=r.invoice||'';
  document.getElementById('fSurveySent').checked=!!r.surveySent;
  document.getElementById('fSurveyReplied').checked=!!r.surveyReplied;
  document.getElementById('formModal').classList.add('open');
}

function fillCompanyField(company){
  const companySelect=document.getElementById('fCompany');
  const existingOption=[...companySelect.options].find(option=>option.value===company);
  if(existingOption){
    companySelect.value=company;
    document.getElementById('fCompanyNewGroup').style.display='none';
    document.getElementById('fCompanyNew').value='';
    return;
  }
  companySelect.value='__new__';
  document.getElementById('fCompanyNew').value=company||'';
  document.getElementById('fCompanyNewGroup').style.display='';
}

function copyDetailRecord(){
  const source=document.getElementById('dCopyBtn')._record;
  if(!source){alert('找不到可複製的案件資料');return;}

  closeDetail();
  editIdx=null;
  window._customId=null;
  document.getElementById('formTitle').textContent='新增案件（複製 '+source.id+'）';
  document.getElementById('fDate').value='';
  document.getElementById('fChannel').value=source.channel||'官方LINE';
  fillCompanyField(source.company);
  document.getElementById('fPlate').value=source.plate||'';
  document.getElementById('fProduct').value=source.product||'';
  document.getElementById('fCategory').value=source.category||'平台系統';
  updateSub();
  document.getElementById('fSubcategory').value=source.subcategory||'';
  document.getElementById('fStatus').value='客服處理中';
  document.getElementById('fDispatchDate').value='';
  document.getElementById('fHandler').value=source.handler||'';
  document.getElementById('fWarranty').value='';
  document.getElementById('fInvoice').value='';
  document.getElementById('fSurveySent').checked=false;
  document.getElementById('fSurveyReplied').checked=false;
  document.getElementById('fCloseDate').value='';
  document.getElementById('fDescription').value=source.description||'';
  document.getElementById('fResult').value='';
  document.getElementById('formModal').classList.add('open');
}

let quickParsed = {};

function openQuickForm(){
  document.getElementById('quickText').value='';
  document.getElementById('quickResult').style.display='none';
  document.getElementById('quickModal').classList.add('open');
  setTimeout(()=>document.getElementById('quickText').focus(),100);
}

function closeQuickForm(){
  document.getElementById('quickModal').classList.remove('open');
}

function parseQuickText(){
  const text = document.getElementById('quickText').value.trim();
  if(!text){alert('請先貼上 LINE 訊息內容');return;}
  
  quickParsed = {};
  const lines = text.split(/[\r\n]+/).map(l=>l.trim()).filter(Boolean);
  const datePatterns = [
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*(\d{1,2}):(\d{2})/,
    /(\d{1,2})[\/\-](\d{1,2})\s*(\d{1,2}):(\d{2})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(\d{1,2})[\/\-](\d{1,2})/
  ];
  let foundDate = null;
  for(const line of lines){
    for(const pat of datePatterns){
      const m = line.match(pat);
      if(m){
        const now = new Date();
        let y,mo,d,h=now.getHours(),mi=now.getMinutes();
        if(pat.source.includes('\\d{4}')){
          if(m.length>=6){y=m[1];mo=m[2];d=m[3];h=m[4];mi=m[5];}
          else{y=m[1];mo=m[2];d=m[3];}
        } else {
          y=now.getFullYear();
          if(m.length>=5){mo=m[1];d=m[2];h=m[3];mi=m[4];}
          else{mo=m[1];d=m[2];}
        }
        foundDate = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:00`;
        break;
      }
    }
    if(foundDate) break;
  }
  if(!foundDate){
    const now=new Date();
    foundDate=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,19);
  }
  quickParsed.date = foundDate;

  for(const line of lines){
    const m = line.match(/\b([A-Z0-9]{2,4}[-\s][A-Z0-9]{2,4})\b/i);
    if(m){quickParsed.plate = m[1].toUpperCase(); break;}
  }

  for(const line of lines){
    const m = line.match(/(\d{4}[\-]?\d{3}[\-]?\d{3}|\d{10}|\d{4}[\-]\d{6})/);
    if(m){quickParsed.phone = m[1]; break;}
  }

  for(const line of lines){
    const m = line.match(/聯絡人[：:]\s*(.+)/);
    if(m){quickParsed.contact = m[1].trim(); break;}
  }

  for(const line of lines){
    const m = line.match(/(.{2,8}所|.{2,6}倉|.{2,6}廠)/);
    if(m){quickParsed.location = m[1]; break;}
  }

  const descLines = lines.filter(l=>{
    if(quickParsed.plate && l.includes(quickParsed.plate)) return false;
    if(quickParsed.phone && l.includes(quickParsed.phone)) return false;
    if(l.match(/聯絡人[：:]/)) return false;
    if(l.match(/電話[：:]/)) return false;
    return true;
  });
  quickParsed.description = descLines.join('\n');

  const items = [
    ['📅 進線時間', quickParsed.date?.replace('T',' ')],
    ['🚗 車牌', quickParsed.plate||'（未偵測到）'],
    ['📍 站所', quickParsed.location||'（未偵測到）'],
    ['👤 聯絡人', quickParsed.contact||'（未偵測到）'],
    ['📞 電話', quickParsed.phone||'（未偵測到）'],
    ['📝 問題描述', quickParsed.description],
  ];
  document.getElementById('quickResultContent').innerHTML = items.map(([k,v])=>
    `<div style="display:flex;gap:8px;margin-bottom:5px"><span style="color:var(--text3);min-width:80px">${k}</span><span style="color:var(--text);flex:1">${v||'—'}</span></div>`
  ).join('');
  document.getElementById('quickResult').style.display='block';
}

function applyQuickResult(){
  closeQuickForm();
  editIdx=null;
  document.getElementById('formTitle').textContent='新增案件';
  document.getElementById('fDate').value=quickParsed.date||'';
  document.getElementById('fChannel').value='官方LINE';
  document.getElementById('fCompany').value='';
  document.getElementById('fCompanyNewGroup').style.display='none';
  document.getElementById('fPlate').value=quickParsed.plate||'';
  document.getElementById('fProduct').value='';
  document.getElementById('fCategory').value='平台系統';
  updateSub();
  document.getElementById('fStatus').value='客服處理中';
  document.getElementById('fDispatchDate').value='';
  document.getElementById('fHandler').value='';
  document.getElementById('fWarranty').value='';
  document.getElementById('fInvoice').value='';
  document.getElementById('fSurveySent').checked=false;
  document.getElementById('fSurveyReplied').checked=false;
  document.getElementById('fCloseDate').value='';
  let desc = quickParsed.description||'';
  if(quickParsed.location) desc = quickParsed.location + '\n' + desc;
  if(quickParsed.contact) desc += '\n聯絡人：' + quickParsed.contact;
  if(quickParsed.phone) desc += '\n電話：' + quickParsed.phone;
  document.getElementById('fDescription').value=desc.trim();
  document.getElementById('fResult').value='';
  document.getElementById('formModal').classList.add('open');
}

function createChildCase(){
  const parent = document.getElementById('dChildBtn')._record;
  if(!parent){alert('找不到父案件資料');return;}
  const baseId = parent.id.split('-').slice(0,2).join('-');
  const existingChildren = records.filter(r => r.id.startsWith(baseId+'-') && r.id !== baseId);
  let maxSub = 0;
  existingChildren.forEach(r => {
    const parts = r.id.split('-');
    if(parts.length === 3){
      const n = parseInt(parts[2]);
      if(!isNaN(n) && n > maxSub) maxSub = n;
    }
  });
  const newId = baseId + '-' + String(maxSub+1).padStart(2,'0');
  
  closeDetail();
  editIdx = null;
  document.getElementById('formTitle').textContent = '衍生子案件（父：'+parent.id+'）';
  const now = new Date(); now.setSeconds(0,0);
  document.getElementById('fDate').value = now.toISOString().slice(0,19);
  document.getElementById('fChannel').value = parent.channel || '官方LINE';
  
  const cs = document.getElementById('fCompany');
  let found = false;
  for(let i=0; i<cs.options.length; i++){
    if(cs.options[i].value === parent.company){ cs.value = parent.company; found = true; break; }
  }
  if(!found && parent.company){
    cs.value = '__new__';
    document.getElementById('fCompanyNew').value = parent.company;
    document.getElementById('fCompanyNewGroup').style.display = '';
  }
  
  document.getElementById('fPlate').value = parent.plate || '';
  document.getElementById('fProduct').value = parent.product || '';
  document.getElementById('fCategory').value = parent.category || '';
  document.getElementById('fSubcategory').value = parent.subcategory || '';
  document.getElementById('fWarranty').value = parent.warranty || '';
  document.getElementById('fInvoice').value = '';
  document.getElementById('fSurveySent').checked = false;
  document.getElementById('fSurveyReplied').checked = false;
  document.getElementById('fStatus').value = '客服處理中';
  document.getElementById('fHandler').value = '';
  document.getElementById('fDispatchDate').value = '';
  document.getElementById('fCloseDate').value = '';
  document.getElementById('fDescription').value = '【衍生自 '+parent.id+'】\n原問題：'+(parent.subcategory||'')+'\n\n本次狀況：';
  document.getElementById('fResult').value = '';
  
  window._customId = newId;
  updateSub();
  document.getElementById('formModal').classList.add('open');
  showToast('✨ 子案件編號：'+newId, 'var(--purple)');
}

function copyLastRecord(){
  if(!records.length){alert('尚無案件可複製');return;}
  const last=records[0];
  editIdx=null;
  document.getElementById('formTitle').textContent='新增案件（複製上筆）';
  const now=new Date();now.setSeconds(0,0);
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,19);
  document.getElementById('fDate').value=local;
  document.getElementById('fChannel').value=last.channel||'官方LINE';
  const cs=document.getElementById('fCompany');
  const op=[...cs.options].find(o=>o.value===last.company);
  if(op){cs.value=last.company;document.getElementById('fCompanyNewGroup').style.display='none';}
  else{cs.value='__new__';document.getElementById('fCompanyNew').value=last.company;document.getElementById('fCompanyNewGroup').style.display='';}
  document.getElementById('fPlate').value='';
  document.getElementById('fProduct').value=last.product||'';
  document.getElementById('fCategory').value=last.category||'平台系統';
  updateSub();
  document.getElementById('fSubcategory').value=last.subcategory||'';
  document.getElementById('fStatus').value='客服處理中';
  document.getElementById('fDispatchDate').value='';
  document.getElementById('fHandler').value=last.handler||'';
  document.getElementById('fWarranty').value=last.warranty||'';
  document.getElementById('fSurveySent').checked=false;
  document.getElementById('fSurveyReplied').checked=false;
  document.getElementById('fCloseDate').value='';
  document.getElementById('fDescription').value='';
  document.getElementById('fResult').value='';
  document.getElementById('formModal').classList.add('open');
}

function closeForm(){document.getElementById('formModal').classList.remove('open');}

async function saveRecord(){
  const rec=buildRecordFromForm();
  if(!rec) return;
  if(!confirmDuplicateCaseIfNeeded(rec)) return;

  setLoading(true);
  try{
    const saveResult=await persistRecord(rec);
    showToast(saveResult.toast);
    resetSaveContext();
    closeForm();
    await loadRecords();
  }catch(e){showToast('儲存失敗：'+e.message,'var(--red)');}
  setLoading(false);
}
