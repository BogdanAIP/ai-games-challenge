(function(){
  function ensureFormEndpoint(){
    if (window.FORM_ENDPOINT) return;
    try{
      var tag = document.getElementById('site-config');
      if (tag && tag.textContent){
        var cfg = JSON.parse(tag.textContent);
        if (cfg && cfg.FORM_ENDPOINT) window.FORM_ENDPOINT = cfg.FORM_ENDPOINT;
      }
    }catch(_){}
  }

  function jsonp(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(window.FORM_ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done = false;
      function cleanup(){
        try{ delete window[cb]; }catch(_){}
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      window[cb] = function(resp){ if (done) return; done = true; cleanup(); resolve(resp); };
      s.onerror   = function(){ if (done) return; done = true; cleanup(); reject(new Error('JSONP error')); };
      setTimeout(function(){ if (done) return; done = true; cleanup(); reject(new Error('timeout')); }, timeoutMs || 30000);
      s.src = u.toString();
      document.head.appendChild(s);
    });
  }

  function qs(root, list){
    for (var i=0; i<list.length; i++){
      var el = root.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureFormEndpoint();
    if (!window.FORM_ENDPOINT) {
      console.warn('FORM_ENDPOINT not set; ensure site/public/config.json contains it');
      return;
    }

    // Находим существующую форму: сначала #join-form, иначе первая <form>
    var form = document.getElementById('join-form') || document.querySelector('form');
    if (!form) return;

    // Пытаемся найти поля с разными именами
    var team    = qs(form, ['[name=team]','[name=team_name]','[name=name]','[data-field=team]']);
    var youtube = qs(form, ['[name=youtube]','[name=playlist]','[name=video]','[data-field=youtube]']);
    var contact = qs(form, ['[name=contact]','[name=email]','[name=telegram]','[data-field=contact]']);

    // Контейнер для статуса (создадим, если нет)
    var statusBox = document.getElementById('join-result');
    if (!statusBox){
      statusBox = document.createElement('div');
      statusBox.id = 'join-result';
      statusBox.className = 'note';
      (form.parentNode || document.body).insertBefore(statusBox, form.nextSibling);
    }

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      var teamVal    = team    ? String(team.value||'').trim()    : '';
      var ytVal      = youtube ? String(youtube.value||'').trim() : '';
      var contactVal = contact ? String(contact.value||'').trim() : '';

      if (!teamVal || !ytVal || !contactVal){
        statusBox.textContent = 'Заполните все поля (команда, YouTube, контакты).';
        return;
      }

      statusBox.textContent = 'Отправляем заявку…';
      try{
        const res = await jsonp({
          action: 'register_form',
          team: teamVal,
          youtube: ytVal,
          contact: contactVal
        }, 30000);

        if (res && res.ok){
          statusBox.textContent = 'Заявка принята! Мы скоро свяжемся.';
          try{ form.reset(); }catch(_){}
        }else{
          statusBox.textContent = 'Ошибка: ' + (res && res.error || 'неизвестно');
        }
      }catch(err){
        statusBox.textContent = 'Сеть/JSONP: ' + err.message;
      }
    });
  });
})();
