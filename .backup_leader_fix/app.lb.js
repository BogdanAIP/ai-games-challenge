(function(){
  function ensureFormEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var cfgTag = document.getElementById('site-config');
      if (cfgTag && cfgTag.textContent){
        var cfg = JSON.parse(cfgTag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) { window.FORM_ENDPOINT = cfg.FORM_ENDPOINT; return cfg.FORM_ENDPOINT; }
      }
    }catch(_){}
    return window.FORM_ENDPOINT;
  }

  function jsonp(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      var endpoint = ensureFormEndpoint();
      if (!endpoint) return reject(new Error('FORM_ENDPOINT not set'));
      var cb='cb_' + Math.random().toString(36).slice(2);
      var s=document.createElement('script');
      var url=new URL(endpoint);
      url.searchParams.set('callback', cb);
      url.searchParams.set('payload', JSON.stringify(payload));
      var done=false;
      window[cb]=function(resp){ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror=function(){ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      var to=setTimeout(function(){ if(done) return; done=true; cleanup(); reject(new Error('timeout')); }, timeoutMs||45000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src=url.toString();
      document.head.appendChild(s);
    });
  }

  function renderTable(rows){
    var root = document.getElementById('lb-root');
    if (!root) return;

    root.innerHTML = `
      <div class="lb-controls">
        <input id="lb-search" placeholder="Поиск: команда, токен, страна/город"/>
        <span class="lb-count"></span>
      </div>
      <div class="lb-table-wrap"><table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Команда</th>
            <th>Вериф. токен</th>
            <th>Страна/город</th>
            <th>Просмотры</th>
            <th>Лайки</th>
            <th>ER</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table></div>
    `;

    var tbody = root.querySelector('tbody');
    var cnt   = root.querySelector('.lb-count');
    function fill(data){
      tbody.innerHTML = '';
      data.forEach(function(r, i){
        var tr=document.createElement('tr');
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${r.team || '-'}</td>
          <td><code>${r.verify_token || '-'}</code></td>
          <td>${[r.country||'', r.city||''].filter(Boolean).join(', ') || '-'}</td>
          <td>${r.views ?? 0}</td>
          <td>${r.likes ?? 0}</td>
          <td>${r.er ?? 0}</td>
        `;
        tbody.appendChild(tr);
      });
      cnt.textContent = data.length ? `Найдено: ${data.length}` : 'Ничего не найдено';
    }
    fill(rows);

    var search = root.querySelector('#lb-search');
    if (search){
      search.addEventListener('input', function(){
        var q = search.value.toLowerCase().trim();
        if (!q){ fill(rows); return; }
        var f = rows.filter(function(r){
          return String(r.team||'').toLowerCase().includes(q) ||
                 String(r.verify_token||'').toLowerCase().includes(q) ||
                 String(r.country||'').toLowerCase().includes(q) ||
                 String(r.city||'').toLowerCase().includes(q);
        });
        fill(f);
      });
    }
  }

  async function loadLeaderboard(){
    var root = document.getElementById('lb-root');
    if (!root){ return; }
    root.textContent = 'Загрузка…';
    try{
      var res = await jsonp({ action:'content', task:'leaderboard' }, 45000);
      if (!res || !res.ok){ root.textContent = 'Ошибка: ' + (res && res.error || 'server'); return; }
      var rows = Array.isArray(res.leaderboard) ? res.leaderboard : [];
      renderTable(rows);
    }catch(err){
      root.textContent = 'Network error: ' + err.message;
    }
  }

  document.addEventListener('DOMContentLoaded', loadLeaderboard);
})();
