(function(){
  const ENDPOINT = String(window.FORM_ENDPOINT || "https://script.google.com/macros/s/AKfycbyv25wZctxwL36v1Fs8w6NCKL4pAzGq7iZ8XPmptmqx3FD_u_fUZy4wnVO5MumdrtuB/exec").replace(/^'+|'+$/g,'');

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));

      let done = false;
      window[cb] = function(resp){
        if (done) return;
        done = true;
        resolve(resp);
        cleanup();
      };
      function cleanup(){ delete window[cb]; s.remove(); }

      s.onerror = function(){
        if (done) return;
        done = true;
        reject(new Error('JSONP load error'));
        cleanup();
      };

      document.head.appendChild(s);

      const to = setTimeout(function(){
        if (done) return;
        done = true;
        reject(new Error('JSONP timeout'));
        cleanup();
      }, timeoutMs || 20000);

      const old = window[cb];
      window[cb] = function(x){ clearTimeout(to); return old(x); };

      s.src = u.toString();
    });
  }

  function $(s){ return document.querySelector(s); }

  async function onFaqSubmit(e){
    e.preventDefault();
    const input = $('#faq-input');
    const box   = $('#faq-box');
    const q = (input.value||'').trim();
    if (!q) return;

    input.disabled = true;
    box.insertAdjacentHTML('beforeend', `<div class="faq-q">🧑 ${q}</div><div class="faq-a">🤖 …</div>`);

    try{
      const res = await jsonpCall({ action:'faq', question: q });
      const a = box.querySelector('.faq-a:last-child');
      a.textContent = '🤖 ' + (res.answer || res.text || '[no answer]');
    }catch(err){
      const a = box.querySelector('.faq-a:last-child');
      a.textContent = '❌ ' + err.message;
    }finally{
      input.disabled = false;
      input.value = '';
      input.focus();
      box.scrollTop = box.scrollHeight;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const f = document.getElementById('faq-form');
    if (f) f.addEventListener('submit', onFaqSubmit);
  });
})();
