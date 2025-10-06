(function(){
  function ensureFormEndpoint(){
    // 1) already set
    if (window.FORM_ENDPOINT && typeof window.FORM_ENDPOINT === 'string') {
      window.FORM_ENDPOINT = window.FORM_ENDPOINT.replace(/^'+|'+$/g,'').trim();
      if (window.FORM_ENDPOINT) return Promise.resolve();
    }
    // 2) inline JSON (<script id="site-config">{"FORM_ENDPOINT":"..."}</script>)
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
    // 3) fetch ./public/config.json
    return fetch('./public/config.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then(cfg => {
        if (cfg && cfg.FORM_ENDPOINT) {
          window.FORM_ENDPOINT = String(cfg.FORM_ENDPOINT).trim();
        }
      })
      .catch(()=>{});
  }

  function jsonp(payload, timeoutMs){
    return new Promise(async function(resolve, reject){
      await ensureFormEndpoint();
      var urlStr = String(window.FORM_ENDPOINT || '').trim();
      if (!/^https?:\/\//i.test(urlStr)){
        return reject(new Error('FORM_ENDPOINT not set'));
      }
      var cb = 'cb_' + Math.random().toString(36).slice(2);
      var s = document.createElement('script');
      var u;
      try{ u = new URL(urlStr); }catch(e){ return reject(new Error('Invalid FORM_ENDPOINT')); }
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));

      var done = false;
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function(resp){ if (done) return; done = true; cleanup(); resolve(resp); };
      s.onerror = function(){ if (done) return; done = true; cleanup(); reject(new Error('JSONP error')); };
      setTimeout(function(){ if (done) return; done = true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs || 30000);
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  async function loadLeaderboard(){
    const root = document.getElementById('lb-root');
    if (!root) return;
    root.textContent = 'Loading leaderboard…';
    try{
      const res = await jsonp({ action:'content', task:'leaderboard' }, 30000);
      if (!res || !res.ok){ root.textContent = 'Failed: ' + (res && res.error || 'server'); return; }
      const rows = res.leaderboard || [];
      if (!rows.length){ root.textContent = 'No data yet'; return; }

      const table = document.createElement('table');
      table.className = 'table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>#</th><th>Team</th><th>Views</th><th>Likes</th><th>ER</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');

      rows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td>${r.team || r.name || '-'}</td>
          <td>${(r.views ?? r.v ?? '-')}</td>
          <td>${(r.likes ?? r.l ?? '-')}</td>
          <td>${(r.er ?? '-')}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      root.innerHTML = '';
      root.appendChild(table);
    }catch(err){
      root.textContent = 'Network error: ' + err.message;
    }
  }

  document.addEventListener('DOMContentLoaded', loadLeaderboard);
})();
