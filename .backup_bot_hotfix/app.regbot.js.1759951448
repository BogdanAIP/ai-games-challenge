(function(){
  // ==== tiny JSONP helper ====
  async function jsonpCall(payload){
    const ep = window.FORM_ENDPOINT || (function(){
      try{
        const cfgEl = document.getElementById('site-config');
        if (cfgEl && cfgEl.type === 'application/json') {
          const cfg = JSON.parse(cfgEl.textContent||cfgEl.innerText||'{}');
          if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
        }
      }catch(_){}
      return '';
    })();
    if (!ep) throw new Error('FORM_ENDPOINT not set');

    const cbName = 'cb_' + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const cleanup = () => { try{ delete window[cbName]; }catch(_){ } if (s && s.parentNode) s.parentNode.removeChild(s); };
      const url = new URL(ep);
      url.searchParams.set('callback', cbName);
      url.searchParams.set('payload', JSON.stringify(payload||{}));
      window[cbName] = (data) => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error('Network error')); };
      s.src = url.toString();
      document.head.appendChild(s);
    });
  }

  // ==== UI wiring ====
  const box = document.getElementById('regbot-box');
  const input = document.getElementById('regbot-input');
  const btnSend = document.getElementById('regbot-send');
  const btnStart = document.getElementById('regbot-start');

  let REG_STATE = { step: 0, payload: {}, lang: '' };

  function addLine(cls, text){
    const p = document.createElement('div');
    p.className = cls;
    p.textContent = String(text||'');
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
  }

  function showAsk(resp){
    if (resp && resp.ask) addLine('regbot-q', resp.ask);
  }

  function showDone(resp){
  if (resp && resp.msg) addLine("regbot-q", resp.msg);
  if (resp && resp.verify_token){
    const tokenInp = document.getElementById("token");
    if (tokenInp && !tokenInp.value) tokenInp.value = String(resp.verify_token);
  }
}
  }

  async function start(){
    REG_STATE = { step: 0, payload: {}, lang: REG_STATE.lang || '' };
    box.innerHTML = '';
    addLine('regbot-q', '…');
    try{
      const res = await jsonpCall({ action:'register', state: REG_STATE });
      addLine('regbot-q', ''); // replace the ellipsis line spacing
      REG_STATE = res && res.state || REG_STATE;
      showAsk(res);
    }catch(err){
      addLine('regbot-q', 'Network error. Try again.');
    }
  }

  async function send(){
    const val = String(input.value||'').trim();
    if (!val) return;
    addLine('regbot-a', val);
    input.value = '';
    try{
      const res = await jsonpCall({ action:'register', state: REG_STATE, reply: val });
      REG_STATE = res && res.state || REG_STATE;
      if (res && res.done){
        showDone(res);
      }else{
        showAsk(res);
      }
    }catch(err){
      addLine('regbot-q', 'Network error. Try again.');
    }
  }

  if (btnStart) btnStart.addEventListener('click', start);
  if (btnSend) btnSend.addEventListener('click', send);
})();
