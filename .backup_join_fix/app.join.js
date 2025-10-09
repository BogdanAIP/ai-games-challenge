(function(){
  function ensureEndpoint(){
    if (window.FORM_ENDPOINT) return;
    try{
      var tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        var cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
      }
    }catch(_){}
  }
  function qs(root, arr){
    for(var i=0;i<arr.length;i++){ var el = root.querySelector(arr[i]); if (el) return el; }
    return null;
  }
  async function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const u = new URL(window.FORM_ENDPOINT);
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

  document.addEventListener('DOMContentLoaded', function(){
    ensureEndpoint();
    const form = document.getElementById('join-form');
    if (!form) return;
    const out  = document.getElementById('join-result');
    const tok  = document.getElementById('verify-token');

    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      if (!window.FORM_ENDPOINT){
        if (out) out.textContent = 'FORM_ENDPOINT not set';
        return;
      }
      const team   = qs(form, ['[name=team]']);
      const chUrl  = qs(form, ['[name=channel_url]']);
      const plUrl  = qs(form, ['[name=playlist_url]','[name=youtube]']);
      const country= qs(form, ['[name=country]']);
      const contact= qs(form, ['[name=contact]','[name=email]','[name=telegram]']);
      const city   = qs(form, ['[name=city]']);
      const accR   = qs(form, ['[name=accept_rules]']);
      const accP   = qs(form, ['[name=accept_policy]']);

      const teamVal = team ? String(team.value||'').trim() : '';
      const chVal   = chUrl ? String(chUrl.value||'').trim() : '';
      const plVal   = plUrl ? String(plUrl.value||'').trim() : '';
      const cntVal  = contact ? String(contact.value||'').trim() : '';
      const ctryVal = country ? String(country.value||'').trim() : '';
      const cityVal = city ? String(city.value||'').trim() : '';
      const rOK     = accR ? accR.checked : false;
      const pOK     = accP ? accP.checked : false;

      if (!teamVal || !chVal || !plVal || !cntVal || !ctryVal){
        if (out) out.textContent = 'Please fill all required fields';
        return;
      }
      if (!rOK || !pOK){
        if (out) out.textContent = 'Please agree to the Rules and Privacy Policy';
        return;
      }

      if (out) out.textContent = 'Submitting…';
      try{
        const res = await jsonpCall({
          action:'register_form',
          team: teamVal,
          channel_url: chVal,
          playlist_url: plVal,
          contact: cntVal,
          country: ctryVal,
          city: cityVal,
          accept_rules: true,
          accept_policy: true
        }, 45000);

        if (!res || !res.ok){
          if (out) out.textContent = 'Error: ' + (res && res.error || 'server');
          return;
        }
        const token = res.verify_token || '';
        if (tok){
          tok.textContent = token ? ('Your verification token: ' + token) : 'Registration received.';
          if (token){
            try{
              navigator.clipboard.writeText(token);
              tok.textContent += ' (copied)';
            }catch(_){}
          }
        }
        if (out) out.textContent = 'Success! Please paste the token into your playlist description.';
      }catch(err){
        if (out) out.textContent = 'Network error: ' + err.message;
      }
    });
  });
})();
