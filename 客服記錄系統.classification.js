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
const V2_FIELDS=['case_nature','new_product','new_category','new_subcategory','tracking_type','tracking_topic','classification_version','classification_source','classification_status','classification_note'];
const V2_LABELS=['案件性質','新版產品別','新版問題大類','新版問題次分類','追蹤類型','追蹤主題','分類版本','分類來源','分類確認狀態','分類備註'];
const V2_INPUTS={case_nature:'fCaseNature',new_product:'fNewProduct',new_category:'fNewCategory',new_subcategory:'fNewSubcategory',tracking_type:'fTrackingType',tracking_topic:'fTrackingTopic',classification_note:'fClassificationNote'};
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
function updateV2Categories(){
  v2Options('fNewCategory',Object.keys(V2_DICTIONARY[document.getElementById('fCaseNature').value]||{}));
  updateV2Subcategories();
}
function updateV2Subcategories(){
  v2Options('fNewSubcategory',V2_DICTIONARY[document.getElementById('fCaseNature').value]?.[document.getElementById('fNewCategory').value]||[]);
}
function initializeV2Form(record=null,editing=false){
  v2Original=editing?record:null;
  v2Options('fNewProduct',V2_PRODUCTS,record?.new_product);
  v2Options('fCaseNature',Object.keys(V2_DICTIONARY),record?.case_nature);
  updateV2Categories();setPreservedSelect('fNewCategory',record?.new_category);
  updateV2Subcategories();setPreservedSelect('fNewSubcategory',record?.new_subcategory);
  v2Options('fTrackingType',V2_TRACKING,record?.tracking_type);
  document.getElementById('fTrackingTopic').value=record?.tracking_topic||'';
  document.getElementById('fClassificationNote').value=record?.classification_note||'';
  document.getElementById('fV2Confirm').checked=false;
  for(const [id,key] of [['fProduct','product'],['fCategory','category'],['fSubcategory','subcategory'],['fHandler','handler']]){
    if(record) setPreservedSelect(id,record[key]);
    if(record && id==='fCategory') updateSub();
    if(id!=='fHandler') document.getElementById(id).disabled=true;
  }
}
function validateV2Classification(r){
  if(!V2_PRODUCTS.includes(r.new_product)||!V2_DICTIONARY[r.case_nature]?.[r.new_category]?.includes(r.new_subcategory)) throw new Error('請完整選擇 V2 產品、案件性質、問題大類及次分類');
  if(r.tracking_type&&!V2_TRACKING.includes(r.tracking_type)) throw new Error('請選擇有效的追蹤類型');
}
function legacyCompatibility(r){
  const hardware=r.case_nature==='設備異常';
  const product={GPS:hardware?'FMS-GPS(硬體)':'FMS-GPS(系統平台)','冷鏈':hardware?'FMS-冷鏈(硬體)':'FMS-冷鏈(系統平台)','行車視野':'FMS-DMVR(純行車視野)','雷達':'FMS-雷達'}[r.new_product];
  const category=r.case_nature==='商務／行政'?'帳務問題':hardware?({GPS:'GPS設備','冷鏈':'冷鏈','行車視野':'行車視野','雷達':'雷達設備'}[r.new_product]):['系統異常','資料異動'].includes(r.case_nature)?'平台系統':'其他';
  const subcategory=SUBMAP[category]?.includes(r.new_subcategory)?r.new_subcategory:'其他';
  // The legacy category `其他` requires an explanatory note even when its
  // legacy subcategory happens to contain the mapped V2 label (for example
  // 服務作業 → 操作／資料協助 → 資料提供).
  const needsNote=category==='其他'||subcategory==='其他';
  return {product,category,subcategory,subcategoryNote:needsNote?`V2：${r.case_nature}／${r.new_category}／${r.new_subcategory}`:''};
}
function applyV2Form(record){
  const fields=Object.fromEntries(Object.entries(V2_INPUTS).map(([k,id])=>[k,document.getElementById(id).value.trim()||null]));
  const changed=Object.keys(V2_INPUTS).some(k=>(v2Original?.[k]||null)!==fields[k]);
  const confirm=document.getElementById('fV2Confirm').checked;
  if(v2Original&&!changed&&!confirm){
    // Omit V2 keys from PATCH entirely; unrelated edits cannot clear metadata.
    for(const key of ['product','category','subcategory','subcategoryNote']) record[key]=v2Original[key];
    return record;
  }
  validateV2Classification(fields);
  if(!confirm) throw new Error('請勾選「已人工確認 V2 分類」後儲存');
  Object.assign(record,fields,{classification_version:V2_VERSION,classification_source:'manual',classification_status:'confirmed'});
  if(v2Original){
    for(const key of ['product','category','subcategory','subcategoryNote']) record[key]=v2Original[key];
  }else Object.assign(record,legacyCompatibility(fields));
  return record;
}
function exportV2Fields(r){return Object.fromEntries(V2_FIELDS.map((key,i)=>[V2_LABELS[i],r[key]||'']));}
