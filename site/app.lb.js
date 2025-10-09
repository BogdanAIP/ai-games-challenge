(function(){
  function getEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const cfgEl = document.getElementById('site-config');
      if (cfgEl && cfgEl.textContent){
        const cfg = JSON.parse(cfgEl.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }

  function jsonpCall(payload){
    return new Promise((resolve,reject)=>{
      const ep = getEndpoint();
      if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload));
      window[cb] = (data)=>{ resolve(data); cleanup(); };
      s.onerror = ()=>{ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }

  // === Формула рейтинга ===
  function computeScore(row){
    // raw
    let views = Number(row.views||0); if (!isFinite(views) || views<0) views = 0;
    let likes = Number(row.likes||0); if (!isFinite(likes) || likes<0) likes = 0;

    // er как доля (0..1). Если пусто — likes/views. Если >1 — значит проценты.
    let er = row.er;
    if (er == null || er === '') {
      er = views > 0 ? (likes / views) : 0;
    } else {
      er = Number(String(er).toString().replace(',', '.'));
      if (!isFinite(er)) er = 0;
      if (er > 1) er = er/100;
      if (er < 0) er = 0;
    }

    const clamp = (x,min,max)=>Math.max(min,Math.min(max,x));

    const V = clamp( Math.log10(views + 1) / 6, 0, 1 );            // 1.0 ~ 1,000,000 views
    const L = clamp( Math.sqrt(likes) / Math.sqrt(5000), 0, 1 );   // 1.0 ~ 5,000 likes
    const E = clamp( er / 0.10, 0, 1 );                            // 1.0 ~ 10% ER

    const scoreRaw = 0.20*V + 0.40*L + 0.40*E;
    const score = Math.round(1000 * scoreRaw);
    return { score, V, L, E, views, likes, er };
  }

  function fmtInt(n){ return Number(n).toLocaleString('en'); }
  function fmtPct(x){ return (100*Number(x||0)).toFixed(1) + '%'; }

  function render(rows){
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    if (!rows.length){
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan=6; td.className='muted';
      td.textContent = 'No teams yet.';
      tr.appendChild(td); tbody.appendChild(tr); return;
    }
    for (const r of rows){
      const tr = document.createElement('tr');

      const tdRank = document.createElement('td');
      tdRank.className = 'rank-col num';
      tdRank.textContent = r.globalRank;
      tr.appendChild(tdRank);

      const tdTeam = document.createElement('td');
      tdTeam.textContent = r.team || '';
      tr.appendChild(tdTeam);

      const tdScore = document.createElement('td');
      tdScore.innerHTML = `<span class="score-badge num">${r.score}</span>`;
      tr.appendChild(tdScore);

      const tdViews = document.createElement('td');
      tdViews.className='num';
      tdViews.textContent = fmtInt(r.views);
      tr.appendChild(tdViews);

      const tdLikes = document.createElement('td');
      tdLikes.className='num';
      tdLikes.textContent = fmtInt(r.likes);
      tr.appendChild(tdLikes);

      const tdER = document.createElement('td');
      tdER.className='num';
      tdER.textContent = fmtPct(r.er);
      tr.appendChild(tdER);

      tbody.appendChild(tr);
    }
  }

  async function main(){
    const status = document.getElementById('status');
    const q = document.getElementById('q');

    try{
      status.textContent = '';
      const res = await jsonpCall({ action:'content', task:'leaderboard' });
      if (!res || !res.ok) throw new Error(res && res.error || 'API error');

      const raw = Array.isArray(res.leaderboard) ? res.leaderboard : [];
      // приведём поля и посчитаем баллы
      let rows = raw.map(x=>{
        const team = (x.team==null ? '' : String(x.team));
        const views = Number(x.views||0);
        const likes = Number(x.likes||0);
        let er = (x.er==null ? '' : x.er);
        const { score, views:V, likes:L, er:E } = computeScore({team, views, likes, er});
        return { team, views:V, likes:L, er:E, score };
      });

      // глобальная сортировка (score desc, likes desc, views desc, team asc)
      rows.sort((a,b)=>
        (b.score - a.score) ||
        (b.likes - a.likes) ||
        (b.views - a.views) ||
        String(a.team).localeCompare(b.team)
      );
      // присвоим глобальные ранги, чтобы в поиске они не «прыгали»
      rows.forEach((r,i)=> r.globalRank = i+1);

      // первичный рендер
      render(rows);

      // поиск по команде — не трогаем globalRank
      q.addEventListener('input', ()=>{
        const term = q.value.trim().toLowerCase();
        const f = term ? rows.filter(r => r.team.toLowerCase().includes(term)) : rows;
        render(f);
      });

    }catch(err){
      status.textContent = 'Network error: ' + String(err.message||err);
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '<tr><td colspan="6" class="muted">Failed to load rating.</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', main);
})();
