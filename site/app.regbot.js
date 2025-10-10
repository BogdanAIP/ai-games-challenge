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
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }
  function chunkString(str, size){ const out=[]; for(let i=0;i<str.length;i+=size) out.push(str.slice(i,i+size)); return out; }

  const box = document.getElementById('regbot-box');
  const input = document.getElementById('regbot-input');
  const btnSend = document.getElementById('regbot-send');
  const btnStart= document.getElementById('regbot-start');

  let STATE = { step:0, payload:{} };

  function printQ(text){ const p = document.createElement('div'); p.className='regbot-q'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }
  function printA(text){ const p = document.createElement('div'); p.className='regbot-a'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }
  function backTo(step, prompt){ STATE.step = step; if (prompt) printQ(prompt); }

  async function sendToServer(msg){
    return await jsonpCall({ action:'register', state: STATE, reply: msg });
  }

  async function handle(msg){
    if (msg) printA(msg);
    try{
      let res = await sendToServer(msg||'');
      if (!res || res.ok === false){
        const e = String(res && res.error || 'unknown');
        if (/duplicate_team/i.test(e)) { backTo(1, 'This team name is already taken. Please enter a different team name.'); return; }
        if (/duplicate_channel_url/i.test(e)) { backTo(2, 'This YouTube channel is already registered. Please provide another channel.'); return; }
        if (/duplicate_contact/i.test(e)) { backTo(6, 'This contact is already registered. Please provide a different contact.'); return; }
        printQ('Error: ' + e);
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

  // RULES: перехват — двухфазная отправка (init + chunks + commit)
  async function sendRulesFlow(rulesText){
    try{
      if (!(rulesText && rulesText.trim().length>=500 && rulesText.trim().length<=3000)){
        printQ('Rules text must be 500–3000 characters.');
        return;
      }
      // 1) init
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
      if (!init || !init.ok){ printQ('Registration init error: ' + String((init && init.error) || '')); return; }

      // 2) chunks
      const chunks = chunkString(rulesText.trim(), 700);
      for (let i=0;i<chunks.length;i++){
        const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:chunks[i] });
        if (!put || !put.ok){ printQ('rules_put failed at chunk '+i); return; }
      }
      // 3) commit
      const fin = await jsonpCall({ action:'rules_commit', id:init.id });
      if (!fin || !fin.ok){ printQ('rules_commit failed: ' + String((fin && fin.error)||'')); return; }

      printQ('Application saved. Your token: ' + (fin.verify_token || init.verify_token) + '. Paste it into your playlist description.');
      STATE = { step:0, payload:{} };
    }catch(err){
      printQ('Network error: ' + String(err.message||err));
    }
  }

  btnStart && btnStart.addEventListener('click', async ()=>{
    box.innerHTML=''; STATE={step:0,payload:{}};
    await handle(''); // запросим первый вопрос с сервера (EN)
  });
  btnSend  && btnSend.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim();
    if (!txt) return;
    const lastQ = box.querySelector('.regbot-q:last-child');
    if (lastQ && /Paste the RULES text \(500–3000 characters\)/i.test(lastQ.textContent||'')){
      printA(txt); input.value=''; await sendRulesFlow(txt); return;
    }
    await handle(txt);
    input.value='';
  });
})();
