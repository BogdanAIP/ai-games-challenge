(function(){
  function jsonp(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const url = new URL(window.FORM_ENDPOINT);
      url.searchParams.set('callback', cb);
      url.searchParams.set('payload', JSON.stringify(payload));
      let done = false;
      window[cb] = function(resp){ if (done) return; done = true; cleanup(); resolve(resp); };
      s.onerror = function(){ if (done) return; done = true; cleanup(); reject(new Error('JSONP error')); };
      const to = setTimeout(function(){ if (done) return; done = true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs || 30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src = url.toString();
      document.head.appendChild(s);
    });
  }

  async function loadLeaderboard(){
    const root = document.getElementById('lb-root');
    if (!root){ return; }
    root.textContent = 'Loading leaderboard…';
    try{
      const res = await jsonp({ action:'content', type:'leaderboard' }, 30000);
      if (!res || !res.ok){ root.textContent = 'Failed: ' + (res && res.error || 'server'); return; }
      const rows = res.leaderboard || res.rows || [];
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

  function ensureFormEndpoint(){
    if (window.FORM_ENDPOINT) return;
    try{
      // читаем site/public/config.json, если есть
      var s = document.createElement('script');
      s.type = 'application/json';
      s.id = 'site-config';
      // если уже присутствует <script id="site-config"> с инлайном — прочитаем его
      var cfgTag = document.getElementById('site-config');
      if (cfgTag && cfgTag.textContent){
        var cfg = JSON.parse(cfgTag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
        return;
      }
      // fallback: запросим файл напрямую
      fetch('./public/config.json', { cache:'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('cfg http '+r.status)))
        .then(cfg => { if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT; })
        .catch(()=>{});
    }catch(_){}
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureFormEndpoint();
    loadLeaderboard();
  });
})();
