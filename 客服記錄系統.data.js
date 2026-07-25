const SUPA_URL='https://cbnrcwujxgopuglngdlb.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibnJjd3VqeGdvcHVnbG5nZGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODE4MzEsImV4cCI6MjA5Mzg1NzgzMX0.UrFJLrIRlgImqt4KhXlwxETA0-umhNBL_8J0nif8iuE';

async function sbFetch(path,opt={}){
  const authToken=typeof getFreshAuthAccessToken==='function'
    ? await getFreshAuthAccessToken()
    : (typeof getAuthAccessToken==='function' ? getAuthAccessToken() : '');
  const bearerToken=authToken || SUPA_KEY;
  const res=await fetch(SUPA_URL+'/rest/v1/'+path,{
    headers:{
      apikey:SUPA_KEY,
      Authorization:'Bearer '+bearerToken,
      'Content-Type':'application/json',
      Prefer:'return=representation',
      ...(opt.headers||{})
    },
    ...opt
  });
  if(!res.ok){
    const errorText=await res.text();
    throw new Error(errorText);
  }
  const text=await res.text();
  return text?JSON.parse(text):[];
}

async function createCaseRecord(record){
  return sbFetch('cases',{method:'POST',body:JSON.stringify(toRow(record))});
}

async function loadLineMessageRecords(statusFilter){
  const statusQuery = statusFilter && statusFilter !== 'all'
    ? `status=eq.${encodeURIComponent(statusFilter)}&`
    : '';
  return sbFetch(`line_messages?${statusQuery}order=received_at.desc.nullslast,created_at.desc.nullslast&limit=500`);
}

async function updateLineMessageRecord(id, patch){
  return sbFetch(`line_messages?id=eq.${encodeURIComponent(id)}`,{
    method:'PATCH',
    body:JSON.stringify(patch)
  });
}

async function updateCaseRecord(record){
  return sbFetch(`cases?id=eq.${encodeURIComponent(record.id)}`,{
    method:'PATCH',
    body:JSON.stringify(toRow(record))
  });
}

async function patchCaseRecord(caseId, patch){
  return sbFetch(`cases?id=eq.${encodeURIComponent(caseId)}`,{
    method:'PATCH',
    body:JSON.stringify(patch)
  });
}

async function loadRecords(){
  setLoading(true);
  try{
    const rows=await sbFetch('cases?order=occurred_at.desc.nullslast,date.desc.nullslast&limit=1000');
    records=rows
      .map(fromRow)
      .sort((a,b)=>(toDateValue(b.date)?.getTime()||0)-(toDateValue(a.date)?.getTime()||0));
    document.getElementById('totalCount').textContent=records.length;
    applyFilters();
    renderDailyTodo();
  }catch(e){
    showToast(UI_TEXT.loadFailed+e.message,'var(--red)');
  }
  setLoading(false);
}

async function logActivity(caseId, action, detail){
  try{
    await sbFetch('activity_log',{
      method:'POST',
      body:JSON.stringify({
        case_id:caseId,
        action,
        changed_by:currentUser||'未知',
        changed_at:getLocalIsoString(),
        detail
      })
    });
  }catch(e){
    console.log('Log error:',e);
  }
}

async function loadActivityLog(){
  const tbody=document.getElementById('actlogBody');
  const empty=document.getElementById('actlogEmpty');
  tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">載入中...</td></tr>';
  try{
    const rows=await sbFetch('activity_log?order=changed_at.desc&limit=200');
    if(!rows.length){
      tbody.innerHTML='';
      empty.style.display='';
      return;
    }
    empty.style.display='none';
    const actionColors={
      [ACTIVITY_ACTION.create]:'34D399',
      [ACTIVITY_ACTION.edit]:'5B8CFF',
      [ACTIVITY_ACTION.delete]:'F87171'
    };
    tbody.innerHTML=rows.map(row=>{
      const color=actionColors[row.action]||'94A3B8';
      const rgb=color==='34D399'?'52,211,153':color==='5B8CFF'?'91,140,255':'248,113,113';
      const changedAt=row.changed_at
        ? new Date(row.changed_at).toLocaleString('zh-TW',{hour12:false}).replace(/\//g,'-')
        : '—';
      return `<tr>
        <td style="font-size:11px;color:var(--text2);white-space:nowrap">${changedAt}</td>
        <td><span class="badge" style="background:rgba(${rgb},.15);color:#${color}">${row.action}</span></td>
        <td><span class="mono">${row.case_id||'—'}</span></td>
        <td style="font-size:12px">${row.changed_by||'—'}</td>
        <td style="font-size:11px;color:var(--text2)">${row.detail||'—'}</td>
      </tr>`;
    }).join('');
  }catch(e){
    tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--red);padding:20px">載入失敗</td></tr>';
  }
}
