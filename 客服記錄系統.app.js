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
  if(viewName==='line-import' && typeof renderLineImport==='function') renderLineImport();
}

function updateSub(){
  const category=document.getElementById('fCategory').value;
  const select=document.getElementById('fSubcategory');
  const currentValue=select.value;
  const options=SUBMAP[category]||['其他'];
  select.innerHTML=options.map(option=>`<option${option===currentValue?' selected':''}>${option}</option>`).join('');
  toggleSubcategoryNote();
}

function toggleSubcategoryNote(){
  const category=document.getElementById('fCategory');
  const subcategory=document.getElementById('fSubcategory');
  const group=document.getElementById('fSubcategoryNoteGroup');
  const input=document.getElementById('fSubcategoryNote');
  if(!category || !subcategory || !group || !input) return;
  const isOther=category.value==='其他' || subcategory.value==='其他';
  group.style.display=isOther?'':'none';
  input.required=isOther;
  if(!isOther) input.value='';
}

function setSubcategoryNote(value=''){
  const input=document.getElementById('fSubcategoryNote');
  if(input) input.value=value||'';
  toggleSubcategoryNote();
}

function toggleOverdue(){
  showOverdue=!showOverdue;
  const overdueBtn=document.getElementById('overdueBtn');
  if(overdueBtn) overdueBtn.classList.toggle('active',showOverdue);
  applyFilters();
}

function isOverdue(record){
  if(isClosedStatus(record.status)) return false;
  const caseDate=toDateValue(record.date);
  if(!caseDate) return false;
  return (new Date()-caseDate)>7*864e5;
}

function bindModalBackdropClose(){
  ['formModal','detailModal','quickModal','historyModal','importModal','lineDetailModal'].forEach(id=>{
    const modal=document.getElementById(id);
    if(!modal) return;
    modal.addEventListener('click',event=>{
      if(event.target===event.currentTarget) modal.classList.remove('open');
    });
  });
}
