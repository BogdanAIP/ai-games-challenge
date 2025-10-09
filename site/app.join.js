(function(){
  function qs(p,sel){ return (p||document).querySelector(sel); }
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

  async function main(){
    const form = qs(document,'form[data-join]');
    if (!form) return;

    const tokenEl = qs(form,'#token');
    const genBtn  = document.getElementById('genTokenBtn');
    const rulesTa = document.getElementById('rules_text');
    const rulesCounter = document.getElementById('rules_count');
    const msgEl   = document.getElementById('msg');
    const resultEl= document.getElementById('join-result');
    const verifyEl= document.getElementById('verify-token');

    if (genBtn && tokenEl){
      genBtn.addEventListener('click', ()=> {
        tokenEl.value = Math.random().toString(16).slice(2,10).toUpperCase();
      });
    }
    if (rulesTa && rulesCounter){
      const upd=()=>{ rulesCounter.textContent = (rulesTa.value||'').length; };
      rulesTa.addEventListener('input',upd); upd();
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msgEl.textContent = ''; resultEl.textContent = ''; verifyEl.textContent = '';

      const fd = new FormData(form);
      const rules_text = String(fd.get('rules_text')||'').trim();
      if (!(rules_text.length>=500 && rules_text.length<=3000)){
        msgEl.textContent = 'Rules text must be 500–3000 characters.';
        return;
      }

      const initPayload = {
        action: 'register_init',
        team: String(fd.get('team')||'').trim(),
        channel_url: String(fd.get('channel_url')||'').trim(),
        playlist_url:String(fd.get('playlist_url')||'').trim(),
        contact:     String(fd.get('contact')||'').trim(),
        country:     String(fd.get('country')||'').trim(),
        city:        String(fd.get('city')||'').trim(),
        accept_rules: !!fd.get('accept_rules'),
        accept_policy:!!fd.get('accept_policy'),
      };

      try{
        const init = await jsonpCall(initPayload);
        if (!init || !init.ok) throw new Error(init && init.error || 'Register init failed');

        const chunks = chunkString(rules_text, 700);
        for (let i=0;i<chunks.length;i++){
          const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:chunks[i] });
          if (!put || !put.ok) throw new Error(put && put.error || ('rules_put failed at '+i));
        }

        const fin = await jsonpCall({ action:'rules_commit', id:init.id });
        if (!fin || !fin.ok) throw new Error(fin && fin.error || 'rules_commit failed');

        resultEl.textContent = 'Registration submitted. Your token has been generated.';
        verifyEl.textContent = 'Verification token: ' + (fin.verify_token || init.verify_token || '(see email/DM)');
        if (tokenEl) tokenEl.value = (fin.verify_token || init.verify_token || '');

      }catch(err){
        msgEl.textContent = 'Network or API error: ' + String(err.message||err);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', main);
})();
