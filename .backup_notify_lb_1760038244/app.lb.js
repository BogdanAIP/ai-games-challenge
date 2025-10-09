(function(){
  async function loadEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const el = document.getElementById('site-config');
      if (el && el.type === 'application/json'){
        const cfg = JSON.parse(el.textContent || '{}');
        if (cfg && cfg.FORM_ENDPOINT) {
          window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
          return window.FORM_ENDPOINT;
        }
      }
    }catch(_){}
    throw new Error('FORM_ENDPOINT not set');
  }

  function jsonpCall(endpoint, payload){
    return new Promise((resolve, reject)=>{
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(endpoint);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false, to;
      function cleanup(){ s.remove(); delete window[cb]; to && clearTimeout(to); }
      window[cb] = (resp)=>{ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror  = ()=>{ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      to = setTimeout(()=>{ if(done) return; done=true; cleanup(); reject(new Error('Timeout')); }, 20000);
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  function $(sel, root){ return (root||document).querySelector(sel); }

  function render(rows){
    const tb = $('#lb tbody');
    tb.innerHTML = '';
    rows.forEach((r, i)=>{
      const tr = document.createElement('tr');
      const region = [r.country||'', r.city||''].filter(Boolean).join(', ');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.team||''}</td>
        <td>${r.views||0}</td>
        <td>${r.likes||0}</td>
        <td>${r.er||0}</td>
        <td class="muted">${r.verify_token||''}</td>
        <td class="muted">${region}</td>
      `;
      tb.appendChild(tr);
    });
    $('#lb-msg').textContent = rows.length ? '' : 'No data yet.';
  }

  function filterRows(rows, q){
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r=>{
      return [r.team, r.verify_token, r.country, r.city].some(v=> String(v||'').toLowerCase().includes(s));
    });
  }

  async function fetchData(){
    const endpoint = await loadEndpoint();
    // leaderboard for scores
    const lb = await jsonpCall(endpoint, {action:'content', task:'leaderboard'});
    // registrations for token/region enrichment (if available)
    let regs = [];
    try{
      const r = await jsonpCall(endpoint, {action:'content', task:'registrations'});
      if (r && r.ok && Array.isArray(r.items)) regs = r.items;
    }catch(_){}
    // merge by team (simple)
    const regByTeam = Object.create(null);
    regs.forEach(x=>{ if (x.team) regByTeam[x.team.toLowerCase()] = x; });

    const rows = (lb && lb.ok && Array.isArray(lb.leaderboard) ? lb.leaderboard : []).map(x=>{
      const extra = regByTeam[(x.team||'').toLowerCase()] || {};
      return Object.assign({}, x, {
        verify_token: extra.verify_token || '',
        country: extra.country || '',
        city: extra.city || ''
      });
    });
    return rows;
  }

  async function main(){
    const q = $('#q');
    const refreshBtn = $('#refreshBtn');

    async function reload(){
      try{
        const rows = await fetchData();
        render(filterRows(rows, q.value||''));
      }catch(err){
        $('#lb-msg').textContent = 'Network error: ' + (err && err.message || err);
      }
    }

    q.addEventListener('input', reload);
    refreshBtn.addEventListener('click', reload);
    await reload();
  }

  document.addEventListener('DOMContentLoaded', main);
})();
