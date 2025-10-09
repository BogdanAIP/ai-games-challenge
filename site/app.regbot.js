(function(){
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const el = document.getElementById('site-config');
      if (el && el.textContent){
        const cfg = JSON.parse(el.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise((resolve,reject)=>{
      const ep = getConfig();
      if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload));
      window[cb] = (data)=>{ resolve(data); cleanup(); };
      s.onerror = ()=>{ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }

  // === ensure UI exists ===
  function ensureBotUI(){
    let box = document.getElementById('regbot-box');
    let input = document.getElementById('regbot-input');
    let send = document.getElementById('regbot-send');
    let start= document.getElementById('regbot-start');

    if (!box){
      // создаём секцию под формой
      const form = document.querySelector('form[data-join]') || document.body;
      const sec = document.createElement('section');
      sec.id = 'regbot-section';
      sec.style.marginTop = '28px';
      sec.innerHTML = `
        <h3>AI Registration Assistant</h3>
        <p class="note">Assistant collects: team, country, contact, channel, playlist, and short rules (required).</p>
        <div id="regbot-box" aria-live="polite" style="border:1px solid #2b2f31;border-radius:12px;padding:12px;height:260px;overflow:auto;background:#0e0f10;margin-top:8px"></div>
        <div class="regbot-row" style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-top:8px">
          <input id="regbot-input" placeholder="Answer the bot…" style="padding:.75rem;border:1px solid #2b2f31;border-radius:10px;background:#111;color:#fff"/>
          <button class="btn" id="regbot-send" type="button">Send</button>
          <button class="btn btn-secondary" id="regbot-start" type="button">Start</button>
        </div>`;
      form.parentNode.insertBefore(sec, form.nextSibling);
      // requery
      box = sec.querySelector('#regbot-box');
      input = sec.querySelector('#regbot-input');
      send = sec.querySelector('#regbot-send');
      start= sec.querySelector('#regbot-start');
    }
    return { box, input, send, start };
  }

  const ui = ensureBotUI();
  const box = ui.box, input = ui.input, btnSend = ui.send, btnStart = ui.start;

  let STATE = { step:0, payload:{}, lang:'' };

  function printQ(text){ const p = document.createElement('div'); p.className='regbot-q'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }
  function printA(text){ const p = document.createElement('div'); p.className='regbot-a'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }

  async function sendToServer(msg){
    return await jsonpCall({ action:'register', state: STATE, reply: msg });
  }

  async function handle(msg){
    if (msg) printA(msg);
    try{
      const res = await sendToServer(msg||'');
      if (!res || !res.ok){ printQ('Error: ' + (res && res.error || 'unknown')); return; }

      if (res.ask){
        printQ(res.ask);
        STATE = res.state || STATE;
        return;
      }
      if (res.done && res.verify_token){
        printQ(res.msg || ('Your token: ' + res.verify_token));
        STATE = res.state || STATE;
      }
    }catch(err){
      printQ('Network error: ' + String(err.message||err));
    }
  }

  btnStart && btnStart.addEventListener('click', ()=>{ box.innerHTML=''; STATE={step:0,payload:{},lang:''}; handle(''); });
  btnSend  && btnSend.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim();
    if (!txt) return;
    await handle(txt);
    input.value='';
  });

  // автозапуск, если пусто
  if (!box.innerHTML.trim()){ handle(''); }
})();
