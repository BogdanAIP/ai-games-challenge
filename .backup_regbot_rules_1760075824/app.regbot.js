(function(){
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const el = document.getElementById('site-config');
      if (el && el.textContent){
        const cfg = JSON.parse(el.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise((resolve,reject)=>{
      const ep = getConfig();
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

  // === ensure UI exists ===
  function ensureBotUI(){
    let box = document.getElementById('regbot-box');
    let input = document.getElementById('regbot-input');
    let send = document.getElementById('regbot-send');
    let start= document.getElementById('regbot-start');

    if (!box){
      // создаём секцию под формой
      const form = document.querySelector('form[data-join]') || document.body;
      const sec = document.createElement('section');
      sec.id = 'regbot-section';
      sec.style.marginTop = '28px';
      sec.innerHTML = `
        <h3>AI Registration Assistant</h3>
        <p class="note">Assistant collects: team, country, contact, channel, playlist, and short rules (required).</p>
        <div id="regbot-box" aria-live="polite" style="border:1px solid #2b2f31;border-radius:12px;padding:12px;height:260px;overflow:auto;background:#0e0f10;margin-top:8px"></div>
        <div class="regbot-row" style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-top:8px">
          <input id="regbot-input" placeholder="Answer the bot…" style="padding:.75rem;border:1px solid #2b2f31;border-radius:10px;background:#111;color:#fff"/>
          <button class="btn" id="regbot-send" type="button">Send</button>
          <button class="btn btn-secondary" id="regbot-start" type="button">Start</button>
        </div>`;
      form.parentNode.insertBefore(sec, form.nextSibling);
      // requery
      box = sec.querySelector('#regbot-box');
      input = sec.querySelector('#regbot-input');
      send = sec.querySelector('#regbot-send');
      start= sec.querySelector('#regbot-start');
    }
    return { box, input, send, start };
  }

  const ui = ensureBotUI();
  const box = ui.box, input = ui.input, btnSend = ui.send, btnStart = ui.start;

  let STATE = { step:0, payload:{}, lang:'' };

  // Функции валидации
  async function validateTeamName(name) {
    if (!name) return 'Team name is required';
    if (name.length < 3) return 'Team name must be at least 3 characters';
    if (name.length > 30) return 'Team name must be less than 30 characters';
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return 'Team name can only contain letters, numbers, spaces, hyphens and underscores';
    }
    
    try {
      const check = await jsonpCall({
        action: 'check_team',
        team: name
      });
      if (!check.ok) return check.error || 'Team name is not available';
      return '';
    } catch(e) {
      return 'Could not verify team name availability';
    }
  }

  function validateYouTubeUrl(url, type) {
    if (!url) return `${type} URL is required`;
    try {
      const u = new URL(url);
      if (type === 'channel' && !u.pathname.includes('/@')) {
        return 'Channel URL should contain channel handle (e.g., @yourteam)';
      }
      if (type === 'playlist' && !u.searchParams.get('list')) {
        return 'Playlist URL should contain playlist ID';
      }
      return '';
    } catch(e) {
      return 'Invalid URL format';
    }
  }

  function validateRules(text) {
    if (!text) return 'Rules text is required';
    const len = text.length;
    if (len < 500) return `Rules text too short (${len}/500 characters minimum)`;
    if (len > 3000) return `Rules text too long (${len}/3000 characters maximum)`;
    return '';
  }

  function validateContact(contact) {
    if (!contact) return 'Contact information is required';
    if (contact.includes('@')) {
      // Проверка email или telegram handle
      if (contact.startsWith('@')) {
        // Telegram handle
        if (!/^@[a-zA-Z0-9_]{5,32}$/.test(contact)) {
          return 'Invalid Telegram handle format';
        }
      } else {
        // Email
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(contact)) {
          return 'Invalid email format';
        }
      }
    } else {
      return 'Contact must be email or Telegram handle';
    }
    return '';
  }

  function printQ(text){ 
    const p = document.createElement('div'); 
    p.className='regbot-q'; 
    p.textContent=text; 
    box.appendChild(p); 
    box.scrollTop = box.scrollHeight; 
  }
  
  function printA(text){ 
    const p = document.createElement('div'); 
    p.className='regbot-a'; 
    p.textContent=text; 
    box.appendChild(p); 
    box.scrollTop = box.scrollHeight; 
  }
  
  function printError(text){
    const p = document.createElement('div');
    p.className = 'regbot-error';
    p.style.color = '#ff4444';
    p.textContent = '❌ ' + text;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
  }

  async function sendToServer(msg){
    return await jsonpCall({ action:'register', state: STATE, reply: msg });
  }

  async function handle(msg){
    if (msg) printA(msg);
    try{
      const res = await sendToServer(msg||'');
      if (!res || !res.ok){ 
        printError(res && res.error || 'unknown error'); 
        return; 
      }

      // Проверки на каждом шаге
      if (res.state && res.state.step) {
        let validationError = '';
        const payload = res.state.payload || {};

        switch(res.state.step) {
          case 1: // Имя команды
            validationError = await validateTeamName(msg);
            break;
          
          case 2: // Страна
            if (!msg || msg.length < 2) {
              validationError = 'Please enter valid country code (e.g., US, UK, RU)';
            }
            break;
          
          case 3: // Контакт
            validationError = validateContact(msg);
            break;
          
          case 4: // YouTube канал
            validationError = validateYouTubeUrl(msg, 'channel');
            break;
          
          case 5: // Плейлист
            validationError = validateYouTubeUrl(msg, 'playlist');
            break;
          
          case 6: // Правила
            validationError = validateRules(msg);
            break;
        }

        if (validationError) {
          printError(validationError);
          // Повторяем текущий вопрос
          if (res.ask) printQ(res.ask);
          return;
        }
      }

      if (res.ask){
        // Показываем прогресс
        if (res.state && res.state.step) {
          const progress = Math.min(Math.round((res.state.step / 6) * 100), 100);
          printQ(`[Progress: ${progress}%]`);
        }
        
        printQ(res.ask);
        STATE = res.state || STATE;
        return;
      }

      if (res.done && res.verify_token){
        printQ('✅ Registration completed successfully!');
        printQ(res.msg || ('Your token: ' + res.verify_token));
        STATE = res.state || STATE;
      }
    }catch(err){
      printError('Network error: ' + String(err.message||err));
    }
  }

  btnStart && btnStart.addEventListener('click', ()=>{ box.innerHTML=''; STATE={step:0,payload:{},lang:''}; handle(''); });
  btnSend  && btnSend.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim();
    if (!txt) return;
    await handle(txt);
    input.value='';
  });

  // автозапуск, если пусто
  if (!box.innerHTML.trim()){ handle(''); }
})();
