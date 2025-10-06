(function(){
  function cfgEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const tag=document.getElementById('site-config');
      if(tag&&tag.textContent){ const c=JSON.parse(tag.textContent); if(c&&c.FORM_ENDPOINT) return c.FORM_ENDPOINT; }
    }catch(_){}
    return window.FORM_ENDPOINT;
  }
  function qs(root, sel){ return root.querySelector(sel); }
  function jsonpCall(endpoint, payload, timeoutMs){
    return new Promise(function(resolve,reject){
      const cb='cb_'+Math.random().toString(36).slice(2);
      const s=document.createElement('script');
      const u=new URL(endpoint);
      u.searchParams.set('callback',cb);
      u.searchParams.set('payload',JSON.stringify(payload));
      let done=false;
      window[cb]=function(resp){ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror=function(){ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to=setTimeout(function(){ if(done) return; done=true; cleanup(); reject(new Error('timeout')); }, timeoutMs||30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if(s.parentNode) s.parentNode.removeChild(s);
      }
      s.src=u.toString();
      document.head.appendChild(s);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const endpoint = cfgEndpoint();
    const form = document.getElementById('join-form');
    if(!form) return;

    const out = document.getElementById('join-result');
    const tok = document.getElementById('token');
    const copyBtn = document.getElementById('copyTokenBtn');

    if(copyBtn){
      copyBtn.addEventListener('click', function(){
        const v = tok && tok.value ? tok.value : '';
        if(!v) return;
        navigator.clipboard.writeText(v).catch(()=>{});
      });
    }

    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      if(!endpoint){ if(out) out.textContent='FORM_ENDPOINT not set'; return; }

      const team     = qs(form,'[name=team]')?.value?.trim() || '';
      const country  = qs(form,'[name=country]')?.value?.trim() || '';
      const contact  = qs(form,'[name=contact]')?.value?.trim() || '';
      const chUrl    = qs(form,'[name=channel_url]')?.value?.trim() || '';
      const plUrl    = qs(form,'[name=playlist_url]')?.value?.trim() || '';
      const city     = qs(form,'[name=city]')?.value?.trim() || '';
      const accR     = qs(form,'[name=accept_rules]')?.checked || false;
      const accP     = qs(form,'[name=accept_policy]')?.checked || false;

      if(!team || !country || !contact || !chUrl || !plUrl){
        if(out) out.textContent='Please fill all required fields';
        return;
      }
      if(!accR || !accP){
        if(out) out.textContent='Please agree to the Rules and Privacy Policy';
        return;
      }

      if(out) out.textContent='Submitting…';
      try{
        const res = await jsonpCall(endpoint, {
          action:'register_form',
          team: team,
          channel_url: chUrl,
          playlist_url: plUrl,
          contact: contact,
          country: country,
          city: city,
          accept_rules: true,
          accept_policy: true
        }, 45000);

        if(!res || !res.ok){
          if(out) out.textContent = 'Error: ' + (res && res.error || 'server');
          return;
        }

        const token = res.verify_token || '';
        if(tok) tok.value = token;
        if(token){ try{ navigator.clipboard.writeText(token); }catch(_){ } }
        if(out) out.textContent='Success!';

      }catch(e){
        if(out) out.textContent='Network error: ' + e.message;
      }
    });
  });
})();
