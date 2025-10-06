(function(){
  function endpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        const cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return window.FORM_ENDPOINT;
  }
  function jsonp(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const u = new URL(endpoint());
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false;
      window[cb] = (resp)=>{ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror = ()=>{ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to = setTimeout(()=>{ if(done) return; done=true; cleanup(); reject(new Error('timeout')); }, timeoutMs||30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  let STATE = null;
  async function send(msg){
    const root = document.getElementById('regbot-root');
    const input = document.getElementById('regbot-input');
    if (!root) return;
    const me = document.createElement('div'); me.className='bubble me'; me.textContent = msg; root.appendChild(me);
    try{
      const res = await jsonp({ action:'register', state: STATE, reply: msg }, 45000);
      if (!res || !res.ok){
        const err = document.createElement('div'); err.className='bubble bot'; err.textContent = 'Ошибка: ' + (res && res.error || 'server'); root.appendChild(err); return;
      }
      STATE = res.state || STATE;
      const bot = document.createElement('div'); bot.className='bubble bot';
      bot.textContent = res.done && res.verify_token
        ? ('Заявка принята! Ваш токен: ' + res.verify_token + ' (скопировано)')
        : (res.msg || res.ask || 'Ок');
      root.appendChild(bot);
      if (res.done && res.verify_token){ try{ navigator.clipboard.writeText(res.verify_token); }catch(_){ } }
    }catch(e){
      const err = document.createElement('div'); err.className='bubble bot'; err.textContent = 'Network error: ' + e.message; root.appendChild(err);
    }
    if (input) input.focus();
  }

  document.addEventListener('DOMContentLoaded', function(){
    const root = document.getElementById('regbot-root');
    const input = document.getElementById('regbot-input');
    const btn = document.getElementById('regbot-send');
    if (!root || !input || !btn) return;

    jsonp({ action:'register', text:'start' }).then((res)=>{
      STATE = res && res.state || null;
      const hello = document.createElement('div'); hello.className='bubble bot';
      hello.textContent = res && (res.ask || res.msg) || 'Привет! Как называется команда?';
      root.appendChild(hello);
    });

    btn.addEventListener('click', ()=>{ const v = String(input.value||'').trim(); if(!v) return; input.value=''; send(v); });
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ btn.click(); } });
  });
})();
