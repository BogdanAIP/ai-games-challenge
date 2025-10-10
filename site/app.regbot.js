(function(){
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var el = document.getElementById('site-config');
      if (el && el.textContent){
        var cfg = JSON.parse(el.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise(function(resolve,reject){
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const ep = getConfig();
      if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload));
      window[cb] = function(data){ resolve(data); cleanup(); };
      s.onerror = function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){ } try{ s.remove(); }catch(_){ } }
    });
  }
  function chunkString(str, size){ const out=[]; for(let i=0;i<str.length;i+=size) out.push(str.slice(i,i+size)); return out; }

  const box = document.getElementById('regbot-box');
  const input = document.getElementById('regbot-input');
  const btnSend = document.getElementById('regbot-send');
  const btnStart= document.getElementById('regbot-start');

  let STATE = { step:0, payload:{}, lang:'' };

  function printQ(text){ const p=document.createElement('div'); p.className='regbot-q'; p.textContent=text; box.appendChild(p); box.scrollTop=box.scrollHeight; }
  function printA(text){ const p=document.createElement('div'); p.className='regbot-a'; p.textContent=text; box.appendChild(p); box.scrollTop=box.scrollHeight; }

  async function sendToServer(msg){
    return await jsonpCall({ action:'register', state: STATE, reply: msg });
  }

  async function handle(msg){
    if (msg) printA(msg);
    try{
      let res = await sendToServer(msg||'');
      if (!res || !res.ok){
        printQ('Error: ' + (res && res.error || 'unknown'));
        return;
      }
      if (res.ask){
        printQ(res.ask);
        STATE = res.state || STATE;
        return;
      }
      if (res.done && res.verify_token){
        printQ(res.msg || ('Your token: ' + res.verify_token));
        STATE = res.state || STATE;
        return;
      }
    }catch(err){
      printQ('Network error: ' + String(err.message||err));
    }
  }

  async function sendRulesFlow(rulesText){
    try{
      if (!(rulesText.length>=500 && rulesText.length<=3000)){
        printQ(STATE.lang==='ru' ? 'Текст правил должен быть 500–3000 символов.' : 'Rules text must be 500–3000 characters.');
        return;
      }
      const init = await jsonpCall({
        action:'register_init',
        team: STATE.payload.team,
        channel_url: STATE.payload.channel_url,
        playlist_url: STATE.payload.playlist_url,
        country: STATE.payload.country,
        city: STATE.payload.city || '',
        contact: STATE.payload.contact,
        accept_rules: true,
        accept_policy: true
      });
      if (!init || !init.ok){
        // Покажем дружелюбное сообщение, если это дубли
        if (init && init.error==='duplicate'){
          const f = (STATE.lang==='ru'
            ? 'Дубликаты: ' + (init.duplicates||[]).join(', ')
            : 'Duplicate fields: ' + (init.duplicates||[]).join(', '));
          printQ(f);
        }else{
          printQ('Register init failed: ' + (init && init.error || ''));
        }
        return;
      }

      const arr = chunkString((rulesText||'').trim(), 700);
      for (let i=0;i<arr.length;i++){
        const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:arr[i] });
        if (!put || !put.ok){ printQ('rules_put failed'); return; }
      }
      const fin = await jsonpCall({ action:'rules_commit', id:init.id });
      if (!fin || !fin.ok){ printQ('rules_commit failed: ' + (fin && fin.error || '')); return; }

      const msg = (STATE.lang==='ru')
        ? ('Заявка сохранена. Ваш токен: ' + (fin.verify_token || init.verify_token) + '. Вставьте его в описание плейлиста.')
        : ('Application saved. Your token: ' + (fin.verify_token || init.verify_token) + '. Paste it into your playlist description.');
      printQ(msg);
      STATE = { step:0, payload:{}, lang:STATE.lang };
    }catch(err){
      printQ('Network error: ' + String(err.message||err));
    }
  }

  // Старт — только по кнопке, чтобы не было двойного "Choose language..."
  btnStart && btnStart.addEventListener('click', ()=>{ box.innerHTML=''; STATE={step:0,payload:{},lang:''}; handle(''); });

  btnSend && btnSend.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim();
    if (!txt) return;

    // Если пользователь вставил длинный текст — это правила → двухфазный поток
    if (txt.length >= 500){
      printA(txt);
      input.value='';
      await sendRulesFlow(txt);
      return;
    }
    // Иначе обычный диалоговый шаг
    await handle(txt);
    input.value='';
  });
})();
