/** =========================== registration.js ===========================
 * Регистрация: двухфазный поток + антидубликаты + строгая шапка.
 * - register_init: проверка дублей -> запись draft + verify_token
 * - rules_put / rules_commit: длинный текст правил (500–3000)
 * ======================================================================= */

function normalizeChannelUrl_(s){
  s = String(s||'').trim();
  if (!s) return '';
  if (/^@[\w.\-]+$/i.test(s)) return 'https://www.youtube.com/' + s.replace(/^@/,'@');
  s = s.replace(/^https?:\/\/youtu\.be\//i, 'https://www.youtube.com/');
  var m = s.match(/^https?:\/\/(www\.)?youtube\.com\/([^?#]+)(?:[?#].*)?$/i);
  if (m){
    var path = m[2];
    if (/^channel\/[A-Za-z0-9_\-]+$/i.test(path)) return 'https://www.youtube.com/' + path;
    if (/^@[\w.\-]+$/i.test(path)) return 'https://www.youtube.com/' + path;
  }
  return s;
}
function isValidChannelUrl_(u){
  u = String(u||'').trim();
  if (!u) return false;
  if (/^@[\w.\-]+$/i.test(u)) return true;
  if (/^https?:\/\/(www\.)?youtube\.com\/channel\/[A-Za-z0-9_\-]+$/i.test(u)) return true;
  if (/^https?:\/\/(www\.)?youtube\.com\/@[\w.\-]+$/i.test(u)) return true;
  return false;
}
function isValidPlaylistUrl_(u){
  u = String(u||'').trim();
  if (!u) return false;
  return /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[A-Za-z0-9_\-]+/i.test(u);
}
function assert_(cond, msg, extra){
  if (!cond){
    var e = new Error(msg||'Validation error');
    if (extra) e.extra = extra;
    throw e;
  }
}
function makeToken_(){
  var s = Utilities.getUuid().replace(/-/g,'').toUpperCase();
  return s.slice(-8);
}

function ensureRegSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  var header = ['ts','id','team','channel_url','playlist_url','contact','country','city','verify_token','status','notes'];
  if (!sh){
    sh = ss.insertSheet('Registrations');
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  // Жёстко ставим шапку и отрезаем лишние правые столбцы (на всякий случай)
  var lastCol = sh.getLastColumn();
  if (lastCol > header.length) sh.deleteColumns(header.length+1, lastCol-header.length);
  sh.getRange(1,1,1,header.length).setValues([header]);
  return sh;
}

/** Поиск дубля: совпадение по team (ci), channel_url (ci), playlist_url, contact */
function findDuplicateReg_(data){
  var sh = ensureRegSheet_();
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length <= 1) return null;

  var iId=1,iTeam=2,iCh=3,iPl=4,iContact=5;
  var team = String(data.team||'').trim().toLowerCase();
  var ch   = String(data.channel_url||'').trim().toLowerCase();
  var pl   = String((data.playlist_url||'')).trim().toLowerCase();
  var ct   = String(data.contact||'').trim().toLowerCase();

  for (var r=1; r<vals.length; r++){
    var v = vals[r];
    var vTeam = String(v[iTeam]||'').trim().toLowerCase();
    var vCh   = String(v[iCh]||'').trim().toLowerCase();
    var vPl   = String(v[iPl]||'').trim().toLowerCase();
    var vCt   = String(v[iContact]||'').trim().toLowerCase();
    if (team && vTeam && team === vTeam) return { id: v[iId], by:'team' };
    if (ch   && vCh   && ch   === vCh)   return { id: v[iId], by:'channel_url' };
    if (pl   && vPl   && pl   === vPl)   return { id: v[iId], by:'playlist_url' };
    if (ct   && vCt   && ct   === vCt)   return { id: v[iId], by:'contact' };
  }
  return null;
}

/** ====== ЧАНК-ХРАНИЛКА ====== */
function _chunkKey_(id){ return 'rules_chunks:' + id; }
function _getChunks_(id){
  var raw = PropertiesService.getScriptProperties().getProperty(_chunkKey_(id)) || '[]';
  try { return JSON.parse(raw); } catch(_){ return []; }
}
function _setChunks_(id, arr){
  PropertiesService.getScriptProperties().setProperty(_chunkKey_(id), JSON.stringify(arr||[]));
}
function _clearChunks_(id){
  PropertiesService.getScriptProperties().deleteProperty(_chunkKey_(id));
}

/** ====== RULES ====== */
function ensureRulesSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Rules');
  var header = ['ts','reg_id','team','country','city','channel_url','playlist_url','rules_len','rules_text'];
  if (!sh){
    sh = ss.insertSheet('Rules');
    sh.getRange(1,1,1,header.length).setValues([header]);
  }else if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}

/** 1) register_init: антидубликаты + draft-строка + verify_token */
function registerInit_(data){
  try{
    data = data || {};
    // Сначала приведём шапку к норме
    try{ fixRegistrationsHeader_(); }catch(_){}
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || '').trim();
    var contact = String(data.contact||'').trim();
    var country = String(data.country||'').trim();
    var city    = String(data.city||'').trim();
    var acceptRules  = !!data.accept_rules;
    var acceptPolicy = !!data.accept_policy;

    assert_(team, 'Missing field: team');
    assert_(chUrl, 'Missing field: channel_url');
    assert_(isValidChannelUrl_(chUrl), 'Invalid channel_url', { got:String(data.channel_url||''), normalized:chUrl });
    assert_(plUrl, 'Missing field: playlist_url');
    assert_(isValidPlaylistUrl_(plUrl), 'Invalid playlist_url', { got:plUrl });
    assert_(contact, 'Missing field: contact');
    assert_(country, 'Missing field: country');
    assert_(acceptRules,  'Missing consent: accept_rules');
    assert_(acceptPolicy, 'Missing consent: accept_policy');

    var dupe = findDuplicateReg_({ team:team, channel_url:chUrl, playlist_url:plUrl, contact:contact });
    if (dupe){
      return { ok:false, error:'duplicate_'+dupe.by, duplicate_of: dupe.id };
    }

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();
    sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'draft', '' ]);
    return { ok:true, id:id, verify_token:token, team:team, channel_url:chUrl, playlist_url:plUrl, country:country, city:city, status:'draft' };
  }catch(err){
    try{ logErr_('registerInit_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** 2) rules_put */
function rulesPut_(data){
  try{
    data = data || {};
    var id   = String(data.id||'').trim();
    var seq  = Number(data.seq||0)|0;
    var chunk= String(data.chunk||'');
    assert_(id, 'Missing field: id');
    assert_(chunk, 'Missing field: chunk');
    var arr = _getChunks_(id); arr[seq] = chunk; _setChunks_(id, arr);
    return { ok:true, id:id, stored:true, seq:seq };
  }catch(err){
    try{ logErr_('rulesPut_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** 3) rules_commit */
function rulesCommit_(data){
  try{
    data = data || {};
    var id = String(data.id||'').trim();
    assert_(id, 'Missing field: id');

    var sh = ensureRegSheet_();
    var vals = sh.getDataRange().getValues();
    if (!vals || vals.length <= 1) throw new Error('No registrations');
    var iId=1,iTeam=2,iCh=3,iPl=4,iContact=5,iCountry=6,iCity=7,iToken=8,iStatus=9;
    var rowIndex=-1,row=null;
    for (var r=1; r<vals.length; r++){
      if (String(vals[r][iId]) === id){ rowIndex=r; row=vals[r]; break; }
    }
    assert_(rowIndex>=1, 'Registration not found');

    var text = String((_getChunks_(id)||[]).join('')||'').trim();
    assert_(text.length>=500 && text.length<=3000, 'rules_text must be 500–3000 chars');

    var shRules = ensureRulesSheet_();
    shRules.appendRow([ new Date(), id, row[iTeam]||'', row[iCountry]||'', row[iCity]||'', row[iCh]||'', row[iPl]||'', text.length, text ]);

    sh.getRange(rowIndex+1, iStatus+1).setValue('new');
    _clearChunks_(id);
    
    // уведомления: email + Telegram канал
    try{
      notifyOnRegistration_({
        team: row[iTeam]||'',
        channel_url: row[iCh]||'',
        playlist_url: row[iPl]||'',
        country: row[iCountry]||'',
        city: row[iCity]||'',
        contact: row[iContact]||'',
        verify_token: row[iToken]||''
      });
    }catch(_){}

    return { ok:true, id:id, rules_len:text.length, status:'new', verify_token: row[iToken] };
  }catch(err){
    try{ logErr_('rulesCommit_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

// ===== Bot dialog (EN/RU), asks for RULES text (500–3000), front sends chunks =====
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{}, lang:'' };
    var reply = String(data.reply || data.text || '').trim();

    function ask(txt){ return { ok:true, ask:txt, state:state }; }
    function setLang(s){
      s = (s||'').toLowerCase();
      if (/^en(g|glish)?$/.test(s)) return 'en';
      if (/^ru(ssian)?$/.test(s) || s==='русский' || s==='ру') return 'ru';
      return '';
    }

    switch (state.step|0){
      case 0: {
        state = { step:1, payload:{}, lang:'' };
        return ask('Choose language: English or Russian?\nВыберите язык: English или Русский?');
      }
      case 1: {
        var L = setLang(reply);
        if (!L) return ask('Choose language: English or Russian?\nВыберите язык: English или Русский?');
        state.lang = L;
        state.step = 2;
        return ask(L==='ru' ? 'Как называется ваша команда?' : 'What is your team name?');
      }
      case 2: {
        if (!reply) return ask(state.lang==='ru' ? 'Пожалуйста, укажите название команды' : 'Please enter your team name');
        state.payload.team = reply;
        state.step = 3;
        return ask(state.lang==='ru'
          ? 'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):'
          : 'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      }
      case 3: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch))
          return ask(state.lang==='ru'
            ? 'Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID'
            : 'Does not look like a channel link. Send https://youtube.com/@handle or https://youtube.com/channel/ID');
        state.payload.channel_url = ch;
        state.step = 4;
        return ask(state.lang==='ru'
          ? 'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):'
          : 'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }
      case 4: {
        if (!isValidPlaylistUrl_(reply))
          return ask(state.lang==='ru'
            ? 'Нужен именно плейлист: https://youtube.com/playlist?list=...'
            : 'It must be a playlist: https://youtube.com/playlist?list=...');
        state.payload.playlist_url = reply;
        state.step = 5;
        return ask(state.lang==='ru'
          ? 'Страна/регион (например, RU, UA, KZ):'
          : 'Country/region (e.g., RU, UA, KZ):');
      }
      case 5: {
        if (!reply) return ask(state.lang==='ru' ? 'Укажите страну (две буквы, например RU):' : 'Please provide country code (e.g., RU)');
        state.payload.country = reply;
        state.step = 6;
        return ask(state.lang==='ru'
          ? 'Город (опционально — можно пропустить, отправив "-" ):'
          : 'City (optional — send "-" to skip):');
      }
      case 6: {
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 7;
        return ask(state.lang==='ru'
          ? 'Контакт (email или @username):'
          : 'Contact (email or @username):');
      }
      case 7: {
        if (!reply) return ask(state.lang==='ru' ? 'Пожалуйста, укажите контакт' : 'Please provide a contact');
        state.payload.contact = reply;
        state.step = 8;
        return ask(state.lang==='ru'
          ? 'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).'
          : 'Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      }
      case 8: {
        var ok = reply.toLowerCase();
        if (!(ok==='да' || ok==='yes' || ok==='y'))
          return ask(state.lang==='ru'
            ? 'Нужно согласие с Правилами и Политикой. Напишите "да", если согласны.'
            : 'You must agree to the Rules and the Privacy Policy. Type "yes" to continue.');
        state.step = 9;
        // === КЛЮЧЕВОЙ ШАГ С ПРАВИЛАМИ: фраза специально сделана,
        // чтобы фронт (app.regbot.js) распознал и отправил текст чанками ===
        return ask(state.lang==='ru'
          ? 'Вставьте ТЕКСТ ПРАВИЛ (500–3000 символов) одним сообщением:'
          : 'Paste your RULES text (500–3000 characters) in a single message:');
      }
      default:
        // Ждём, что фронт перехватит шаг 9, выполнит register_init + rules_put + rules_commit,
        // и вернёт финал уже внутри UI. Сбросим, если вдруг зашли сюда.
        state = { step:0, payload:{}, lang: state.lang || '' };
        return ask(state.lang==='ru'
          ? 'Начнём заново. Как называется ваша команда?'
          : 'Let\'s start over. What is your team name?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
