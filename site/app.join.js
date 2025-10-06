(function(){
  function qs(root, selArr){ for (var i=0;i<selArr.length;i++){ var el = root.querySelector(selArr[i]); if (el) return el; } return null; }

  function ensureFormEndpoint(){
    if (window.FORM_ENDPOINT && typeof window.FORM_ENDPOINT === 'string') {
      window.FORM_ENDPOINT = window.FORM_ENDPOINT.replace(/^'+|'+$/g,'').trim();
      if (window.FORM_ENDPOINT) return Promise.resolve();
    }
    try{
      var tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        var cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT){
          window.FORM_ENDPOINT = String(cfg.FORM_ENDPOINT).trim();
          if (window.FORM_ENDPOINT) return Promise.resolve();
        }
      }
    }catch(_){}
    return fetch('./public/config.json', { cache:'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then(cfg => { if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = String(cfg.FORM_ENDPOINT).trim(); })
      .catch(()=>{});
  }

  async function submitJoin(ev){
    ev.preventDefault();
    await ensureFormEndpoint();

    var form = ev.currentTarget;
    var team    = qs(form, ['[name=team]','[data-field=team]']);
    var country = qs(form, ['[name=country]','[data-field=country]']);
    var contact = qs(form, ['[name=contact]','[name=email]','[name=telegram]','[data-field=contact]']);
    var chUrl   = qs(form, ['[name=channel_url]','[data-field=channel_url]']);
    var plUrl   = qs(form, ['[name=playlist_url]','[data-field=playlist_url]']);

    var teamVal = team ? String(team.value||'').trim() : '';
    var countryVal = country ? String(country.value||'').trim() : '';
    var contactVal = contact ? String(contact.value||'').trim() : '';
    var chVal = chUrl ? String(chUrl.value||'').trim() : '';
    var plVal = plUrl ? String(plUrl.value||'').trim() : '';

    var out = document.getElementById('join-feedback'); if (out) out.textContent = '';

    if (!window.FORM_ENDPOINT){ if (out) out.textContent = 'Config error: FORM_ENDPOINT is not set'; return; }
    if (!teamVal || !countryVal || !contactVal || !chVal || !plVal){ if (out) out.textContent = 'Please fill all required fields'; return; }

    var cb = 'cb_' + Math.random().toString(36).slice(2);
    var urlStr = String(window.FORM_ENDPOINT || '').trim();

    try{
      if (!/^https?:\/\//i.test(urlStr)) throw new Error('Invalid endpoint');
      var u = new URL(urlStr);
      var payload = {
        action: 'register_form',
        team: teamVal,
        channel_url: chVal,
        playlist_url: plVal,
        contact: contactVal,
        country: countryVal,
        city: qs(form, ['[name=city]','[data-field=city]']) ? String(qs(form, ['[name=city]','[data-field=city]']).value||'').trim() : ''
      };
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));

      window[cb] = function(resp){
        try{ delete window[cb]; }catch(_){}
        if (!out) return;
        if (resp && resp.ok){
          var token = resp.verify_token ? ('\nVerification token: ' + resp.verify_token) : '';
          out.textContent = 'OK! Application submitted.' + token + '\nAdd the token into your season playlist description.';
        } else {
          out.textContent = 'Failed: ' + (resp && (resp.error||resp.message) || 'server');
        }
      };

      var s = document.createElement('script');
      s.onerror = function(){ try{ delete window[cb]; }catch(_){}
        if (out) out.textContent = 'Network error'; };
      s.src = u.toString();
      document.head.appendChild(s);
    }catch(err){
      if (out) out.textContent = 'Invalid FORM_ENDPOINT: ' + (err && err.message || err);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    var f = document.querySelector('form[data-join], form#join-form');
    if (f){ f.addEventListener('submit', submitJoin, false); }
  });
})();
