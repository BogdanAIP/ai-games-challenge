(function(){ window.FORM_ENDPOINT = window.FORM_ENDPOINT || ''; })();

function $(sel){ return document.querySelector(sel); }
function setStatus(msg){ const el=$('#join-status'); if(el){ el.className='note'; el.textContent=msg; } }
function setError(msg){ const el=$('#join-status'); if(el){ el.className='note err'; el.textContent=msg; } }
function setOk(msg){ const el=$('#join-status'); if(el){ el.className='note ok'; el.textContent=msg; } }

function genToken(){
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts  = Date.now().toString(36).toUpperCase();
  return `AIGC-${rnd}-${ts}`;
}

function jsonp(url, payload) {
  return new Promise(function(resolve, reject){
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const cleanup = () => { try{ delete window[cb]; s.remove(); }catch(e){} };
    window[cb] = function(data){ cleanup(); resolve(data); };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const s = document.createElement('script');
    s.src = url + '?callback=' + cb + '&payload=' + encoded;
    s.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
    document.head.appendChild(s);
  });
}

async function mintToken(){
  setStatus('Minting token…');
  try{
    const data = await jsonp(window.FORM_ENDPOINT, { action:'mint' });
    if(!data.ok) throw new Error(data.error || 'mint failed');
    const t = $('#token'); if(t) t.value = data.token || '';
    setOk('Token generated.');
  }catch(e){ setError('Mint error: '+e.message); }
}

async function handleSubmit(ev){
  ev.preventDefault();
  const form = ev.target;
  setStatus('Submitting…');

  const fd = new FormData(form);
  const payload = {
    team:         (fd.get('team')||'').trim(),
    country:      (fd.get('country')||'').trim(),
    contact:      (fd.get('contact')||'').trim(),
    channel_url:  (fd.get('channel_url')||'').trim(),
    playlist_url: (fd.get('playlist_url')||'').trim(),
    notes:        (fd.get('notes')||'').trim()
    // token и файл по JSONP не отправляем (токен сервер создаст сам)
  };
  for(const k of ['team','country','contact','channel_url','playlist_url']){
    if(!payload[k]){ setError('Please fill all required fields.'); return; }
  }

  try{
    const data = await jsonp(window.FORM_ENDPOINT, payload);
    if(!data.ok) throw new Error(data.error || 'registration failed');
    setOk('✅ Submitted. Registration #' + data.issue_number);
    form.reset();
    const t = $('#token'); if(t) t.value = genToken();
  }catch(e){
    setError('Submission error: ' + e.message);
  }
}

function boot(){
  // прокинем endpoint, если его задали перед этим файлом
  window.FORM_ENDPOINT = window.FORM_ENDPOINT || '';
  const form = document.getElementById('joinForm') || document.getElementById('join-form');
  if(form) form.addEventListener('submit', handleSubmit);
  const btn = document.getElementById('genTokenBtn');
  if(btn){
    const tokenEl = document.getElementById('token');
    if(tokenEl && !tokenEl.value) tokenEl.value = genToken();
    btn.addEventListener('click', function(e){ e.preventDefault(); if(tokenEl){ tokenEl.value = genToken(); tokenEl.focus(); tokenEl.select(); } });
  }
}
document.addEventListener('DOMContentLoaded', boot);
