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

  const box = document.getElementById('regbot-box');
  const input = document.getElementById('regbot-input');
  const btnSend = document.getElementById('regbot-send');
  const btnStart= document.getElementById('regbot-start');

  let STATE = { step:0, payload:{}, lang:'' };

  function printQ(text){ const p = document.createElement('div'); p.className='regbot-q'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }
  function printA(text){ const p = document.createElement('div'); p.className='regbot-a'; p.textContent=text; box.appendChild(p); box.scrollTop = box.scrollHeight; }

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
      // шаг вопросов обычного диалога
      if (res.ask){
        printQ(res.ask);
        STATE = res.state || STATE;
        return;
      }
      // финал: сервер прислал done+token (на случай старого пути)
      if (res.done && res.verify_token){
        printQ(res.msg || ('Your token: ' + res.verify_token));
        STATE = res.state || STATE;
        return;
      }
    }catch(err){
      printQ('Network error: ' + String(err.message||err));
    }
  }

  // перехват шага с правилами не требуется — диалог уже возвращает финал через server (оставлено на будущее)

  btnStart && btnStart.addEventListener('click', ()=>{ box.innerHTML=''; STATE={step:0,payload:{},lang:''}; handle(''); });
  btnSend  && btnSend.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim();
    if (!txt) return;
    await handle(txt);
    input.value='';
  });
})();
