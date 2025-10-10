/** registration.js — регистрация (ручная/бот), анти-дубли, правила чанками **/
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
  if (!sh){ sh = ss.insertSheet('Registrations'); }
  sh.getRange(1,1,1,header.length).setValues([header]); // всегда жёсткая шапка
  return sh;
}
function ensureRulesSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Rules');
  var header = ['ts','reg_id','team','country','city','channel_url','playlist_url','rules_len','rules_text'];
  if (!sh){ sh = ss.insertSheet('Rules'); }
  sh.getRange(1,1,1,header.length).setValues([header]);
  return sh;
}
function readRegs_(){
  var sh = ensureRegSheet_();
  var vals = sh.getDataRange().getValues();
  return { sh:sh, vals: vals && vals.length ? vals : [] };
}
function findDup_(vals, team, ch, contact){
  var dup = { team:false, channel:false, contact:false };
  // индексы: [ts=0,id=1,team=2,channel=3,playlist=4,contact=5,country=6,city=7,token=8,status=9,notes=10]
  for (var r=1; r<vals.length; r++){
    var row = vals[r] || [];
    var st  = String(row[9]||'').toLowerCase(); // status
    if (st === 'rejected') continue;
    if (team && String(row[2]||'').trim().toLowerCase() === team.toLowerCase()) dup.team = true;
    if (ch && String(row[3]||'').trim().toLowerCase()   === ch.toLowerCase())    dup.channel = true;
    if (contact && String(row[5]||'').trim().toLowerCase()=== contact.toLowerCase()) dup.contact = true;
  }
  return dup;
}
/** публичная проверка дублей (для фронта на blur) */
function checkUnique_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var channel = String(normalizeChannelUrl_(data.channel_url)||'').trim();
    var contact = String(data.contact||'').trim();
    var vals = readRegs_().vals;
    var dup = findDup_(vals, team, channel, contact);
    return { ok:true, exists_team:dup.team, exists_channel:dup.channel, exists_contact:dup.contact };
  }catch(err){
    return { ok:false, error:String(err && err.message || err) };
  }
}
/** 1) register_init — создаём запись (draft), анти-дубли */
function registerInit_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url||'').trim();
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

    var rr = readRegs_();
    var dup = findDup_(rr.vals, team, chUrl, contact);
    if (dup.team)    throw Object.assign(new Error('duplicate_team'),    { code:'duplicate_team' });
    if (dup.channel) throw Object.assign(new Error('duplicate_channel'), { code:'duplicate_channel' });
    if (dup.contact) throw Object.assign(new Error('duplicate_contact'), { code:'duplicate_contact' });

    var id = Utilities.getUuid();
    var token = makeToken_();
    rr.sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'draft', '' ]);
    PropertiesService.getScriptProperties().deleteProperty('rules_chunks:'+id); // clear
    try{ notifyOnRegistrationStub_(id, team, contact); }catch(_){}

    return { ok:true, id:id, verify_token:token, team:team, channel_url:chUrl, playlist_url:plUrl, country:country, city:city, status:'draft' };
  }catch(err){
    return { ok:false, error:String(err && err.message || err), code: err && err.code };
  }
}
/** хранение чанков правил */
function _ck(id){ return 'rules_chunks:'+id; }
function _getChunks(id){ var raw = PropertiesService.getScriptProperties().getProperty(_ck(id)) || '[]'; try{ return JSON.parse(raw); }catch(_){return [];} }
function _setChunks(id, arr){ PropertiesService.getScriptProperties().setProperty(_ck(id), JSON.stringify(arr||[])); }
function _clearChunks(id){ PropertiesService.getScriptProperties().deleteProperty(_ck(id)); }
/** 2) rules_put */
function rulesPut_(data){
  try{
    var id = String(data.id||'').trim();
    var seq = Number(data.seq||0)|0;
    var chunk = String(data.chunk||'');
    assert_(id, 'Missing field: id');
    assert_(chunk, 'Missing field: chunk');
    var arr = _getChunks(id); arr[seq]=chunk; _setChunks(id, arr);
    return { ok:true, id:id, stored:true, seq:seq };
  }catch(err){ return { ok:false, error:String(err && err.message || err) }; }
}
/** 3) rules_commit */
function rulesCommit_(data){
  try{
    var id = String(data.id||'').trim();
    assert_(id, 'Missing field: id');
    var rr = readRegs_(); var vals = rr.vals;
    if (!vals || vals.length<=1) throw new Error('No registrations');
    var iId=1,iTeam=2,iCh=3,iPl=4,iContact=5,iCountry=6,iCity=7,iToken=8,iStatus=9;
    var rowIndex=-1,row=null;
    for (var r=1;r<vals.length;r++){ if (String(vals[r][iId])===id){ rowIndex=r; row=vals[r]; break; } }
    assert_(rowIndex>=1, 'Registration not found');

    var chunks = _getChunks(id);
    var text = String((chunks||[]).join('')||'').trim();
    assert_(text.length>=500 && text.length<=3000, 'rules_text must be 500–3000 chars');

    var shR = ensureRulesSheet_();
    shR.appendRow([ new Date(), id, row[iTeam]||'', row[iCountry]||'', row[iCity]||'', row[iCh]||'', row[iPl]||'', text.length, text ]);
    rr.sh.getRange(rowIndex+1, iStatus+1).setValue('new');
    _clearChunks(id);
    return { ok:true, id:id, rules_len:text.length, status:'new', verify_token: String(row[iToken]||'') };
  }catch(err){ return { ok:false, error:String(err && err.message || err) }; }
}

/** Диалоговый бот — использует прежнюю state-машину; финально просим вставить правила (500–3000) */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{} };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }
    // 0: язык
    switch (state.step|0){
      case 0:
        state={ step:1, payload:{}, lang:'' };
        return ask('Choose language: English or Russian? / Выберите язык: English или Русский?');
      case 1: {
        var r = reply.toLowerCase();
        if (['english','en','английский','англ'].indexOf(r)>=0){ state.lang='en'; }
        else if (['russian','ru','русский','рус'].indexOf(r)>=0){ state.lang='ru'; }
        else return ask('Please type "English" or "Russian" / Напишите "English" или "Русский"');
        state.step=2;
        return ask(state.lang==='ru' ? 'Как называется ваша команда?' : 'What is your team name?');
      }
      case 2:
        if (!reply) return ask(state.lang==='ru' ? 'Укажите название команды' : 'Please provide your team name');
        state.payload.team = reply; state.step=3;
        return ask(state.lang==='ru'
          ? 'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):'
          : 'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      case 3: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask(state.lang==='ru'
          ? 'Это не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID'
          : 'Does not look like a channel URL. Send https://youtube.com/@handle or https://youtube.com/channel/ID');
        state.payload.channel_url = ch; state.step=4;
        return ask(state.lang==='ru'
          ? 'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):'
          : 'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }
      case 4:
        if (!isValidPlaylistUrl_(reply)) return ask(state.lang==='ru'
          ? 'Нужен плейлист вида https://youtube.com/playlist?list=...'
          : 'Please send playlist URL like https://youtube.com/playlist?list=...');
        state.payload.playlist_url = reply; state.step=5;
        return ask(state.lang==='ru'
          ? 'Страна/регион (например, RU, UA, KZ):'
          : 'Country/region (e.g., RU, UA, KZ):');
      case 5:
        if (!reply) return ask(state.lang==='ru' ? 'Укажите страну' : 'Please provide country/region');
        state.payload.country = reply; state.step=6;
        return ask(state.lang==='ru'
          ? 'Город (опционально — можно пропустить, отправив "-"):'
          : 'City (optional — send "-" to skip):');
      case 6:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step=7;
        return ask(state.lang==='ru'
          ? 'Контактное лицо (email или @username):'
          : 'Contact (email or @username):');
      case 7:
        if (!reply) return ask(state.lang==='ru' ? 'Укажите контакт' : 'Please provide contact');
        state.payload.contact = reply; state.step=8;
        return ask(state.lang==='ru'
          ? 'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).'
          : 'Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      case 8: {
        var yes = reply.toLowerCase();
        if (!(yes==='да'||yes==='yes'||yes==='y')) {
          return ask(state.lang==='ru'
            ? 'Нужно согласие, чтобы продолжить. Напишите "да".'
            : 'You need to agree to continue. Type "yes".');
        }
        state.step=9;
        return ask(state.lang==='ru'
          ? 'Вставьте ТЕКСТ ПРАВИЛ (500–3000 символов) одним сообщением:'
          : 'Paste the RULES TEXT (500–3000 characters) in one message:');
      }
      case 9: {
        var txt = String(reply||'').trim();
        if (!(txt.length>=500 && txt.length<=3000)){
          return ask(state.lang==='ru'
            ? 'Текст правил должен быть 500–3000 символов. Пришлите ещё раз.'
            : 'Rules text must be 500–3000 chars. Please send again.');
        }
        // init + chunks + commit
        var init = registerInit_({
          team: state.payload.team, channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url, country: state.payload.country,
          city: state.payload.city||'', contact: state.payload.contact,
          accept_rules:true, accept_policy:true
        });
        if (!init.ok){
          var msg = (state.lang==='ru') ? 'Ошибка инициализации регистрации: ' : 'Registration init error: ';
          return { ok:false, error: msg + (init.error||'') };
        }
        var arr=[]; for (var i=0;i<txt.length;i+=700) arr.push(txt.slice(i,i+700));
        for (var k=0;k<arr.length;k++){
          var put = rulesPut_({ id:init.id, seq:k, chunk:arr[k] }); if (!put.ok) return { ok:false, error:'rules_put failed' };
        }
        var fin = rulesCommit_({ id:init.id }); if (!fin.ok) return { ok:false, error:'rules_commit failed: '+(fin.error||'') };
        state.step=10;
        var doneMsg = (state.lang==='ru')
          ? ('Заявка сохранена. Ваш токен: '+(fin.verify_token||init.verify_token)+'. Вставьте его в описание плейлиста.')
          : ('Application saved. Your token: '+(fin.verify_token||init.verify_token)+'. Paste it into your playlist description.');
        return { ok:true, done:true, verify_token:(fin.verify_token||init.verify_token), msg:doneMsg, state:state };
      }
      default:
        state = { step:0, payload:{}, lang:'' };
        return ask('Choose language: English or Russian? / Выберите язык: English или Русский?');
    }
  }catch(err){
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** уведомления-заглушки (включатся, если настроены свойства) */
function notifyOnRegistrationStub_(id, team, contact){
  try{
    var email = /@/.test(contact) ? contact : '';
    if (email) {
      try{ MailApp.sendEmail(email, 'AI Games Challenge — Registration received', 'Your registration has been received. We will verify your playlist soon.'); }catch(_){}
    }
    var bot = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
    var chat= PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
    if (bot && chat){
      var msg = 'New registration: '+team+' (id '+id+')';
      var url = 'https://api.telegram.org/bot'+bot+'/sendMessage';
      UrlFetchApp.fetch(url, { method:'post', payload:{ chat_id:chat, text:msg, disable_web_page_preview:'true' }, muteHttpExceptions:true });
    }
  }catch(_){}
}


// DUP-CHECK HELPERS

function _regVals_(){
  var ss = SS_(); var sh = ss.getSheetByName('Registrations');
  return sh ? sh.getDataRange().getValues() : null;
}
function isDuplicateTeam_(name){
  name = String(name||'').trim().toLowerCase(); if (!name) return false;
  var vals = _regVals_(); if (!vals || vals.length<=1) return false;
  for (var r=1;r<vals.length;r++){
    var t = String(vals[r][2]||'').trim().toLowerCase();
    if (t && t===name) return true;
  }
  return false;
}
function isDuplicateChannel_(url){
  var norm = normalizeChannelUrl_(url); if (!norm) return false;
  var vals = _regVals_(); if (!vals || vals.length<=1) return false;
  for (var r=1;r<vals.length;r++){
    var v = String(vals[r][3]||'').trim();
    if (v && v===norm) return true;
  }
  return false;
}
function isDuplicateContact_(c){
  c = String(c||'').trim().toLowerCase(); if (!c) return false;
  var vals = _regVals_(); if (!vals || vals.length<=1) return false;
  for (var r=1;r<vals.length;r++){
    var v = String(vals[r][5]||'').trim().toLowerCase();
    if (v && v===c) return true;
  }
  return false;
}

/** dup_check: {field:'team'|'channel_url'|'contact', value:'...'} */
function handleDupCheck_(data){
  try{
    data = data||{};
    var field = String(data.field||'').trim();
    var value = String(data.value||'').trim();
    if (!field) return { ok:false, error:'Missing field' };
    if (!value) return { ok:true, field:field, value:value, duplicate:false, valid:false };

    if (field==='team'){
      var dup = isDuplicateTeam_(value);
      return { ok:true, field:field, value:value, duplicate:dup, valid:!dup };
    }
    if (field==='channel_url'){
      var norm = normalizeChannelUrl_(value);
      var valid = isValidChannelUrl_(norm);
      var dup = valid ? isDuplicateChannel_(norm) : false;
      return { ok:true, field:field, value:value, normalized:norm, duplicate:dup, valid:valid && !dup };
    }
    if (field==='contact'){
      var dupc = isDuplicateContact_(value);
      var looksValid = /@/.test(value); // простая эвристика (email или @username)
      return { ok:true, field:field, value:value, duplicate:dupc, valid:looksValid && !dupc };
    }
    return { ok:false, error:'Unknown field' };
  }catch(err){
    try{ logErr_('handleDupCheck_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

