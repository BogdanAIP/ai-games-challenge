(function(){
  function qs(s){ return document.querySelector(s); }
  function getEndpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var el = document.getElementById('site-config'); if (el && el.textContent){ var cfg=JSON.parse(el.textContent); if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT; }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise(function(resolve,reject){
      const ep = getEndpoint(); if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload)) + '&t=' + Date.now();
      window[cb] = function(data){ resolve(data); cleanup(); };
      s.onerror = function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }
  function renderTable(list){
    const tbody = qs('#lb-body'); if (!tbody) return;
    tbody.innerHTML='';
    list.forEach((row, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">'+(idx+1)+'</td>'
                   + '<td>'+ (row.team||'') +'</td>'
                   + '<td>'+ (row.views||0) +'</td>'
                   + '<td>'+ (row.likes||0) +'</td>'
                   + '<td>'+ (row.er||0) +'</td>';
      tbody.appendChild(tr);
    });
  }
  async function load(){
    const msg = qs('#lb-msg');
    try{
      let res = await jsonpCall({ action:'content', task:'leaderboard' });
      if (!res || !res.ok) throw new Error(res && res.error || 'content error');
      if (!res.leaderboard || !res.leaderboard.length){
        // попробуем мягко дернуть refresh и снова
        await jsonpCall({ action:'lb_refresh' });
        res = await jsonpCall({ action:'content', task:'leaderboard' });
      }
      renderTable(res.leaderboard||[]);
      if (msg) msg.textContent='';
    }catch(err){
      if (msg) msg.textContent='Network error: '+String(err.message||err);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
