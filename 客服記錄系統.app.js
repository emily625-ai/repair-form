window.onload=()=>{
  updateSub();
  document.getElementById('fCompany').addEventListener('change',function(){
    document.getElementById('fCompanyNewGroup').style.display=this.value==='__new__'?'':'none';
  });
  bindModalBackdropClose();
  loadRecords();
};

function switchView(viewName, button){
  document.querySelectorAll('.view').forEach(view=>view.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(tab=>tab.classList.remove('active'));
  document.getElementById('view-'+viewName).classList.add('active');
  button.classList.add('active');
  if(viewName==='analytics') renderAnalytics();
  if(viewName==='actlog') loadActivityLog();
}

function updateSub(){
  const category=document.getElementById('fCategory').value;
  const select=document.getElementById('fSubcategory');
  const currentValue=select.value;
  const options=SUBMAP[category]||['其他'];
  select.innerHTML=options.map(option=>`<option${option===currentValue?' selected':''}>${option}</option>`).join('');
}

function toggleOverdue(){
  showOverdue=!showOverdue;
  document.getElementById('overdueBtn').classList.toggle('active',showOverdue);
  applyFilters();
}

function isOverdue(record){
  if(isClosedStatus(record.status)) return false;
  const caseDate=toDateValue(record.date);
  if(!caseDate) return false;
  return (new Date()-caseDate)>7*864e5;
}

function bindModalBackdropClose(){
  ['formModal','detailModal','quickModal','historyModal','importModal'].forEach(id=>{
    const modal=document.getElementById(id);
    if(!modal) return;
    modal.addEventListener('click',event=>{
      if(event.target===event.currentTarget) modal.classList.remove('open');
    });
  });
}
