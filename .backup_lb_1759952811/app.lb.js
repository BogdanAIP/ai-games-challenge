(function(){
  // Try multiple ways to get FORM_ENDPOINT:
  // 1) window.FORM_ENDPOINT
  // 2) inline <script type="application/json" id="site-config">{"FORM_ENDPOINT":"..."}</script>
  // 3) fallback fetch ./public/config.json (same-origin)
  let _endpointPromise = null;

  function readInlineConfig(){
    try{
      const tag = document.getElementById('site-config');
      if (!tag) return null;
      // inline JSON (prefer)
      if (tag.textContent && tag.textContent.trim().startsWith('{')) {
        const cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
      // data-endpoint attr (optional)
      const attr = tag.getAttribute('data-endpoint');
      if (attr) return attr;
    }catch(_){}
    return null;
  }

  async function ensureFormEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    const inline = readInlineConfig();
    if (inline){ window.FORM_ENDPOINT = inline; return inline; }
    // last resort: try fetch ./public/config.json
    try{
      const r = await fetch('./public/config.json', {cache:'no-store'});
      if (r.ok){
        const j = await r.json();
        if (j && j.FORM_ENDPOINT){
          window.FORM_ENDPOINT = j.FORM_ENDPOINT;
          return j.FORM_ENDPOINT;
        }
      }
    }catch(_){}
    return null;
  }

  function jsonpCall(endpoint, payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      let done = false;

      const url = new URL(endpoint);
      url.searchParams.set('callback', cb);
      url.searchParams.set('payload', JSON.stringify(payload));

      window[cb] = function(resp){ if(done) return; done = true; cleanup(); resolve(resp); };
      s.onerror  = function(){ if(done) return; done = true; cleanup(); reject(new Error('JSONP error')); };

      const to = setTimeout(function(){
        if(done) return; done = true; cleanup(); reject(new Error('timeout'));
      }, timeoutMs || 45000);

      function cleanup(){
        try{ clearTimeout(to); }catch(_){}
        try{ delete window[cb]; }catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      s.src = url.toString();
      document.head.appendChild(s);
    });
  }

  function renderTable(rows){
    const root = document.getElementById('lb-root');
    if (!root) return;

    root.innerHTML = `
      <div class="lb-controls">
        <input id="lb-search" placeholder="Search: team, token, country/city"/>
        <span class="lb-count"></span>
      </div>
      <div class="lb-table-wrap"><table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Verification token</th>
            <th>Country/City</th>
            <th>Views</th>
            <th>Likes</th>
            <th>ER</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table></div>
    `;

    const tbody = root.querySelector('tbody');
    const cnt   = root.querySelector('.lb-count');

    function fill(data){
      tbody.innerHTML = '';
      data.forEach(function(r, i){
        const tr = document.createElement('tr');
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
      cnt.textContent = data.length ? `Found: ${data.length}` : 'No matches';
    }
    fill(rows);

    const search = root.querySelector('#lb-search');
    if (search){
      search.addEventListener('input', function(){
        const q = search.value.toLowerCase().trim();
        if (!q){ fill(rows); return; }
        const f = rows.filter(function(r){
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
    const root = document.getElementById('lb-root');
    if (!root) return;
    root.textContent = 'Loading…';

    try{
      _endpointPromise = _endpointPromise || ensureFormEndpoint();
      const endpoint = await _endpointPromise;
      if (!endpoint){ root.textContent = 'Configuration error: FORM_ENDPOINT not set'; return; }

      const res = await jsonpCall(endpoint, { action:'content', task:'leaderboard' }, 45000);
      if (!res || !res.ok){ root.textContent = 'Error: ' + (res && res.error || 'server'); return; }
      const rows = Array.isArray(res.leaderboard) ? res.leaderboard : [];
      renderTable(rows);
    }catch(err){
      const msg = (err && err.message) ? err.message : String(err);
      root.textContent = 'Network error: ' + msg;
    }
  }

  document.addEventListener('DOMContentLoaded', loadLeaderboard);
})();
