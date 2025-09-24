(function(){ window.window.FORM_ENDPOINT = window.window.FORM_ENDPOINT || 'https://script.google.com/macros/s/AKfycbx81KK5qfSzIpRHLyemRPfafF3f-zCsHlaQVMh3Z0p68CTHcjp8RWz-9WG2OtsbYQX0/exec'; })();
/* Join form client — no-preflight (text/plain), sends JSON string.
 * Требуются поля с id: team, country, contact, channel_url, playlist_url, notes, rules_file
 * Кнопки/элементы: #btn-mint (Generate token), #token (read-only), #join-form, #join-status
 */

function $(sel){ return document.querySelector(sel); }

async function mintToken(){
  setStatus('Minting token…');
  const resp = await fetch(window.FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'text/plain; charset=utf-8' },
    body: JSON.stringify({ action:'mint' })
  });
  const text = await resp.text();
  let data; try{ data = JSON.parse(text) }catch(e){
    setError('Endpoint did not return JSON for mint(). Check window.FORM_ENDPOINT.\n'+text);
    return;
  }
  if(!data.ok){ setError('Mint error: '+(data.error||'unknown')); return; }
  const t = $('#token'); if(t) t.value = data.token || '';
  setOk('Token generated.');
}

function setStatus(msg){ const el=$('#join-status'); if(el){ el.className='info'; el.textContent=msg; } }
function setError(msg){ const el=$('#join-status'); if(el){ el.className='error'; el.textContent=msg; } }
function setOk(msg){ const el=$('#join-status'); if(el){ el.className='ok'; el.textContent=msg; } }

async function toBase64(file){
  if(!file) return null;
  const buf = await file.arrayBuffer();
  const bin = new Uint8Array(buf);
  // base64 без лишних зависимостей
  let s = ''; for(let i=0;i<bin.length;i++) s += String.fromCharCode(bin[i]);
  return btoa(s);
}

async function handleSubmit(ev){
  ev.preventDefault();
  setStatus('Submitting…');

  const payload = {
    team:         $('#team')?.value?.trim() || '',
    country:      $('#country')?.value?.trim() || '',
    contact:      $('#contact')?.value?.trim() || '',
    channel_url:  $('#channel_url')?.value?.trim() || '',
    playlist_url: $('#playlist_url')?.value?.trim() || '',
    notes:        $('#notes')?.value?.trim() || ''
    // token клиент может показать участнику, но сервер генерирует свой — не отправляем
  };

  // файл правил (опционально)
  const fileEl = $('#rules_file');
  if(fileEl && fileEl.files && fileEl.files[0]){
    const f = fileEl.files[0];
    const b64 = await toBase64(f);
    payload.file = { name: f.name, mime: f.type || 'application/octet-stream', base64: b64 };
  }

  // простая клиентская проверка
  for(const k of ['team','country','contact','channel_url','playlist_url']){
    if(!payload[k]){ setError(`Missing field: ${k}`); return; }
  }

  const resp = await fetch(window.FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'text/plain; charset=utf-8' }, // simple request → без preflight
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  let data; try{ data = JSON.parse(text) }catch(e){
    setError('Endpoint did not return JSON (check for echo/stub or wrong URL):\n'+text);
    return;
  }

  if(!data.ok){
    setError(`Submission error: ${data.error || 'unknown'}`);
    return;
  }

  // успех
  setOk('Registered! Your issue #' + data.issue_number + (data.issue_url ? (' — '+data.issue_url) : ''));
  ev.target.reset();
}

function boot(){
  const form = $('#join-form');
  if(form){ form.addEventListener('submit', handleSubmit); }
  const mintBtn = $('#btn-mint');
  if(mintBtn){ mintBtn.addEventListener('click', (e)=>{ e.preventDefault(); mintToken(); }); }
}

document.addEventListener('DOMContentLoaded', boot);
