(function(){
  function debounce(fn, ms){ let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms);}; }

  function qs(p,sel){ return (p||document).querySelector(sel); }
  function getEndpoint(){
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
      const ep = getEndpoint(); if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload)) + '&t=' + Date.now();
      window[cb] = function(data){ resolve(data); cleanup(); };
      s.onerror = function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }
  function chunkString(str, size){ const out=[]; for(let i=0;i<str.length;i+=size) out.push(str.slice(i,i+size)); return out; }
  function setFieldError(form, name, msg){
    const box = qs(form, '[data-err-for="'+name+'"]'); if (box){ box.textContent = msg||''; }
  }
  async function checkUnique(form){
    const fd = new FormData(form);
    const res = await jsonpCall({
      action:'check_unique',
      team: String(fd.get('team')||'').trim(),
      channel_url: String(fd.get('channel_url')||'').trim(),
      contact: String(fd.get('contact')||'').trim()
    });
    if (!res || !res.ok) return;
    setFieldError(form, 'team',        res.exists_team    ? 'This team name is already registered.' : '');
    setFieldError(form, 'channel_url', res.exists_channel ? 'This channel is already registered.'   : '');
    setFieldError(form, 'contact',     res.exists_contact ? 'This contact is already registered.'   : '');
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = qs(document,'form[data-join]'); if (!form) return;

    const tokenEl  = qs(form,'#token');
    const genBtn   = qs(document,'#genTokenBtn');
    const rulesTa  = qs(form,'#rules_text');
    const rulesCnt = qs(document,'#rules_count');
    const msgEl    = qs(document,'#msg');
    const resultEl = qs(document,'#join-result');
    const verifyEl = qs(document,'#verify-token');

    if (genBtn && tokenEl){
      genBtn.addEventListener('click', ()=>{ tokenEl.value = Math.random().toString(16).slice(2,10).toUpperCase(); });
    }
    if (rulesTa && rulesCnt){
      const upd=()=>{ rulesCnt.textContent = (rulesTa.value||'').length; };
      rulesTa.addEventListener('input',upd); upd();
    }

    // inline-проверка дублей
    ['team','channel_url','contact'].forEach(name=>{
      const el = qs(form, `[name=${name}]`); if (!el) return;
      el.addEventListener('blur', ()=>{ checkUnique(form).catch(()=>{}); });
      el.addEventListener('input', ()=>{ setFieldError(form, name, ''); });
    });

    /* dup listeners */
    const teamIn = qs(form,'[name=team]');
    const chIn   = qs(form,'[name=channel_url]');
    const ctIn   = qs(form,'[name=contact]');

    async function check(field, value, input){
      if(!value){ input.setCustomValidity(''); ensureHint(input).textContent=''; return; }
      try{
        const res = await jsonpCall({ action:'dup_check', field, value });
        if(!res || res.ok===false){ input.setCustomValidity(''); ensureHint(input).textContent=''; return; }
        if(field==='channel_url' && res.normalized){ input.value = res.normalized; }
        if(res.duplicate){ input.setCustomValidity('Already registered'); ensureHint(input).textContent = 'Already registered'; }
        else if(res.valid===false){ input.setCustomValidity('Invalid value'); ensureHint(input).textContent = 'Invalid value'; }
        else { input.setCustomValidity(''); ensureHint(input).textContent='✔ looks good'; }
        input.reportValidity();
      }catch(_){ input.setCustomValidity(''); ensureHint(input).textContent=''; }
    }

    if(teamIn) teamIn.addEventListener('input', debounce(()=>check('team', teamIn.value.trim(), teamIn), 400));
    if(chIn)   chIn.addEventListener('input',   debounce(()=>check('channel_url', chIn.value.trim(), chIn), 400));
    if(ctIn)   ctIn.addEventListener('input',   debounce(()=>check('contact', ctIn.value.trim(), ctIn), 400));

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msgEl.textContent = ''; resultEl.textContent=''; verifyEl.textContent='';

      // финальная проверка дублей
      try{ await checkUnique(form); }catch(_){}

      const fd = new FormData(form);
      const rules = String(fd.get('rules_text')||'').trim();
      if (!(rules.length>=500 && rules.length<=3000)){
        setFieldError(form,'rules_text','Rules text must be 500–3000 characters.');
        return;
      }

      // проверим, есть ли явные ошибки inline
      const errs = Array.from(form.querySelectorAll('.field-err')).some(d=>d.textContent && d.textContent.trim().length>0);
      if (errs){ msgEl.textContent='Please fix highlighted fields.'; return; }

      try{
        const init = await jsonpCall({
          action:'register_init',
          team:String(fd.get('team')||'').trim(),
          channel_url:String(fd.get('channel_url')||'').trim(),
          playlist_url:String(fd.get('playlist_url')||'').trim(),
          contact:String(fd.get('contact')||'').trim(),
          country:String(fd.get('country')||'').trim(),
          city:String(fd.get('city')||'').trim(),
          accept_rules: !!fd.get('accept_rules'),
          accept_policy:!!fd.get('accept_policy')
        });
        if (!init || !init.ok){
          if (init && init.code==='duplicate_team') setFieldError(form,'team','This team name is already registered.');
          if (init && init.code==='duplicate_channel') setFieldError(form,'channel_url','This channel is already registered.');
          if (init && init.code==='duplicate_contact') setFieldError(form,'contact','This contact is already registered.');
          throw new Error(init && init.error || 'Register init failed');
        }

        const chunks = chunkString(rules, 700);
        for (let i=0;i<chunks.length;i++){
          const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:chunks[i] });
          if (!put || !put.ok) throw new Error('rules_put failed at '+i);
        }
        const fin = await jsonpCall({ action:'rules_commit', id:init.id });
        if (!fin || !fin.ok) throw new Error(fin && fin.error || 'rules_commit failed');

        resultEl.textContent = 'Registration submitted. Your token has been generated.';
        verifyEl.textContent = 'Verification token: ' + (fin.verify_token || init.verify_token || '(check email/DM)');
        if (tokenEl) tokenEl.value = (fin.verify_token || init.verify_token || '');

        // мягко обновим рейтинг (если открыт в другой вкладке)
        try{ await jsonpCall({ action:'lb_refresh' }); }catch(_){}
      }catch(err){
        msgEl.textContent = 'Network or API error: ' + String(err.message||err);
      }
    });
  });
})();
