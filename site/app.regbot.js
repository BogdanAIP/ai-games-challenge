(function(){
  function getEndpoint(){
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
  document.addEventListener('DOMContentLoaded', function(){
    const box = document.getElementById('regbot-box');
    const input = document.getElementById('regbot-input');
    const btnSend = document.getElementById('regbot-send');
    const btnStart= document.getElementById('regbot-start');
    if (!box || !input || !btnSend || !btnStart) return;

    let STATE = { step:0, payload:{}, lang:'' };
    function printQ(t){ const p=document.createElement('div'); p.className='regbot-q'; p.textContent=t; box.appendChild(p); box.scrollTop=box.scrollHeight; }
    function printA(t){ const p=document.createElement('div'); p.className='regbot-a'; p.textContent=t; box.appendChild(p); box.scrollTop=box.scrollHeight; }

    async function send(payload){ try{ return await jsonpCall(payload); } catch(e){ return { ok:false, error:e.message||String(e) }; } }

    async function handle(msg){
      if (msg) printA(msg);
      const res = await send({ action:'register', state:STATE, reply: msg||'' });
      if (!res || !res.ok){ printQ('Error: '+(res && res.error || 'unknown')); return; }
      if (res.ask){ STATE = res.state||STATE; printQ(res.ask); return; }
      if (res.done){ STATE = res.state||STATE; printQ(res.msg || ('Your token: '+(res.verify_token||''))); return; }
    }

    async function sendRulesFlow(text){
      if (!(text && text.trim().length>=500 && text.trim().length<=3000)){
        printQ(STATE.lang==='ru' ? 'Текст правил должен быть 500–3000 символов.' : 'Rules text must be 500–3000 characters.'); return;
      }
      const init = await send({
        action:'register_init',
        team: STATE.payload.team,
        channel_url: STATE.payload.channel_url,
        playlist_url: STATE.payload.playlist_url,
        country: STATE.payload.country,
        city: STATE.payload.city || '',
        contact: STATE.payload.contact,
        accept_rules: true,
        accept_policy: true
      });
      if (!init || !init.ok){ printQ('Registration init error: '+(init && init.error||'')); return; }
      const t = text.trim(); const arr=[]; for(let i=0;i<t.length;i+=700) arr.push(t.slice(i,i+700));
      for (let i=0;i<arr.length;i++){
        const put = await send({ action:'rules_put', id:init.id, seq:i, chunk:arr[i] });
        if (!put || !put.ok){ printQ('rules_put failed'); return; }
      }
      const fin = await send({ action:'rules_commit', id:init.id });
      if (!fin || !fin.ok){ printQ('rules_commit failed: '+(fin && fin.error||'')); return; }
      printQ((STATE.lang==='ru')
        ? ('Заявка сохранена. Ваш токен: '+(fin.verify_token||init.verify_token)+'. Вставьте его в описание плейлиста.')
        : ('Application saved. Your token: '+(fin.verify_token||init.verify_token)+'. Paste it into your playlist description.'));
      STATE.step=0; STATE.payload={};
    }

    btnStart.addEventListener('click', ()=>{ box.innerHTML=''; STATE={step:0,payload:{},lang:''}; handle(''); });
    btnSend.addEventListener('click', async ()=>{
      const txt = (input.value||'').trim(); if (!txt) return;
      const lastQ = box.querySelector('.regbot-q:last-child');
      if (lastQ && /RULES.*500|ПРАВИЛ.*500/i.test(lastQ.textContent||'')){ printA(txt); input.value=''; await sendRulesFlow(txt); return; }
      await handle(txt); input.value='';
    });
  });
})();
