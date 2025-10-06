(function(){
  const ENDPOINT = (function(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        const cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return window.FORM_ENDPOINT;
  })();

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const u = new URL(ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false;
      window[cb] = function(resp){ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror = function(){ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to = setTimeout(function(){ if(done) return; done=true; cleanup(); reject(new Error('timeout')); }, timeoutMs||30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  let REG_STATE = null;
  async function send(msg){
    const root = document.getElementById('regbot-root');
    if (!root) return;
    const echo = document.createElement('div');
    echo.className = 'bubble me';
    echo.textContent = msg;
    root.appendChild(echo);

    try{
      const res = await jsonpCall({ action:'register', state: REG_STATE, reply: msg }, 45000);
      if (!res || !res.ok){
        const err = document.createElement('div');
        err.className = 'bubble bot';
        err.textContent = 'Ошибка: ' + (res && res.error || 'server');
        root.appendChild(err);
        return;
      }
      REG_STATE = res.state || REG_STATE;
      const bot = document.createElement('div');
      bot.className = 'bubble bot';
      bot.textContent = res.done && res.verify_token
        ? ('Заявка принята! Ваш токен: ' + res.verify_token + ' (скопируйте в описание плейлиста)')
        : (res.msg || res.ask || 'Ок');
      root.appendChild(bot);
      if (res.done && res.verify_token){
        try{ navigator.clipboard.writeText(res.verify_token); }catch(_){}
      }
    }catch(err){
      const e = document.createElement('div');
      e.className = 'bubble bot';
      e.textContent = 'Network error: ' + err.message;
      root.appendChild(e);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const input = document.getElementById('regbot-input');
    const btn   = document.getElementById('regbot-send');
    const root  = document.getElementById('regbot-root');
    if (!input || !btn || !root) return;

    // старт
    jsonpCall({ action:'register', text:'start' }).then(function(res){
      REG_STATE = res && res.state || null;
      const hello = document.createElement('div');
      hello.className = 'bubble bot';
      hello.textContent = res && (res.ask || res.msg) || 'Привет! Начнем регистрацию. Как называется команда?';
      root.appendChild(hello);
    });

    btn.addEventListener('click', function(){
      const v = String(input.value||'').trim();
      if (!v) return;
      input.value = '';
      send(v);
    });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ btn.click(); }
    });
  });
})();
