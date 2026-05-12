function toggleSelectAll(){
  const checked=document.getElementById('selectAll').checked;
  document.querySelectorAll('.rowCheck').forEach(checkbox=>checkbox.checked=checked);
  updateBatchBar();
}

function updateBatchBar(){
  const checked=document.querySelectorAll('.rowCheck:checked');
  const batchBar=document.getElementById('batchBar');
  if(checked.length>0){
    batchBar.style.display='flex';
    document.getElementById('batchCount').textContent=`已選 ${checked.length} 筆`;
    return;
  }
  batchBar.style.display='none';
}

function clearSelection(){
  document.querySelectorAll('.rowCheck').forEach(checkbox=>checkbox.checked=false);
  document.getElementById('selectAll').checked=false;
  document.getElementById('batchBar').style.display='none';
}

async function applyBatch(){
  const checked=[...document.querySelectorAll('.rowCheck:checked')];
  if(!checked.length){alert('請先勾選案件');return;}
  const newStatus=document.getElementById('batchStatus').value;
  const newHandler=document.getElementById('batchHandler').value;
  if(!newStatus&&!newHandler){alert('請選擇要更新的狀態或負責人');return;}
  if(!confirm(`確定要更新 ${checked.length} 筆案件？`)) return;
  setLoading(true);
  try{
    for(const checkbox of checked){
      const record=filtered[parseInt(checkbox.value)];
      const patch=buildStatusPatch(record,newStatus,newHandler?{handler:newHandler}:{});
      await patchCaseRecord(record.id,patch);
      await logActivity(record.id,ACTIVITY_ACTION.edit,`批次更新：${newStatus?'狀態→'+newStatus:''}${newHandler?'負責人→'+newHandler:''}`);
    }
    showToast(`✅ 已更新 ${checked.length} 筆案件`);
    clearSelection();
    await loadRecords();
  }catch(error){
    showToast(UI_TEXT.updateFailed+error.message,'var(--red)');
  }
  setLoading(false);
}
