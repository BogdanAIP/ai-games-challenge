(function(){
  function qs(root, sels){ for (var i=0;i<sels.length;i++){ var el = root.querySelector(sels[i]); if (el) return el; } return null; }

  function ensureEndpoint(){
    if (window.FORM_ENDPOINT) return;
    try{
      var cfgTag = document.getElementById('site-config');
      if (cfgTag && cfgTag.textContent){
        var cfg = JSON.parse(cfgTag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
      }
    }catch(_){}
  }

  async function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const url = new URL(window.FORM_ENDPOINT);
      url.searchParams.set('callback', cb);
      url.searchParams.set('payload', JSON.stringify(payload));
      let done=false;
      window[cb] = function(resp){ if(done) return; done=true; cleanup(); resolve(resp); };
      const s = document.createElement('script');
      s.onerror = function(){ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to = setTimeout(function(){ if(done) return; done=true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs||30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src = url.toString();
      document.head.appendChild(s);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureEndpoint();
    const form = document.querySelector('form');
    if (!form) return;

    const $token = document.getElementById('verify-token');

    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      if (!window.FORM_ENDPOINT){
        alert('FORM_ENDPOINT not set'); return;
      }
      const team = qs(form, ['[name=team]'])?.value?.trim() || '';
      const channel_url = qs(form, ['[name=channel_url]'])?.value?.trim() || '';
      const playlist_url = qs(form, ['[name=playlist_url]'])?.value?.trim() || '';
      const contact = qs(form, ['[name=contact]'])?.value?.trim() || '';
      const country = qs(form, ['[name=country]'])?.value?.trim() || '';
      const city = qs(form, ['[name=city]'])?.value?.trim() || '';
      const accept_rules  = !!qs(form, ['[name=accept_rules]'])?.checked;
      const accept_policy = !!qs(form, ['[name=accept_policy]'])?.checked;

      if (!accept_rules || !accept_policy){
        alert('Please accept the Rules and Privacy to proceed.');
        return;
      }

      try{
        const resp = await jsonpCall({
          action: 'register_form',
          team, channel_url, playlist_url, contact, country, city,
          accept_rules, accept_policy
        }, 45000);

        if (!resp || !resp.ok){
          const err = (resp && (resp.error || resp.msg)) || 'Registration failed';
          alert(err);
          if ($token){ $token.style.display='block'; $token.textContent = 'Error: ' + err; }
          return;
        }
        // success
        const tok = resp.verify_token || '';
        const html = tok
          ? ('Verification token: ' + tok + '. Add it to your season playlist description/title and keep it there.')
          : 'Registered. (No token returned)';
        if ($token){ $token.style.display='block'; $token.textContent = html; }
        try { form.reset(); } catch(_){}
      }catch(e){
        alert('Network error: '+ e.message);
      }
    });
  });
})();
