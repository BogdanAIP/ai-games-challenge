(function(){
  // Единая точка правды: window.FORM_ENDPOINT
  // Если не задан извне — останется плейсхолдер, заменим ниже sed-ом.
  if (!window.FORM_ENDPOINT) window.FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbx81KK5qfSzIpRHLyemRPfafF3f-zCsHlaQVMh3Z0p68CTHcjp8RWz-9WG2OtsbYQX0/exec";
  // Защитимся от случайных одинарных кавычек вокруг строки:
  window.FORM_ENDPOINT = String(window.FORM_ENDPOINT).replace(/^'+|'+$/g, '');
})();

/* Join form (JSONP) — без CORS / preflight.
 * На сервер уйдут: team, country, contact, channel_url, playlist_url, notes.
 * Файл через JSONP не отправляем (слишком большой для query-string).
 */
function $(sel){ return document.querySelector(sel); }

function setMsg(text, kind){
  const el = $('#msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'note ' + (kind || '');
}

function genToken(){
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts  = Date.now().toString(36).toUpperCase();
  return `AIGC-${rnd}-${ts}`;
}

function jsonpCall(payload, timeoutMs){
  return new Promise(function(resolve, reject){
    const cbName = 'cb_' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const url = new URL(window.FORM_ENDPOINT);
    url.searchParams.set('callback', cbName);
    url.searchParams.set('payload', JSON.stringify(payload));

    let done = false;
    window[cbName] = function(resp){
      if (done) return;
      done = true;
      resolve(resp);
      cleanup();
    };

    function cleanup(){
      delete window[cbName];
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    s.onerror = function(){
      if (done) return;
      done = true;
      reject(new Error('JSONP load error'));
      cleanup();
    };

    document.head.appendChild(s);

    const to = setTimeout(function(){
      if (done) return;
      done = true;
      reject(new Error('JSONP timeout'));
      cleanup();
    }, timeoutMs || 20000);

    // если всё закончилось — снимаем таймер
    const oldCB = window[cbName];
    window[cbName] = function(x){
      clearTimeout(to);
      return oldCB(x);
    };
    s.src = url.toString();
  });
}

async function mintToken(){
  setMsg('Minting token…', 'info');
  try{
    const data = await jsonpCall({ action:'mint' });
    if (!data || !data.ok || !data.token) throw new Error(data && data.error || 'mint failed');
    const t = $('#token'); if (t) t.value = data.token;
    setMsg('Token generated.', 'ok');
  }catch(err){
    setMsg('Mint error: ' + err.message, 'err');
  }
}

async function handleSubmit(ev){
  ev.preventDefault();
  setMsg('Submitting…', 'info');

  const fd = new FormData(ev.target);
  const required = ['team','country','contact','channel_url','playlist_url'];
  for (const k of required){
    const v = (fd.get(k) || '').toString().trim();
    if (!v){ setMsg('Please fill all required fields.', 'err'); return; }
  }

  // JSONP-вариант: файл не шлём (слишком велик для URL). Сообщим пользователю.
  const file = fd.get('rules_file');
  if (file && file.size){
    setMsg('Note: rules file is not sent via web form (JSONP). We will request it later.', 'info');
  }

  const payload = {
    team:         fd.get('team'),
    country:      fd.get('country'),
    contact:      fd.get('contact'),
    channel_url:  fd.get('channel_url'),
    playlist_url: fd.get('playlist_url'),
    notes:        fd.get('notes') || ''
    // token — только для UX, сервер всё равно генерирует свой
  };

  try{
    const data = await jsonpCall(payload);
    if (!data || !data.ok) throw new Error((data && data.error) || 'Server error');
    setMsg('✅ Submitted. Registration #' + data.issue_number + (data.issue_url ? (' — ' + data.issue_url) : ''), 'ok');
    ev.target.reset();
    const t = $('#token'); if (t) t.value = genToken();
  }catch(err){
    setMsg('Submission error: ' + err.message, 'err');
  }
}

function boot(){
  const t = $('#token');
  if (t && !t.value) t.value = genToken();
  const b = document.getElementById('genTokenBtn');
  if (b) b.addEventListener('click', function(){ const t=$('#token'); t.value=genToken(); t.focus(); t.select(); });
  const f = document.getElementById('joinForm');
  if (f) f.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', boot);
