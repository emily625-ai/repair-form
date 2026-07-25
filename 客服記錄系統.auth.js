const AUTH_STORAGE_KEY = 'cs_system_auth_session';

let authSession = null;

function getAuthSession(){
  return authSession;
}

function getAuthAccessToken(){
  return authSession?.access_token || '';
}

function isAuthenticated(){
  return !!getAuthAccessToken();
}

function loadStoredAuthSession(){
  try{
    const raw=localStorage.getItem(AUTH_STORAGE_KEY);
    if(!raw) return null;
    const session=JSON.parse(raw);
    if(!session?.access_token || !session?.expires_at) return null;
    if(Date.now() >= Number(session.expires_at)){
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    if(typeof currentUser!=='undefined'){
      currentUser=session?.user?.email || '系統';
    }
    return session;
  }catch(e){
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function saveAuthSession(session){
  authSession=session;
  if(typeof currentUser!=='undefined'){
    currentUser=session?.user?.email || '系統';
  }
  localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(session));
}

function clearAuthSession(){
  authSession=null;
  if(typeof currentUser!=='undefined'){
    currentUser='系統';
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function signInWithPassword(email,password){
  const res=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{
      apikey:SUPA_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });
  const payload=await res.json().catch(()=>({}));
  if(!res.ok){
    throw new Error(payload.error_description || payload.msg || payload.error || '登入失敗');
  }
  if(!payload.access_token){
    throw new Error('登入成功但沒有取得 access token');
  }
  const expiresIn=Number(payload.expires_in || 3600);
  saveAuthSession({
    access_token:payload.access_token,
    refresh_token:payload.refresh_token || '',
    expires_at:Date.now()+(expiresIn*1000)-60000,
    user:payload.user || null
  });
  return authSession;
}

function setAuthMessage(message,type='info'){
  const box=document.getElementById('authMessage');
  if(!box) return;
  box.textContent=message || '';
  box.dataset.type=type;
  box.style.display=message?'block':'none';
}

function updateAuthUserLabel(){
  const label=document.getElementById('authUserLabel');
  if(!label) return;
  const email=authSession?.user?.email || '';
  label.textContent=email ? `登入：${email}` : '';
}

function showLoginGate(){
  document.body.classList.add('auth-locked');
  document.body.classList.remove('auth-ready');
  updateAuthUserLabel();
}

function showAppAfterLogin(){
  document.body.classList.remove('auth-locked');
  document.body.classList.add('auth-ready');
  updateAuthUserLabel();
}

async function handleLoginSubmit(event){
  event.preventDefault();
  const email=document.getElementById('authEmail')?.value.trim();
  const password=document.getElementById('authPassword')?.value || '';
  const button=document.getElementById('authLoginBtn');
  if(!email || !password){
    setAuthMessage('請輸入 Email 與密碼。','error');
    return;
  }
  if(button) button.disabled=true;
  setAuthMessage('登入中...','info');
  try{
    await signInWithPassword(email,password);
    setAuthMessage('', 'info');
    showAppAfterLogin();
    if(typeof initializeAppAfterAuth==='function') await initializeAppAfterAuth();
  }catch(e){
    setAuthMessage(e.message || '登入失敗，請確認帳號密碼。','error');
  }finally{
    if(button) button.disabled=false;
  }
}

function logout(){
  clearAuthSession();
  showLoginGate();
}

async function requireAuthBeforeInit(){
  authSession=loadStoredAuthSession();
  const form=document.getElementById('authForm');
  if(form) form.addEventListener('submit',handleLoginSubmit);
  if(authSession){
    showAppAfterLogin();
    if(typeof initializeAppAfterAuth==='function') await initializeAppAfterAuth();
    return;
  }
  showLoginGate();
}
