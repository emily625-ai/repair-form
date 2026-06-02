const CASE_DATE_FIELD_CANDIDATES={
  date:['occurred_at','occurredAt','date'],
  dispatchDate:['dispatch_at','dispatchAt','dispatch_date','dispatchDate'],
  closeDate:['closed_at','closedAt','close_date','closeDate'],
};

function firstDefinedValue(source, keys){
  for(const key of keys){
    const value=source?.[key];
    if(value!==undefined && value!==null && value!=='') return value;
  }
  return '';
}

function normalizeDateText(value){
  if(value===undefined || value===null || value==='') return '';
  const raw=String(value).trim();
  if(!raw) return '';
  return raw.replace(' ', 'T').replace(/Z$/, '').slice(0,19);
}

function toDateValue(value){
  if(!value) return null;
  const normalized=normalizeDateText(value);
  const date=new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCaseDateValue(source, logicalKey){
  return normalizeDateText(firstDefinedValue(source, CASE_DATE_FIELD_CANDIDATES[logicalKey]||[logicalKey]));
}

function formatDateInputValue(value){
  return normalizeDateText(value).slice(0,19);
}

function getDateOnlyText(value){
  return normalizeDateText(value).slice(0,10);
}

function buildCaseDatePayload(record){
  const occurredAt=normalizeDateText(record.date)||null;
  const dispatchAt=normalizeDateText(record.dispatchDate)||null;
  const closedAt=normalizeDateText(record.closeDate)||null;
  return {
    date:occurredAt,
    occurred_at:occurredAt,
    dispatch_date:dispatchAt,
    dispatch_at:dispatchAt,
    close_date:closedAt,
    closed_at:closedAt
  };
}

function buildDatePatch(logicalKey, value){
  const normalized=normalizeDateText(value)||null;
  if(logicalKey==='date') return {date:normalized,occurred_at:normalized};
  if(logicalKey==='dispatchDate') return {dispatch_date:normalized,dispatch_at:normalized};
  if(logicalKey==='closeDate') return {close_date:normalized,closed_at:normalized};
  return {};
}

function toRow(record){
  return {
    id:record.id,
    ...buildCaseDatePayload(record),
    channel:record.channel||null,
    company:record.company||null,
    plate:record.plate||null,
    product:record.product||null,
    category:record.category||null,
    subcategory:record.subcategory||null,
    description:record.description||null,
    status:record.status||null,
    handler:record.handler||null,
    result:record.result||null,
    warranty:record.warranty||null,
    invoice:record.invoice||null,
    survey_sent:!!record.surveySent,
    survey_replied:!!record.surveyReplied
  };
}

function fromRow(row){
  return {
    id:row.id,
    date:getCaseDateValue(row,'date'),
    channel:row.channel||'',
    company:row.company||'',
    plate:row.plate||'',
    product:row.product||'',
    category:row.category||'',
    subcategory:row.subcategory||'',
    description:row.description||'',
    status:row.status||'',
    dispatchDate:getCaseDateValue(row,'dispatchDate'),
    handler:row.handler||'',
    result:row.result||'',
    closeDate:getCaseDateValue(row,'closeDate'),
    warranty:row.warranty||'',
    invoice:row.invoice||'',
    surveySent:row.survey_sent===true || row.surveySent===true,
    surveyReplied:row.survey_replied===true || row.surveyReplied===true
  };
}

const SUBMAP={
  '平台系統':['帳號密碼問題','定位異常','定位時間延遲','工作天數與實際不符','APP無法登入','登入失敗','網頁速度慢','畫面顯示處理中/Loading','歷史影像資料無法下載','API異常','查無報表資料','報表資料異常','報表功能異常','溫度異常','平台操作問題','權限問題','資料提供','其他'],
  MDVR:['鏡頭霧化、黑屏、藍屏、模糊不清','螢幕不會亮、黑屏、藍屏','螢幕顯示4分隔問題','DVR無法錄影','DVR錄影無影像檔','接頭問題','購料','報價單','其他'],
  'GPS設備':['定位異常','GPS離線','新安裝','拆機','移機','溫度異常','其他'],
  '行車視野':['螢幕不會亮、黑屏、藍屏','鏡頭霧化、黑屏、藍屏、模糊不清','鏡頭脫落','後鏡頭+無法錄影','DVR無法錄影','報價單','報表資料異常','其他'],
  '雷達設備':['燈盒問題','A柱雷達','左右雷達','報價單','匯款單據','其他'],
  '帳務問題':['發票問題','匯款單據','其他'],
  '冷鏈':['溫度異常','GPS離線','其他'],
  '溫度n/a':['感溫線(含頭)故障','溫度異常','其他'],
  '其他':['其他','轉接線','資料提供']
};

let records=[],filtered=[],editIdx=null,page=1,showOverdue=false,invoiceOnly='',surveyTodoMode='';
let currentUser='系統';
let PER=50;

function changePerPage(){
  PER=parseInt(document.getElementById('perPageSelect').value);
  page=1;
  renderTable();
}

function setLoading(on){
  let loadingBar=document.getElementById('loadingBar');
  if(!loadingBar){
    loadingBar=document.createElement('div');
    loadingBar.id='loadingBar';
    loadingBar.style.cssText='position:fixed;top:0;left:0;width:100%;height:3px;background:var(--accent);z-index:999;transition:opacity .3s';
    document.body.appendChild(loadingBar);
  }
  loadingBar.style.opacity=on?'1':'0';
}

function showToast(message,color='var(--green)'){
  const toast=document.createElement('div');
  toast.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${color};color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:999;`;
  toast.textContent=message;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),2500);
}

function getLocalIsoString(date=new Date()){
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);
}

function isDispatchStatus(status){
  return status==='轉派技師' || status==='轉派工程師';
}

function isClosedStatus(status){
  return status==='結案';
}

function validateStatusTransition(status, dispatchDate){
  if(!isDispatchStatus(status) || dispatchDate) return true;
  return confirm(`目前狀態改為「${status}」，但尚未填寫派工日期時間，確定要繼續儲存嗎？`);
}

function buildStatusPatch(record, newStatus, extraData={}){
  const patch={...extraData};
  if(newStatus) patch.status=newStatus;
  if(newStatus==='結案' && !record.closeDate && !patch.close_date && !patch.closed_at){
    Object.assign(patch, buildDatePatch('closeDate', getLocalIsoString()));
  }
  return patch;
}

function getDispatchElapsedDays(dispatchDate){
  const dispatchDt=toDateValue(dispatchDate);
  if(!dispatchDt) return null;
  const ms=new Date()-dispatchDt;
  if(Number.isNaN(ms) || ms<0) return null;
  return Math.floor(ms/864e5);
}

function isDispatchWarning(record){
  if(isDispatchOverdue(record)) return false;
  if(!record.dispatchDate || isClosedStatus(record.status) || record.handler==='客戶') return false;
  const days=getDispatchElapsedDays(record.dispatchDate);
  return days!==null && days>5;
}

function getCaseVisualState(record){
  if(isDispatchOverdue(record)) return 'overdue';
  if(isDispatchWarning(record)) return 'warning';
  return 'normal';
}

function normalizePlate(plate){
  return (plate||'').replace(/[-\s]/g,'').toLowerCase();
}

function getDuplicateOpenPlateCases(plate, days=30){
  if(!plate) return [];
  const normalizedPlate=normalizePlate(plate);
  const dateLimit=new Date();
  dateLimit.setDate(dateLimit.getDate()-days);
  return records.filter(record=>
    normalizePlate(record.plate)===normalizedPlate &&
    !isClosedStatus(record.status) &&
    toDateValue(record.date)>dateLimit
  );
}

function buildActivityDetail(action, record){
  const subject=`${record.company||'未填公司'} - ${record.subcategory||'未填次分類'}`;
  if(action==='新增') return `新增案件：${subject}`;
  if(action==='編輯') return `編輯案件：${subject}`;
  return subject;
}
