(function(){
  // ===== helpers =====
  function readConfigIfNeeded(){
    if (window.FORM_ENDPOINT) return;
    try{
      var tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        var cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
      }
    }catch(_){}
  }

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(window.FORM_ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done = false;
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
        try{clearTimeout(to);}catch(_){}
      }
      window[cb] = function(resp){ if (done) return; done=true; cleanup(); resolve(resp); };
      s.onerror = function(){ if (done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to = setTimeout(function(){ if (done) return; done=true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs || 30000);
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  function qs(root, sel){
    if (Array.isArray(sel)){
      for (var i=0;i<sel.length;i++){ var el = root.querySelector(sel[i]); if (el) return el; }
      return null;
    }
    return root.querySelector(sel);
  }

  // ===== main =====
  document.addEventListener('DOMContentLoaded', function(){
    readConfigIfNeeded();
    if (!window.FORM_ENDPOINT){
      console.warn('FORM_ENDPOINT not set; ensure site/public/config.json or inline <script id="site-config"> exists');
    }

    var form = document.getElementById('join-form') || document.querySelector('form[data-join]');
    if (!form) return;

    var out = document.getElementById('join-output') || (function(){
      var d = document.createElement('div'); d.id='join-output'; d.className='note'; form.parentNode.insertBefore(d, form.nextSibling); return d;
    })();

    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      out.textContent = 'Submitting…';

      // read fields
      var team        = qs(form, ['[name=team]','[data-field=team]']);
      var channelUrl  = qs(form, ['[name=channel_url]','[data-field=channel_url]']);
      var playlistUrl = qs(form, ['[name=playlist_url]','[data-field=playlist_url]','[name=youtube]']);
      var country     = qs(form, ['[name=country]','[data-field=country]']);
      var city        = qs(form, ['[name=city]','[data-field=city]']);
      var contact     = qs(form, ['[name=contact]','[data-field=contact]','[name=email]','[name=telegram]']);

      var payload = {
        action:       'register_form',
        team:         team ? String(team.value||'').trim() : '',
        channel_url:  channelUrl ? String(channelUrl.value||'').trim() : '',
        playlist_url: playlistUrl ? String(playlistUrl.value||'').trim() : '',
        country:      country ? String(country.value||'').trim() : '',
        city:         city ? String(city.value||'').trim() : '',
        contact:      contact ? String(contact.value||'').trim() : ''
      };

      // quick checks mirroring GAS
      if (!payload.team){ out.textContent='Please enter team name'; return; }
      if (!payload.channel_url){ out.textContent='Channel URL required'; return; }
      if (!payload.playlist_url){ out.textContent='Season playlist URL required'; return; }
      if (!payload.contact){ out.textContent='Contact required'; return; }
      if (!payload.country){ out.textContent='Country (e.g. RU/UA/KZ) required'; return; }

      try{
        const res = await jsonpCall(payload, 30000);
        if (!res || !res.ok){
          out.textContent = 'Failed: ' + (res && (res.error || JSON.stringify(res)) || 'server');
          return;
        }
        out.innerHTML = '✅ Registration accepted. ID: <code>'+res.id+'</code>';
        try{ form.reset(); }catch(_){}
      }catch(err){
        out.textContent = 'Network error: ' + err.message;
      }
    });
  });
})();
