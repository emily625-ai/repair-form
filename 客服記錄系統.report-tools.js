function genId(dateText){
  const dateKey=getDateOnlyText(dateText).replace(/-/g,'');
  const maxSequence=records
    .filter(record=>record.id && record.id.startsWith(dateKey+'-'))
    .map(record=>{
      const sequenceText=String(record.id).split('-').pop();
      const sequenceNumber=parseInt(sequenceText,10);
      return Number.isNaN(sequenceNumber) ? 0 : sequenceNumber;
    })
    .reduce((maxValue,currentValue)=>Math.max(maxValue,currentValue),0);
  return `${dateKey}-${String(maxSequence+1).padStart(3,'0')}`;
}

function exportExcel(){
  const data=filtered.map(record=>({
    編號:record.id,
    進線日期時間:record.date,
    進線管道:record.channel,
    公司名稱:record.company,
    車牌:record.plate,
    產品別:record.product,
    問題大類:record.category,
    問題次分類:record.subcategory,
    問題詳細描述:record.description,
    處理狀態:record.status,
    派工日期時間:record.dispatchDate,
    負責處理人員:record.handler,
    最終處理結果:record.result,
    結案日期時間:record.closeDate,
    處理時間:calcDur(record.date,record.closeDate)||'',
    保固狀態:record.warranty
  }));
  const worksheet=XLSX.utils.json_to_sheet(data);
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,worksheet,'售服記錄');
  XLSX.writeFile(workbook,`客服案件記錄_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function getWeekLabel(date){
  const dateValue=toDateValue(date);
  if(!dateValue) return '';
  const monday=new Date(dateValue);
  monday.setDate(dateValue.getDate()-dateValue.getDay()+1);
  const sunday=new Date(monday);
  sunday.setDate(monday.getDate()+6);
  return monday.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'})+'～'+sunday.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'});
}

function getLastCompletedSat(){
  const now=new Date();
  const day=now.getDay();
  let diffToSat;
  if(day===6) diffToSat=7;
  else if(day===0) diffToSat=8;
  else diffToSat=day+1;
  const saturday=new Date(now);
  saturday.setDate(now.getDate()-diffToSat);
  saturday.setHours(0,0,0,0);
  return saturday;
}

function setThisWeek(){
  const saturday=getLastCompletedSat();
  const friday=new Date(saturday);
  friday.setDate(saturday.getDate()+6);
  setReportRange(saturday,friday);
}

function setLastWeek(){
  const saturday=getLastCompletedSat();
  const previousSaturday=new Date(saturday);
  previousSaturday.setDate(saturday.getDate()-7);
  const previousFriday=new Date(previousSaturday);
  previousFriday.setDate(previousSaturday.getDate()+6);
  setReportRange(previousSaturday,previousFriday);
}

function setThisMonth(){
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth()-1,1);
  const last=new Date(now.getFullYear(),now.getMonth(),0);
  setReportRange(first,last);
}

function setLastMonth(){
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth()-2,1);
  const last=new Date(now.getFullYear(),now.getMonth()-1,0);
  setReportRange(first,last);
}

function setReportRange(fromDate,toDate){
  document.getElementById('rptFrom').value=fromDate.toISOString().slice(0,10);
  document.getElementById('rptTo').value=toDate.toISOString().slice(0,10);
  renderAnalytics();
}

function clearRptRange(){
  document.getElementById('rptFrom').value='';
  document.getElementById('rptTo').value='';
  renderAnalytics();
}

function getRptRecords(){
  const from=document.getElementById('rptFrom').value;
  const to=document.getElementById('rptTo').value;
  if(!from&&!to) return records;
  return records.filter(record=>{
    const date=getDateOnlyText(record.date);
    if(from&&date<from) return false;
    if(to&&date>to) return false;
    return true;
  });
}

function isDispatchOverdue(record){
  if(record.status==='結案') return false;
  const dispatchDate=toDateValue(record.dispatchDate);
  if(!dispatchDate) return false;
  if(record.handler==='客戶') return false;
  return (new Date()-dispatchDate)>7*864e5;
}
