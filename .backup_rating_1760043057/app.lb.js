(function(){
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var el=document.getElementById('site-config');
      if(el&&el.textContent){var cfg=JSON.parse(el.textContent); if(cfg&&cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;}
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise(function(resolve,reject){
      var cb='cb_'+Math.random().toString(36).slice(2);
      var ep=getConfig(); if(!ep) return reject(new Error('FORM_ENDPOINT not set'));
      var u=new URL(ep);
      var s=document.createElement('script');
      s.src=u.toString()+'?callback='+cb+'&payload='+encodeURIComponent(JSON.stringify(payload));
      window[cb]=function(data){ resolve(data); cleanup(); };
      s.onerror=function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{delete window[cb];}catch(_){}
        try{s.remove();}catch(_){}
      }
    });
  }

  function computeScore(row){
    // row: {team, views, likes, er, country?, city?, token?}
    // Пока считаем score = likes. Позже легко заменить формулу.
    var l = Number(row.likes||0);
    if (isNaN(l)) l=0;
    return l;
  }

  function denseRanks(sorted){
    // sorted: массив по убыванию score
    var prevScore=null, rank=0;
    return sorted.map(function(r,i){
      if (prevScore===null || r._score!==prevScore){ rank = rank + 1; prevScore = r._score; }
      r._rank = rank;
      return r;
    });
  }

  async function main(){
    var q = document.getElementById('q');
    var tbl = document.getElementById('tbl').querySelector('tbody');
    var err = document.getElementById('err');
    var count = document.getElementById('count');
    err.textContent='';

    try{
      // 1) тащим лиду
      var res = await jsonpCall({ action:'content', task:'leaderboard' });
      if (!res || !res.ok) throw new Error(res && res.error || 'content error');

      // 2) нормализуем строки
      var rows = (res.leaderboard||[]).map(function(x){
        var r = {
          team: String(x.team||'').trim(),
          views: Number(x.views||0)||0,
          likes: Number(x.likes||0)||0,
          er: (typeof x.er==='number' ? x.er : Number(String(x.er||'').replace(',','.'))||0),
          country: x.country||'',
          city: x.city||'',
          token: x.verify_token||''
        };
        r._score = computeScore(r);
        return r;
      });

      // 3) сортировка по score убыв.
      rows.sort(function(a,b){ return b._score - a._score; });

      // 4) глобальные ранги (dense)
      rows = denseRanks(rows);

      // 5) отрисовка + фильтр
      function render(list){
        tbl.innerHTML='';
        list.forEach(function(r){
          var tr=document.createElement('tr');
          tr.innerHTML = '<td>'+r._rank+'</td>'
                       + '<td>'+escapeHtml(r.team)+'</td>'
                       + '<td>'+escapeHtml([r.country,r.city].filter(Boolean).join(', '))+'</td>'
                       + '<td>'+r._score+'</td>'
                       + '<td class="muted">'+r.likes+'</td>'
                       + '<td class="muted">'+r.views+'</td>'
                       + '<td class="muted">'+r.er+'</td>';
          tbl.appendChild(tr);
        });
        count.textContent = list.length+' teams';
      }
      function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

      function applyFilter(){
        var needle = String(q.value||'').trim().toLowerCase();
        if (!needle){ render(rows); return; }
        var filtered = rows.filter(function(r){
          return r.team.toLowerCase().includes(needle)
              || String(r.token||'').toLowerCase().includes(needle)
              || String(r.country||'').toLowerCase().includes(needle)
              || String(r.city||'').toLowerCase().includes(needle);
        });
        // Важно: показываем глобальный _rank (уже посчитан по всему списку)
        render(filtered);
      }

      q && q.addEventListener('input', applyFilter);
      render(rows);
    }catch(e){
      err.textContent = 'Network error: ' + (e.message||e);
    }
  }
  document.addEventListener('DOMContentLoaded', main);
})();
