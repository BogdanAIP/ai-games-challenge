(function(){
  function endpoint(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      const tag=document.getElementById('site-config');
      if(tag&&tag.textContent){const c=JSON.parse(tag.textContent);if(c&&c.FORM_ENDPOINT) return c.FORM_ENDPOINT;}
    }catch(_){}
    return window.FORM_ENDPOINT;
  }
  function jsonp(payload, timeoutMs){
    return new Promise(function(resolve,reject){
      const cb='cb_'+Math.random().toString(36).slice(2);
      const s=document.createElement('script');
      const u=new URL(endpoint());
      u.searchParams.set('callback',cb);
      u.searchParams.set('payload',JSON.stringify(payload));
      let done=false;
      window[cb]=(resp)=>{ if(done) return; done=true; cleanup(); resolve(resp); };
      s.onerror=()=>{ if(done) return; done=true; cleanup(); reject(new Error('JSONP error')); };
      const to=setTimeout(()=>{ if(done) return; done=true; cleanup(); reject(new Error('timeout')); }, timeoutMs||30000);
      function cleanup(){ try{clearTimeout(to);}catch(_){}
        try{delete window[cb];}catch(_){}
        if(s.parentNode) s.parentNode.removeChild(s);
      }
      s.src=u.toString();
      document.head.appendChild(s);
    });
  }

  let STATE=null;
  function appendBubble(cls, text){
    const box=document.getElementById('regbot-box');
    if(!box) return;
    const div=document.createElement('div'); div.className=cls; div.textContent=text; box.appendChild(div); box.scrollTop=box.scrollHeight;
  }

  async function send(msg){
    const input=document.getElementById('regbot-input');
    appendBubble('regbot-a', msg);
    try{
      const res=await jsonp({ action:'register', state:STATE, reply:msg }, 45000);
      if(!res || !res.ok){ appendBubble('regbot-q','Ошибка: ' + (res && res.error || 'server')); return; }
      STATE=res.state||STATE;
      const text = (res.done && res.verify_token)
        ? ('Заявка принята! Токен: ' + res.verify_token + ' (скопировано). Добавьте его в описание плейлиста.')
        : (res.msg || res.ask || 'Ок');
      appendBubble('regbot-q', text);
      if(res.done && res.verify_token){ try{navigator.clipboard.writeText(res.verify_token);}catch(_){ } }
    }catch(e){
      appendBubble('regbot-q', 'Network error: ' + e.message);
    }
    if(input) input.focus();
  }

  document.addEventListener('DOMContentLoaded', function(){
    const btnSend=document.getElementById('regbot-send');
    const btnStart=document.getElementById('regbot-start');
    const input=document.getElementById('regbot-input');

    if(btnStart){
      btnStart.addEventListener('click', async ()=>{
        const res = await jsonp({ action:'register', text:'start' }, 30000);
        STATE = res && res.state || null;
        appendBubble('regbot-q', res && (res.ask || res.msg) || 'Привет! Как называется команда?');
        input && input.focus();
      });
    }
    if(btnSend && input){
      btnSend.addEventListener('click', ()=>{ const v=String(input.value||'').trim(); if(!v) return; input.value=''; send(v); });
      input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ btnSend.click(); } });
    }
  });
})();
