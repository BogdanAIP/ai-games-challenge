(function(){
  const ENDPOINT = String(
    window.FORM_ENDPOINT ||
    "https://script.google.com/macros/s/AKfycbyv25wZctxwL36v1Fs8w6NCKL4pAzGq7iZ8XPmptmqx3FD_u_fUZy4wnVO5MumdrtuB/exec"
  ).replace(/^'+|'+$/g,'');

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false;
      window[cb] = function(resp){ if (done) return; done = true; resolve(resp); cleanup(); };
      function cleanup(){ try{ delete window[cb]; }catch(_){ window[cb]=undefined; } if (s && s.parentNode) s.parentNode.removeChild(s); }
      s.onerror = function(){ if (done) return; done=true; reject(new Error('JSONP load error')); cleanup(); };
      document.head.appendChild(s);
      const to = setTimeout(function(){ if (done) return; done = true; reject(new Error('JSONP timeout')); cleanup(); }, timeoutMs || 20000);
      const old = window[cb]; window[cb] = x => { clearTimeout(to); return old(x); };
      s.src = u.toString();
    });
  }

  function box(){ return document.getElementById('regbot-box'); }
  function add(text, who){
    const d = document.createElement('div');
    d.className = (who==='bot' ? 'regbot-a' : 'regbot-q');
    d.textContent = (who==='bot' ? '🤖 ' : '🧑 ') + text;
    box().appendChild(d);
    box().scrollTop = box().scrollHeight;
  }

  let REG_STATE = null;

  async function startDialog(){
    const container = box(); if (!container) return;
    container.innerHTML = '';
    REG_STATE = { step:0, payload:{} };
    add('Запускаю диалог регистрации.', 'bot');
    try{
      const res = await jsonpCall({ action:'register', state: REG_STATE });
      REG_STATE = res.state || REG_STATE;
      if (res.ask) add(res.ask, 'bot');
    }catch(e){ add('Сбой: ' + e.message, 'bot'); }
  }

  async function sendReply(){
    const inp = document.getElementById('regbot-input'); if (!inp) return;
    const msg = (inp.value || '').trim(); if (!msg) return;
    add(msg, 'user'); inp.value='';
    try{
      const res = await jsonpCall({ action:'register', state: REG_STATE, reply: msg });
      if (res.error){ add('Ошибка: ' + res.error, 'bot'); return; }
      REG_STATE = res.state || REG_STATE;
      if (res.done){
        add(res.message || 'Готово!', 'bot');
        if (res.issue_url) add('Issue: ' + res.issue_url, 'bot');
        if (res.token)     add('Ваш токен: ' + res.token, 'bot');
        return;
      }
      if (res.ask) add(res.ask, 'bot');
    }catch(e){ add('Сбой: ' + e.message, 'bot'); }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const startBtn = document.getElementById('regbot-start');
    const sendBtn  = document.getElementById('regbot-send');
    const input    = document.getElementById('regbot-input');
    if (startBtn) startBtn.addEventListener('click', startDialog);
    if (sendBtn)  sendBtn.addEventListener('click', sendReply);
    if (input)    input.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); sendReply(); } });
  });
})();
