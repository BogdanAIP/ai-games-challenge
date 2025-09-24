(function(){
  // оставим возможность переопределить через inline-скрипт
  if (!window.FORM_ENDPOINT) {
    window.FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx81KK5qfSzIpRHLyemRPfafF3f-zCsHlaQVMh3Z0p68CTHcjp8RWz-9WG2OtsbYQX0/exec';
  }

  function $(sel){ return document.querySelector(sel); }

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      var cb = 'cb_' + Math.random().toString(36).slice(2);
      var timer = setTimeout(function(){
        cleanup();
        reject(new Error('JSONP timeout'));
      }, timeoutMs || 15000);

      function cleanup(){
        clearTimeout(timer);
        try { delete window[cb]; } catch(e){}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function(data){
        cleanup();
        resolve(data);
      };

      var src = window.FORM_ENDPOINT
        + '?callback=' + encodeURIComponent(cb)
        + '&payload=' + encodeURIComponent(JSON.stringify(payload));

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
      document.head.appendChild(script);
    });
  }

  function genToken(){
    var r = Math.random().toString(36).slice(2,8).toUpperCase();
    var ts= Date.now().toString(36).toUpperCase();
    return 'AIGC-' + r + '-' + ts;
  }

  async function fileToBase64(file){
    if(!file) return null;
    const buf = await file.arrayBuffer();
    let s=''; const b=new Uint8Array(buf);
    for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]);
    return btoa(s);
  }

  function setMsg(text, cls){
    var el = $('#msg'); if(!el) return;
    el.className = 'note' + (cls ? ' ' + cls : '');
    el.textContent = text;
  }

  async function mint(){
    setMsg('Minting token…');
    try{
      const data = await jsonpCall({ action:'mint' }, 12000);
      if(!data || !data.ok) throw new Error(data && data.error || 'mint failed');
      var t = $('#token'); if(t) t.value = data.token || '';
      setMsg('Token generated.','ok');
    }catch(err){
      setMsg('Mint error: '+err.message, 'err');
    }
  }

  async function onSubmit(ev){
    ev.preventDefault();
    setMsg('Submitting…');
    const fd = new FormData(ev.target);
    const required = ['team','country','contact','channel_url','playlist_url','token'];
    for (const k of required){
      if(!fd.get(k) || String(fd.get(k)).trim()===''){
        setMsg('Please fill all required fields.','err'); return;
      }
    }
    const file = fd.get('rules_file');
    if (file && file.size > 5*1024*1024){ setMsg('File too large (max 5 MB).','err'); return; }

    const payload = {
      team: fd.get('team'),
      country: fd.get('country'),
      contact: fd.get('contact'),
      channel_url: fd.get('channel_url'),
      playlist_url: fd.get('playlist_url'),
      notes: fd.get('notes') || ''
    };
    if (file && file.size){
      payload.file = { name:file.name, mime:file.type||'application/octet-stream', base64: await fileToBase64(file) };
    }

    try{
      const data = await jsonpCall(payload, 20000);
      if(!data || !data.ok) throw new Error((data && data.error) || 'Submission failed');
      setMsg('✅ Submitted. Registration #'+data.issue_number+'. We’ll review it soon.','ok');
      ev.target.reset();
      var t = $('#token'); if(t) t.value = genToken();
    }catch(err){
      setMsg('Submission error: '+err.message, 'err');
    }
  }

  function boot(){
    var tokenEl = $('#token');
    if(tokenEl && !tokenEl.value) tokenEl.value = genToken();
    var genBtn = $('#genTokenBtn');
    if(genBtn) genBtn.addEventListener('click', function(){ tokenEl.value = genToken(); tokenEl.focus(); tokenEl.select(); });
    var form = document.getElementById('joinForm');
    if(form) form.addEventListener('submit', onSubmit);
    // самотест:
    console.log('FORM_ENDPOINT =', window.FORM_ENDPOINT);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
