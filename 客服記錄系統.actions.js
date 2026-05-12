async function markInvoiceDone(caseId){
  if(!confirm(`確定將此案件發票狀態改為「${INVOICE_STATUS.done}」？`)) return;
  setLoading(true);
  try{
    await sbFetch('cases?id=eq.'+encodeURIComponent(caseId),{
      method:'PATCH',
      body:JSON.stringify({invoice:INVOICE_STATUS.done})
    });
    await logActivity(caseId,ACTIVITY_ACTION.edit,`發票狀態：${INVOICE_STATUS.pending} → ${INVOICE_STATUS.done}`);
    showToast(UI_TEXT.invoiceUpdated);
    await loadRecords();
    renderAnalytics();
  }catch(error){
    showToast(UI_TEXT.updateFailed+error.message,'var(--red)');
  }
  setLoading(false);
}

function copyCloseNotice(){
  const record=document.getElementById('dNotifyBtn')._record;
  if(!record) return;
  const closeDate=getDateOnlyText(record.closeDate)||new Date().toISOString().slice(0,10);
  const message=`您好，感謝您的耐心等候！

以下為本次維修結案通知：

🚗 車牌：${record.plate||'—'}
🏢 公司：${record.company||'—'}
📋 問題：${record.subcategory||'—'}
✅ 處理結果：${record.result||'已完成維修'}
📅 結案日期：${closeDate}
如有任何問題，歡迎再次聯繫，謝謝！
富立提 fleetivity 售服團隊`;

  navigator.clipboard.writeText(message).then(()=>{
    showToast(UI_TEXT.closeNoticeCopied);
  }).catch(()=>{
    const textarea=document.createElement('textarea');
    textarea.value=message;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast(UI_TEXT.closeNoticeCopied);
  });
}

async function deleteRecord(index){
  const record=filtered[index];
  if(!confirm(`確定要刪除此案件？\n\n${record.id}\n${record.company} - ${record.subcategory}\n\n此操作無法復原！`)) return;
  setLoading(true);
  try{
    await sbFetch('cases?id=eq.'+encodeURIComponent(record.id),{method:'DELETE'});
    showToast(UI_TEXT.caseDeleted);
    await logActivity(record.id,ACTIVITY_ACTION.delete,`${record.company} - ${record.subcategory}`);
    await loadRecords();
  }catch(error){
    showToast(UI_TEXT.deleteFailed+error.message,'var(--red)');
  }
  setLoading(false);
}
