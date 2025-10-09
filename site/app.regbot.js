(function(){
  let REG_STATE = null;
  let LANG = 'en';

  const T = {
    en: {
      start: 'Choose language: English or Russian?',
      ask_team: 'What is your team name?',
      ask_channel: 'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):',
      ask_playlist: 'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):',
      ask_country: 'Country/region (e.g., RU, UA, KZ):',
      ask_city: 'City (optional — send \'-\' to skip):',
      ask_contact: 'Contact (email or @username):',
      ask_rules_text: 'Optional: paste a short version of your rules (<= 3000 chars), or send \'-\' to skip.',
      ask_consents: 'Confirm you agree to the Rules and the Privacy Policy (yes/no).',
      bad_channel: 'Doesn’t look like a channel URL. Please send https://youtube.com/@handle or https://youtube.com/channel/ID',
      bad_playlist: 'Please send a correct playlist URL: https://youtube.com/playlist?list=...',
      need_country: 'Please provide your country/region (two letters, e.g., RU).',
      need_contact: 'Please provide a contact.',
      need_yes: 'You must agree to proceed. Type "yes" if you agree.',
      done_prefix: 'Registration saved. Your token: ',
      done_suffix: ' Paste it into your playlist description.',
    },
    ru: {
      start: 'Выберите язык: английский или русский?',
      ask_team: 'Как называется ваша команда?',
      ask_channel: 'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):',
      ask_playlist: 'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):',
      ask_country: 'Страна/регион (например, RU, UA, KZ):',
      ask_city: 'Город (опционально — можно пропустить, отправив \'-\'):',
      ask_contact: 'Контакт (email или @username):',
      ask_rules_text: 'Опционально: пришлите краткий текст правил (<= 3000 символов), либо "-" чтобы пропустить.',
      ask_consents: 'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).',
      bad_channel: 'Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID',
      bad_playlist: 'Пришлите корректный плейлист: https://youtube.com/playlist?list=...',
      need_country: 'Укажите страну (две буквы, например RU).',
      need_contact: 'Укажите контакт для связи.',
      need_yes: 'Нужно согласие для продолжения. Напишите "да", если согласны.',
      done_prefix: 'Заявка сохранена. Ваш токен: ',
      done_suffix: '. Вставьте его в описание плейлиста.',
    }
  };

  function $(sel, root){ return (root||document).querySelector(sel); }

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

  function pushQ(text){ const box = $('#regbot-box'); const d = document.createElement('div'); d.className='regbot-q'; d.textContent = text; box.appendChild(d); box.scrollTop = box.scrollHeight; }
  function pushA(text){ const box = $('#regbot-box'); const d = document.createElement('div'); d.className='regbot-a'; d.textContent = text; box.appendChild(d); box.scrollTop = box.scrollHeight; }

  function normalizeChannel(s){
    s = String(s||'').trim();
    if (/^@[\w.\-]+$/i.test(s)) return 'https://www.youtube.com/' + s.replace(/^@/,'@');
    s = s.replace(/^https?:\/\/youtu\.be\//i, 'https://www.youtube.com/');
    return s;
  }
  function isValidChannel(u){
    u = String(u||'').trim();
    if (/^@[\w.\-]+$/i.test(u)) return true;
    if (/^https?:\/\/(www\.)?youtube\.com\/channel\/[A-Za-z0-9_\-]+$/i.test(u)) return true;
    if (/^https?:\/\/(www\.)?youtube\.com\/@[\w.\-]+$/i.test(u)) return true;
    return false;
  }
  function isValidPlaylist(u){
    u = String(u||'').trim();
    return /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[A-Za-z0-9_\-]+/i.test(u);
  }

  async function handleReply(msg){
    const t = T[LANG];
    switch (REG_STATE.step|0){
      case 0: { // choose language
        const m = msg.trim().toLowerCase();
        if (m.includes('ru') || m.includes('рус')) LANG='ru'; else LANG='en';
        REG_STATE = { step:1, payload:{} };
        pushQ(t.ask_team);
        return;
      }
      case 1: {
        if (!msg.trim()) { pushQ(t.ask_team); return; }
        REG_STATE.payload.team = msg.trim();
        REG_STATE.step = 2; pushQ(t.ask_channel); return;
      }
      case 2: {
        const ch = normalizeChannel(msg);
        if (!isValidChannel(ch)) { pushQ(t.bad_channel); return; }
        REG_STATE.payload.channel_url = ch;
        REG_STATE.step = 3; pushQ(t.ask_playlist); return;
      }
      case 3: {
        if (!isValidPlaylist(msg)) { pushQ(t.bad_playlist); return; }
        REG_STATE.payload.playlist_url = msg.trim();
        REG_STATE.step = 4; pushQ(t.ask_country); return;
      }
      case 4: {
        if (!msg.trim()) { pushQ(t.need_country); return; }
        REG_STATE.payload.country = msg.trim();
        REG_STATE.step = 5; pushQ(t.ask_city); return;
      }
      case 5: {
        if (msg.trim() && msg.trim() !== '-') REG_STATE.payload.city = msg.trim();
        REG_STATE.step = 6; pushQ(t.ask_contact); return;
      }
      case 6: {
        if (!msg.trim()) { pushQ(t.need_contact); return; }
        REG_STATE.payload.contact = msg.trim();
        REG_STATE.step = 6.5; pushQ(t.ask_rules_text); return;
      }
      case 6.5: {
        const v = msg.trim();
        if (v !== '-' && v.length > 0){
          REG_STATE.payload.rules_text = v.slice(0, 3000);
        }
        REG_STATE.step = 7; pushQ(t.ask_consents); return;
      }
      case 7: {
        const yes = msg.trim().toLowerCase();
        const ok = (LANG==='ru') ? (yes==='да' || yes==='y' || yes==='yes') : (yes==='yes' || yes==='y' || yes==='да');
        if (!ok){ pushQ(t.need_yes); return; }

        // final submit via dialog endpoint (GAS will call handleRegistration_)
        const endpoint = await loadEndpoint();
        const payload = {
          action: 'register',
          state: REG_STATE,
          reply: 'yes'
        };
        const res = await jsonpCall(endpoint, payload);
        if (!res || !res.ok){
          pushQ('Error: ' + (res && res.error || 'unknown'));
          return;
        }
        const token = res.verify_token || '—';
        pushQ(t.done_prefix + token + (t.done_suffix||''));
        return;
      }
      default:
        REG_STATE = { step:0, payload:{} };
        pushQ(T[LANG].start);
        return;
    }
  }

  function bindUI(){
    $('#regbot-box').textContent = '';
    REG_STATE = { step:0, payload:{} };
    pushQ(T[LANG].start);

    $('#regbot-start').addEventListener('click', ()=>{
      $('#regbot-box').textContent = '';
      LANG='en';
      REG_STATE = { step:0, payload:{} };
      pushQ(T[LANG].start);
    });
    $('#regbot-send').addEventListener('click', async ()=>{
      const i = $('#regbot-input'); const v = i.value; i.value='';
      if (!v.trim()) return;
      pushA(v);
      try{ await handleReply(v); }catch(err){ pushQ('Network error: '+(err && err.message || err)); }
    });
    $('#regbot-input').addEventListener('keydown', async (e)=>{
      if (e.key === 'Enter'){
        e.preventDefault();
        $('#regbot-send').click();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindUI);
})();
