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
  window.FORM_ENDPOINT = getConfig();
})();

function $(s){ return document.querySelector(s); }

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
    const to = setTimeout(function(){
      if (done) return;
      done = true;
      reject(new Error('JSONP timeout'));
      cleanup();
    }, timeoutMs || 30000);

    const old = window[cbName];
    window[cbName] = function(x){ clearTimeout(to); return old(x); };

    s.src = url.toString();
    document.head.appendChild(s);
  });
}

async function askFaq(){
  const input = $('#faq-input');
  const out   = $('#faq-out');
  const q = (input && input.value || '').trim();
  if (!q){ out.textContent = 'Введите вопрос…'; return; }
  out.textContent = 'Думаю…';
  try{
    const res = await jsonpCall({ action:'faq', question:q });
    if (!res || !res.ok){
      out.textContent = 'Ошибка: ' + (res && res.error || 'server');
      return;
    }
    out.textContent = res.answer || '[нет ответа]';
  }catch(err){
    out.textContent = 'Сеть/JSONP ошибка: ' + err.message;
  }
}

function bootFaq(){
  const btn = document.getElementById('faq-ask');
  if (btn) btn.addEventListener('click', askFaq);
  const inp = document.getElementById('faq-input');
  if (inp) inp.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter'){ ev.preventDefault(); askFaq(); }
  });
}
document.addEventListener('DOMContentLoaded', bootFaq);
