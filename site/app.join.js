(function(){
  async function loadEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const el = document.getElementById('site-config');
      if (el && el.type === 'application/json'){
        const cfg = JSON.parse(el.textContent || '{}');
        if (cfg && cfg.FORM_ENDPOINT) {
          window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
          return window.FORM_ENDPOINT;
        }
      }
    }catch(_){}
    throw new Error('FORM_ENDPOINT not set');
  }

  function jsonpCall(endpoint, payload){
    return new Promise((resolve, reject)=>{
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(endpoint);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false, to;
      function cleanup(){ s.remove(); delete window[cb]; to && clearTimeout(to); }
      window[cb] = (resp)=>{ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror  = ()=>{ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      to = setTimeout(()=>{ if(done) return; done=true; cleanup(); reject(new Error('Timeout')); }, 20000);
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  function $(sel, root){ return (root||document).querySelector(sel); }

  function randomToken(){
    const hex = '0123456789ABCDEF';
    let out=''; for(let i=0;i<8;i++) out += hex[Math.floor(Math.random()*hex.length)];
    return out;
  }

  function bindRulesCounter(){
    const ta = $('#rules_text'); const cnt = $('#rules_count');
    if (!ta || !cnt) return;
    const update=()=>{ cnt.textContent = String((ta.value||'').length); };
    ta.addEventListener('input', update); update();
  }

  async function main(){
    const form = document.querySelector('form[data-join]');
    if (!form) return;

    bindRulesCounter();

    const tokenInput = $('#token', form);
    const genBtn     = $('#genTokenBtn');

    if (genBtn && tokenInput){
      genBtn.addEventListener('click', ()=>{
        tokenInput.value = randomToken();
      });
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const msg = $('#msg');

      try{
        const endpoint = await loadEndpoint();

        const fd = new FormData(form);
        const payload = {
          action: 'register_form',
          team: (fd.get('team')||'').toString().trim(),
          country: (fd.get('country')||'').toString().trim(),
          contact: (fd.get('contact')||'').toString().trim(),
          channel_url: (fd.get('channel_url')||'').toString().trim(),
          playlist_url: (fd.get('playlist_url')||'').toString().trim(),
          rules_text: (fd.get('rules_text')||'').toString().trim(),
          notes: (fd.get('notes')||'').toString().trim(),
          accept_rules: !!fd.get('accept_rules'),
          accept_policy: !!fd.get('accept_policy')
        };

        msg.textContent = 'Submitting…';
        const res = await jsonpCall(endpoint, payload);

        if (!res || !res.ok){
          msg.className = 'note err';
          msg.textContent = 'Error: ' + (res && res.error || 'unknown');
          return;
        }

        if (res.verify_token && tokenInput){
          tokenInput.value = res.verify_token;
        }

        msg.className = 'note ok';
        msg.textContent = 'Registration saved. Paste the token into your playlist description.';
        const vr = document.getElementById('verify-token');
        if (vr && res.verify_token){
          vr.textContent = 'Your verification token: ' + res.verify_token;
          vr.style.display = 'block';
        }
      }catch(err){
        msg.className = 'note err';
        msg.textContent = 'Network error: ' + (err && err.message || err);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', main);
})();
