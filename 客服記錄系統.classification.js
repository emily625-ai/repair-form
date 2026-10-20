// Based on the local r2 dictionary; see docs/workflow/CLASSIFICATION_V2.md.
const V2_VERSION='v2_2026-09';
const V2_PRODUCTS=['GPS','冷鏈','行車視野','雷達'];
const V2_DICTIONARY={
 '設備異常':{
  '主機／設備':['主機異常','設備離線','無法啟動','其他設備異常'],
  '感測／周邊':['感溫線異常','溫棒異常','鏡頭異常','雷達異常','線材異常'],
  '顯示／影像':['無畫面','黑屏','藍屏','畫面模糊','錄影異常']},
 '系統異常':{
  '平台系統':['定位異常','定位延遲','資料未更新','資料不同步','平台顯示異常'],
  'APP／登入':['APP無法登入','登入失敗','帳號密碼問題'],
  '報表／API':['報表資料異常','報表功能異常','查無報表資料','API異常','歷史資料無法下載'],
  '效能／連線':['網頁連不上','網頁速度慢','Loading卡住']},
 '服務作業':{
  '安裝／施工':['新安裝','拆機','移機','重新安裝'],
  '維修安排':['預約維修','派工安排','改約','取消'],
  '設備處理':['回收','檢查','更換','購料'],
  '操作／資料協助':['操作說明','資料提供','資料調閱']},
 '商務／行政':{
  '費用':['報價','施工費','維修費','費用確認'],
  '帳務':['發票','請款','月結','對帳','匯款單據'],
  '合約／文件':['合約','續約','訂單','文件申請']},
 '資料異動':{
  '平台資料':['修改平台資料','修改車號','修改客戶資料','修改聯絡資訊','修改站所','修改車群'],
  '帳號／權限':['新增帳號','修改帳號','停用帳號','權限調整'],
  '車輛／設備資料':['修改設備綁定','修改設備資料','新增車輛資料']},
 '其他／待確認':{'資訊不足':['待客戶補充','待內部確認'],'其他':['無法歸類']}
};

const V2_TRACKING=['維修進度追蹤','派工進度追蹤','完修確認','客戶催辦','其他追蹤'];
const V2_FIELDS=['case_nature','new_product','new_category','new_subcategory','tracking_type','tracking_topic','classification_version','classification_source','classification_status','classification_note','classification_code','project_name'];
const V2_LABELS=['案件性質','新版產品別','新版問題大類','新版問題次分類','追蹤類型','追蹤主題','分類版本','分類來源','分類確認狀態','分類備註','分類代碼','專案'];
const V2_INPUTS={project_name:'fProject',case_nature:'fCaseNature',new_product:'fNewProduct',new_category:'fNewCategory',new_subcategory:'fNewSubcategory',tracking_type:'fTrackingType',tracking_topic:'fTrackingTopic',classification_note:'fClassificationNote',classification_code:'fClassificationCode'};
let v2Original=null;
function v2Fields(record){
  return Object.fromEntries(V2_FIELDS.filter(k=>Object.prototype.hasOwnProperty.call(record,k)).map(k=>[k,record[k]]));
}
function setPreservedSelect(id,value){
  const el=document.getElementById(id);value=value||'';
  if(![...el.options].some(o=>o.value===value)) el.add(new Option(value+'（歷史值）',value));
  el.value=value;
}
function v2Options(id,values,value=''){
  const el=document.getElementById(id);
  el.replaceChildren(new Option('-- 請選擇 --',''),...values.map(v=>new Option(v,v)));
  setPreservedSelect(id,value);
}
// Function names are retained for existing form callers; new selections use V3.1.
function updateV3Project(){
  const project=document.getElementById('fProject').value;
  v2Options('fNewProduct',V3_PROJECT_PRODUCTS[project]||[]);
  updateV2Categories();
}
function updateV2Categories(){
  const nature=document.getElementById('fCaseNature').value;
  const items=nature?v3Active(document.getElementById('fNewProduct').value,nature,document.getElementById('fProject').value):[];
  v2Options('fNewCategory',[...new Set(items.map(item=>item.category))]);
  updateV2Subcategories();
}
function updateV2Subcategories(){
  const nature=document.getElementById('fCaseNature').value;
  const items=nature?v3Active(document.getElementById('fNewProduct').value,nature,document.getElementById('fProject').value):[];
  v2Options('fNewSubcategory',items.filter(item=>item.category===document.getElementById('fNewCategory').value).map(item=>item.subcategory));
  syncClassificationCode();
}
function syncClassificationCode(){
  const selected={project_name:document.getElementById('fProject').value,new_product:document.getElementById('fNewProduct').value,case_nature:document.getElementById('fCaseNature').value,new_category:document.getElementById('fNewCategory').value,new_subcategory:document.getElementById('fNewSubcategory').value};
  document.getElementById('fClassificationCode').value=v3Match(selected)?.code||'';
  document.getElementById('fV2Confirm').checked=false;
}
function suggestV2Classification(){
  // Do not convert a mention of a technician or a temperature into a diagnosis.
  const hint=document.getElementById('fClassificationSuggestion');
  if(hint) hint.textContent='依專案、產品、進線目的與實際症狀選擇分類；追蹤類型獨立。證據不足請選資訊待補並填寫分類備註。';
  return null;
}
function initializeV2Form(record=null,editing=false){
  v2Original=editing?record:null;
  const hint=document.getElementById('fClassificationSuggestion');
  if(hint) hint.textContent='先選專案、產品與案件類型，再依實際症狀分類；追蹤類型獨立填寫。';
  v2Options('fProject',V3_PROJECTS,record?.project_name||'');
  updateV3Project();
  setPreservedSelect('fNewProduct',record?.new_product);
  v2Options('fCaseNature',V3_NATURES,record?.case_nature);
  updateV2Categories();setPreservedSelect('fNewCategory',record?.new_category);
  updateV2Subcategories();setPreservedSelect('fNewSubcategory',record?.new_subcategory);
  v2Options('fTrackingType',V2_TRACKING,record?.tracking_type);
  document.getElementById('fTrackingTopic').value=record?.tracking_topic||'';
  document.getElementById('fClassificationNote').value=record?.classification_note||'';
  // Display the stored code only. Inferring a missing code here would turn an
  // unrelated edit into an implicit classification migration.
  document.getElementById('fClassificationCode').value=record?.classification_code||'';
  document.getElementById('fV2Confirm').checked=false;
  for(const [id,key] of [['fProduct','product'],['fCategory','category'],['fSubcategory','subcategory'],['fHandler','handler']]){
    if(record) setPreservedSelect(id,record[key]);
    if(record && id==='fCategory') updateSub();
    if(id!=='fHandler') document.getElementById(id).disabled=true;
  }
}
function validateV2Classification(r){
  if(r.classification_version && ![V2_VERSION,V3_VERSION].includes(r.classification_version)) throw new Error('不支援的分類版本');
  if(r.classification_version===V3_VERSION){
    if(!V3_PROJECTS.includes(r.project_name)) throw new Error('請選擇有效專案');
    const item=V3_BY_CODE.get(r.classification_code);
    if(!item || item.status!=='使用中' || item.project!==r.project_name || item.product!==r.new_product || item.nature!==r.case_nature || item.category!==r.new_category || item.subcategory!==r.new_subcategory) throw new Error('請選擇有效的V3.1產品、案件類型、大類與次分類，分類代碼必須一致');
    if(r.case_nature==='其他/待確認'&&!r.classification_note?.trim()) throw new Error('資訊待補案件請填寫缺少的資訊或待確認事項');
    if(r.tracking_type&&!V2_TRACKING.includes(r.tracking_type)) throw new Error('請選擇有效的追蹤類型');
    return;
  }
  if(!V2_PRODUCTS.includes(r.new_product)||!V2_DICTIONARY[r.case_nature]?.[r.new_category]?.includes(r.new_subcategory)) throw new Error('請完整選擇 V2 產品、案件性質、問題大類及次分類');
  if(r.tracking_type&&!V2_TRACKING.includes(r.tracking_type)) throw new Error('請選擇有效的追蹤類型');
}
function legacyCompatibility(r){
  const hardware=r.case_nature==='設備異常';
  const product={GPS:hardware?'FMS-GPS(硬體)':'FMS-GPS(系統平台)','冷鏈':hardware?'FMS-冷鏈(硬體)':'FMS-冷鏈(系統平台)','行車視野':'FMS-DMVR(純行車視野)','雷達':'FMS-雷達'}[r.new_product];
  const productCategory={GPS:'GPS設備','冷鏈':'冷鏈','行車視野':'行車視野','雷達':'雷達設備'}[r.new_product];
  let category=r.case_nature==='商務／行政'?'帳務問題':hardware?productCategory:['系統異常','資料異動'].includes(r.case_nature)?'平台系統':'其他';
  // Keep service cases in an existing legacy bucket. Previously every
  // 服務作業 case fell through to 其他, which made the legacy report noisy.
  if(r.case_nature==='服務作業'){
    if(r.new_category==='操作／資料協助') category='平台系統';
    else if(productCategory) category=productCategory;
  }
  const serviceSubcategory={
    '操作說明':'平台操作問題','資料提供':'資料提供','資料調閱':'資料提供',
    '新安裝':'新安裝','重新安裝':'新安裝','拆機':'拆機','移機':'移機',
    '購料':'購料','預約維修':'進度追蹤','派工安排':'進度追蹤','改約':'進度追蹤','取消':'進度追蹤'
  }[r.new_subcategory];
  const candidate=serviceSubcategory || r.new_subcategory;
  const subcategory=SUBMAP[category]?.includes(candidate)?candidate:'其他';
  // The legacy category `其他` requires an explanatory note even when its
  // legacy subcategory happens to contain the mapped V2 label (for example
  // 服務作業 → 操作／資料協助 → 資料提供).
  const needsNote=category==='其他'||subcategory==='其他';
  return {product,category,subcategory,subcategoryNote:needsNote?`V2：${r.case_nature}／${r.new_category}／${r.new_subcategory}`:''};
}
function applyV2Form(record){
  const fields=Object.fromEntries(Object.entries(V2_INPUTS).map(([k,id])=>[k,document.getElementById(id).value.trim()||null]));
  const changedKeys=Object.keys(V2_INPUTS).filter(k=>(v2Original?.[k]||null)!==fields[k]);
  const tupleKeys=['project_name','new_product','case_nature','new_category','new_subcategory','classification_code'];
  const tupleChanged=changedKeys.some(k=>tupleKeys.includes(k));
  const confirm=document.getElementById('fV2Confirm').checked;
  if(v2Original&&!tupleChanged&&!confirm){
    // Metadata edits are independent of the classification version. Patch only
    // changed fields; preserve unknown historical tracking values if unchanged.
    if(changedKeys.includes('tracking_type') && fields.tracking_type && !V2_TRACKING.includes(fields.tracking_type)) throw new Error('請選擇有效的追蹤類型');
    for(const key of changedKeys) record[key]=fields[key];
    for(const key of ['product','category','subcategory','subcategoryNote']) record[key]=v2Original[key];
    return record;
  }
  fields.classification_version=V3_VERSION;
  validateV2Classification(fields);
  if(!confirm) throw new Error('請勾選「已人工確認 V3.1 分類」後儲存');
  Object.assign(record,fields,{classification_source:'manual',classification_status:'confirmed'});
  if(v2Original){
    for(const key of ['product','category','subcategory','subcategoryNote']) record[key]=v2Original[key];
  }else Object.assign(record,v3LegacyCompatibility(fields));
  return record;
}
function exportV2Fields(r){return Object.fromEntries(V2_FIELDS.map((key,i)=>[V2_LABELS[i],r[key]||'']));}

// Legacy fields are compatibility values, never a substitute for V3.1 codes.
function v3LegacyCompatibility(r){
  const products={GPS:'FMS-GPS(系統平台)',冷鏈:'FMS-冷鏈(系統平台)',行車視野:'FMS-DMVR(純行車視野)',雷達:'FMS-雷達','共通平台':'','產品待確認':''};
  const category=r.case_nature==='帳務/文件'?'帳務問題':{GPS:'GPS設備',冷鏈:'冷鏈',行車視野:'行車視野',雷達:'雷達設備'}[r.new_product]||'其他';
  const subcategory=SUBMAP[category]?.includes(r.new_subcategory)?r.new_subcategory:'其他';
  return {product:products[r.new_product],category,subcategory,subcategoryNote:`V3.1 ${r.classification_code}：${r.case_nature}／${r.new_category}／${r.new_subcategory}`};
}
