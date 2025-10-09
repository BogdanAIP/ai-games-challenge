(function(){
  // UI функции
  function showValidationError(el, message) {
    el.style.borderColor = '#ff4444';
    const error = document.createElement('div');
    error.className = 'validation-error';
    error.style.color = '#ff4444';
    error.style.fontSize = '0.9em';
    error.style.marginTop = '4px';
    error.textContent = message;
    el.parentNode.appendChild(error);
  }

  function clearValidationError(el) {
    el.style.borderColor = '#2b2f31';
    const error = el.parentNode.querySelector('.validation-error');
    if (error) error.remove();
  }

  function showProgress(message, msgEl) {
    const progress = document.createElement('div');
    progress.className = 'progress-message';
    progress.style.background = '#2b2f31';
    progress.style.color = '#fff';
    progress.style.padding = '8px 12px';
    progress.style.borderRadius = '8px';
    progress.style.marginTop = '8px';
    progress.textContent = message;
    msgEl.appendChild(progress);
    return progress;
  }

  // Базовые функции
  function qs(p,sel){ return (p||document).querySelector(sel); }
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
  function chunkString(str, size){ const out=[]; for(let i=0;i<str.length;i+=size) out.push(str.slice(i,i+size)); return out; }
  
  // Валидация
  function validateYouTubeUrl(url, type) {
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

  async function validateTeamName(name) {
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

  async function main(){
    const form = qs(document,'form[data-join]');
    if (!form) return;

    const tokenEl = qs(form,'#token');
    const genBtn  = document.getElementById('genTokenBtn');
    const rulesTa = document.getElementById('rules_text');
    const rulesCounter = document.getElementById('rules_count');
    const msgEl   = document.getElementById('msg');
    const resultEl= document.getElementById('join-result');
    const verifyEl= document.getElementById('verify-token');

    if (genBtn && tokenEl){
      genBtn.addEventListener('click', ()=> {
        tokenEl.value = Math.random().toString(16).slice(2,10).toUpperCase();
      });
    }
    if (rulesTa && rulesCounter){
      const upd=()=>{ rulesCounter.textContent = (rulesTa.value||'').length; };
      rulesTa.addEventListener('input',upd); upd();
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msgEl.innerHTML = ''; 
      resultEl.textContent = ''; 
      verifyEl.textContent = '';

      const fd = new FormData(form);
      
      // Пошаговая валидация перед отправкой
      let hasErrors = false;

      // 1. Проверяем имя команды
      const teamError = await validateTeamName(fd.get('team'));
      if (teamError) {
        showValidationError(teamInput, teamError);
        hasErrors = true;
      }

      // 2. Проверяем YouTube URLs
      const channelError = validateYouTubeUrl(fd.get('channel_url'), 'channel');
      if (channelError) {
        showValidationError(channelInput, channelError);
        hasErrors = true;
      }

      const playlistError = validateYouTubeUrl(fd.get('playlist_url'), 'playlist');
      if (playlistError) {
        showValidationError(playlistInput, playlistError);
        hasErrors = true;
      }

      // 3. Проверяем правила
      const rules_text = String(fd.get('rules_text')||'').trim();
      if (!(rules_text.length>=500 && rules_text.length<=3000)){
        showValidationError(rulesTa, `Rules text must be 500–3000 characters (current: ${rules_text.length})`);
        hasErrors = true;
      }

      if (hasErrors) {
        msgEl.innerHTML = '<div style="color:#ff4444;margin-top:8px">Please correct the errors before submitting.</div>';
        return;
      }

      const initPayload = {
        action: 'register_init',
        team: String(fd.get('team')||'').trim(),
        channel_url: String(fd.get('channel_url')||'').trim(),
        playlist_url:String(fd.get('playlist_url')||'').trim(),
        contact:     String(fd.get('contact')||'').trim(),
        country:     String(fd.get('country')||'').trim(),
        city:        String(fd.get('city')||'').trim(),
        accept_rules: !!fd.get('accept_rules'),
        accept_policy:!!fd.get('accept_policy'),
      };

      try{
        // 1. Инициализация
        const initProgress = showProgress('Step 1/3: Initializing registration...', msgEl);
        const init = await jsonpCall(initPayload);
        if (!init || !init.ok) {
          initProgress.style.background = '#ff4444';
          throw new Error(init && init.error || 'Registration initialization failed');
        }
        initProgress.style.background = '#4caf50';
        initProgress.textContent += ' ✓';

        // 2. Загрузка правил
        const rulesProgress = showProgress('Step 2/3: Uploading rules...', msgEl);
        const chunks = chunkString(rules_text, 700);
        for (let i=0; i<chunks.length; i++){
          rulesProgress.textContent = `Step 2/3: Uploading rules (${i+1}/${chunks.length})...`;
          const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:chunks[i] });
          if (!put || !put.ok) {
            rulesProgress.style.background = '#ff4444';
            throw new Error(put && put.error || (`Rules upload failed at part ${i+1}`));
          }
        }
        rulesProgress.style.background = '#4caf50';
        rulesProgress.textContent += ' ✓';

        // 3. Финализация
        const finProgress = showProgress('Step 3/3: Finalizing registration...', msgEl);
        const fin = await jsonpCall({ action:'rules_commit', id:init.id });
        if (!fin || !fin.ok) {
          finProgress.style.background = '#ff4444';
          throw new Error(fin && fin.error || 'Registration finalization failed');
        }
        finProgress.style.background = '#4caf50';
        finProgress.textContent += ' ✓';

        resultEl.textContent = 'Registration successful! Your token has been generated.';
        resultEl.style.color = '#4caf50';
        verifyEl.textContent = 'Verification token: ' + (fin.verify_token || init.verify_token || '(see email/DM)');
        if (tokenEl) tokenEl.value = (fin.verify_token || init.verify_token || '');

      }catch(err){
        msgEl.textContent = 'Network or API error: ' + String(err.message||err);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', main);
})();
