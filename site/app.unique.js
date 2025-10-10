(function(){
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var el = document.getElementById('site-config');
      if (el && el.textContent){
        var cfg = JSON.parse(el.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise(function(resolve,reject){
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const ep = getConfig();
      if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload));
      window[cb] = function(data){ resolve(data); cleanup(); };
      s.onerror = function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function setFieldMsg(inputEl, msg, isError){
    if (!inputEl) return;
    let box = inputEl.closest('label') || inputEl.parentElement || inputEl;
    let msgEl = box.querySelector('.field-msg');
    if (!msgEl){
      msgEl = document.createElement('div');
      msgEl.className = 'field-msg';
      msgEl.setAttribute('aria-live','polite');
      msgEl.style.fontSize = '.9rem';
      msgEl.style.marginTop = '4px';
      box.appendChild(msgEl);
    }
    msgEl.textContent = msg || '';
    inputEl.classList.toggle('input-error', !!isError);
  }
  async function checkUniqueClient({team, channel_url, contact}){
    const res = await jsonpCall({ action:'check_unique', team, channel_url, contact });
    if (!res || !res.ok) throw new Error(res && res.error || 'check_unique failed');
    return res;
  }

  function main(){
    const form = document.querySelector('form[data-join]');
    if (!form) return;

    // CSS для красной обводки/сообщений (если нет в теме)
    const style = document.createElement('style');
    style.textContent = `
      .input-error{ border-color:#b00020 !important; }
      .field-msg{ color:#b00020; }
    `;
    document.head.appendChild(style);

    const teamEl    = form.querySelector('[name=team]');
    const chEl      = form.querySelector('[name=channel_url]');
    const contactEl = form.querySelector('[name=contact]');
    const msgEl     = document.getElementById('msg');

    const runCheck = debounce(async ()=>{
      try{
        const team    = (teamEl?.value||'').trim();
        const channel = (chEl?.value||'').trim();
        const contact = (contactEl?.value||'').trim();
        if (team.length<2 && channel.length<3 && contact.length<2) return;

        const r = await checkUniqueClient({ team, channel_url:channel, contact });
        if (teamEl){
          if (team.length>=2 && r.dup_team) setFieldMsg(teamEl, 'Team name is already taken.', true);
          else setFieldMsg(teamEl, '', false);
        }
        if (chEl){
          if (channel.length>=3 && r.dup_channel) setFieldMsg(chEl, 'This channel is already registered.', true);
          else setFieldMsg(chEl, '', false);
        }
        if (contactEl){
          if (contact.length>=2 && r.dup_contact) setFieldMsg(contactEl, 'This contact is already used.', true);
          else setFieldMsg(contactEl, '', false);
        }
      }catch(_){}
    }, 450);

    ['input','blur','change'].forEach(evt=>{
      teamEl    && teamEl.addEventListener(evt, runCheck);
      chEl      && chEl.addEventListener(evt, runCheck);
      contactEl && contactEl.addEventListener(evt, runCheck);
    });

    // Блокируем сабмит при дублях — на фазе capture, чтобы сработать раньше остальных слушателей
    form.addEventListener('submit', async (e)=>{
      try{
        const payload = {
          team: (teamEl?.value||'').trim(),
          channel_url: (chEl?.value||'').trim(),
          contact: (contactEl?.value||'').trim()
        };
        const u = await checkUniqueClient(payload);
        let errs = [];
        if (u.dup_team)    { errs.push('Team'); setFieldMsg(teamEl, 'Team name is already taken.', true); }
        if (u.dup_channel) { errs.push('Channel'); setFieldMsg(chEl,   'This channel is already registered.', true); }
        if (u.dup_contact) { errs.push('Contact'); setFieldMsg(contactEl,'This contact is already used.', true); }
        if (errs.length){
          e.stopImmediatePropagation();
          e.preventDefault();
          if (msgEl) msgEl.textContent = 'Please fix duplicates: ' + errs.join(', ') + '.';
          return;
        }
      }catch(_){
        // если сервер недоступен — не блокируем (пусть решает основной обработчик)
      }
    }, true);
  }
  document.addEventListener('DOMContentLoaded', main);
})();
