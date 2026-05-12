let statusTargetIdx = null;

function toggleStatusMenu(event, index){
  event.stopPropagation();
  const menu=document.getElementById('statusMenu');
  const rect=event.target.getBoundingClientRect();
  statusTargetIdx=index;
  menu.style.left=rect.left+'px';
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.display=menu.style.display==='none'?'block':'none';
}

document.addEventListener('click',()=>{
  document.getElementById('statusMenu').style.display='none';
});

async function setStatus(newStatus){
  document.getElementById('statusMenu').style.display='none';
  if(statusTargetIdx===null) return;
  const record=filtered[statusTargetIdx];
  if(record.status===newStatus) return;
  setLoading(true);
  try{
    const updateData=buildStatusPatch(record,newStatus);
    await patchCaseRecord(record.id,updateData);
    await logActivity(record.id,ACTIVITY_ACTION.edit,`狀態變更：${record.status} → ${newStatus}`);
    showToast('✅ 狀態已更新為「'+newStatus+'」');
    await loadRecords();
  }catch(error){
    showToast(UI_TEXT.updateFailed+error.message,'var(--red)');
  }
  setLoading(false);
}
