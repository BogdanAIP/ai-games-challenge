/** =========================== registration.js ===========================
 * No-duplicate registration + notifications (Email + Telegram).
 * Works with both: web two-phase (register_init / rules_put / rules_commit)
 * and dialog bot (handleRegistrationDialog_).
 * Duplicate keys: team (case-insensitive), channel_url (normalized),
 * playlist_url, contact (case-insensitive).
 * On duplicate: do NOT create new row; return existing id + verify_token.
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
function makeToken_(){ var s = Utilities.getUuid().replace(/-/g,'').toUpperCase(); return s.slice(-8); }

function ensureRegSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  var header = ['ts','id','team','channel_url','playlist_url','contact','country','city','verify_token','status','notes'];
  if (!sh){ sh = ss.insertSheet('Registrations'); }
  sh.getRange(1,1,1,header.length).setValues([header]);
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

/** ==== Duplicate finder (case-insens for team/contact; normalized url for channel) ==== */
function _lc(s){ return String(s||'').trim().toLowerCase(); }
function findDuplicateRegistration_(team, chUrl, plUrl, contact){
  var sh = ensureRegSheet_();
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length <= 1) return null;

  var keyTeam = _lc(team);
  var keyContact = _lc(contact);
  var keyCh = normalizeChannelUrl_(chUrl);
  var keyPl = String(plUrl||'').trim();

  // column indices under enforced header
  var iId=1, iTeam=2, iCh=3, iPl=4, iContact=5, iCountry=6, iCity=7, iToken=8, iStatus=9, iNotes=10;

  for (var r=1; r<vals.length; r++){
    var row = vals[r];
    var rowTeam = _lc(row[iTeam]);
    var rowContact = _lc(row[iContact]);
    var rowCh = normalizeChannelUrl_(row[iCh]);
    var rowPl = String(row[iPl]||'').trim();

    if (rowTeam && keyTeam && rowTeam === keyTeam){
      return { by:'team', id:row[iId], token:row[iToken], status:row[iStatus], team:row[iTeam] };
    }
    if (rowCh && keyCh && rowCh === keyCh){
      return { by:'channel_url', id:row[iId], token:row[iToken], status:row[iStatus], team:row[iTeam] };
    }
    if (rowPl && keyPl && rowPl === keyPl){
      return { by:'playlist_url', id:row[iId], token:row[iToken], status:row[iStatus], team:row[iTeam] };
    }
    if (rowContact && keyContact && rowContact === keyContact){
      return { by:'contact', id:row[iId], token:row[iToken], status:row[iStatus], team:row[iTeam] };
    }
  }
  return null;
}

/** ==== Notifications (best-effort; never fail the flow) ==== */
function _prop(k){ try{ return PropertiesService.getScriptProperties().getProperty(k)||''; }catch(_){ return ''; } }
function notifyOnRegistration_(rec){
  try{
    var adminEmail = _prop('ADMIN_EMAIL');
    var toUser = '';
    if (/@/.test(rec.contact||'')) toUser = String(rec.contact||'').trim();

    var subject = '[AI Games] Registration received: ' + rec.team;
    var body =
      'Team: ' + rec.team + '\n' +
      'Country/City: ' + (rec.country||'') + ' / ' + (rec.city||'') + '\n' +
      'Channel: ' + rec.channel_url + '\n' +
      'Playlist: ' + rec.playlist_url + '\n' +
      'Verify token: ' + rec.verify_token + '\n' +
      'Contact: ' + rec.contact + '\n' +
      'Status: ' + (rec.status||'new') + '\n';

    // email to user
    if (toUser){
      try{ MailApp.sendEmail({ to: toUser, subject: subject, htmlBody: body.replace(/\n/g,'<br>') }); }catch(_){}
    }
    // email to admin
    if (adminEmail){
      try{ MailApp.sendEmail({ to: adminEmail, subject: subject, htmlBody: body.replace(/\n/g,'<br>') }); }catch(_){}
    }
    // telegram channel
    var tgToken = _prop('TELEGRAM_BOT_TOKEN');
    var tgChat  = _prop('TELEGRAM_CHAT_ID');
    if (tgToken && tgChat){
      var text =
        '🟢 New team registered\n' +
        'Team: ' + rec.team + '\n' +
        'Country/City: ' + (rec.country||'') + ' / ' + (rec.city||'') + '\n' +
        'Playlist: ' + rec.playlist_url + '\n' +
        'Token: ' + rec.verify_token;
      try{
        UrlFetchApp.fetch('https://api.telegram.org/bot'+tgToken+'/sendMessage', {
          method:'post',
          payload:{ chat_id: tgChat, text: text, disable_web_page_preview:true }
        });
      }catch(_){}
    }
  }catch(_){}
}

/** ===== Web two-phase API ===== */
function registerInit_(data){
  try{
    data = data || {};
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

    // dedup
    var dup = findDuplicateRegistration_(team, chUrl, plUrl, contact);
    if (dup){
      return { ok:true, duplicate:true, id:dup.id, verify_token:dup.token, team:dup.team, status:dup.status };
    }

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();
    sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'draft', '' ]);
    // (уведомления шлём после commit правил, чтобы не дублировать)
    return { ok:true, id:id, verify_token:token, team:team, channel_url:chUrl, playlist_url:plUrl, country:country, city:city, status:'draft' };
  }catch(err){
    try{ logErr_('registerInit_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** chunk buffer for web flow */
function _chunkKey_(id){ return 'rules_chunks:' + id; }
function _getChunks_(id){ var raw = PropertiesService.getScriptProperties().getProperty(_chunkKey_(id)) || '[]'; try{ return JSON.parse(raw); }catch(_){ return []; } }
function _setChunks_(id, arr){ PropertiesService.getScriptProperties().setProperty(_chunkKey_(id), JSON.stringify(arr||[])); }
function _clearChunks_(id){ PropertiesService.getScriptProperties().deleteProperty(_chunkKey_(id)); }

function rulesPut_(data){
  try{
    data = data || {};
    var id   = String(data.id||'').trim();
    var seq  = Number(data.seq||0)|0;
    var chunk= String(data.chunk||'');
    assert_(id, 'Missing field: id');
    assert_(chunk, 'Missing field: chunk');
    var arr = _getChunks_(id);
    arr[seq] = chunk;
    _setChunks_(id, arr);
    return { ok:true, id:id, stored:true, seq:seq };
  }catch(err){
    try{ logErr_('rulesPut_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

function rulesCommit_(data){
  try{
    data = data || {};
    var id = String(data.id||'').trim();
    assert_(id, 'Missing field: id');

    var sh = ensureRegSheet_();
    var vals = sh.getDataRange().getValues();
    if (!vals || vals.length <= 1) throw new Error('No registrations');
    var iId=1, iTeam=2, iCh=3, iPl=4, iContact=5, iCountry=6, iCity=7, iToken=8, iStatus=9;

    var rowIndex = -1, row=null;
    for (var r=1; r<vals.length; r++){
      if (String(vals[r][iId]) === id){ rowIndex = r; row = vals[r]; break; }
    }
    assert_(rowIndex>=1, 'Registration not found');

    var chunks = _getChunks_(id);
    var text = (chunks||[]).join('');
    text = String(text||'').trim();
    assert_(text.length>=500 && text.length<=3000, 'rules_text must be 500–3000 chars');

    var shRules = ensureRulesSheet_();
    shRules.appendRow([
      new Date(), id, row[iTeam]||'', row[iCountry]||'', row[iCity]||'', row[iCh]||'', row[iPl]||'', text.length, text
    ]);

    sh.getRange(rowIndex+1, iStatus+1).setValue('new'); // draft -> new
    _clearChunks_(id);

    // notify (first-time only; for duplicates we never got here)
    try{
      notifyOnRegistration_({
        id:id, team:row[iTeam], channel_url:row[iCh], playlist_url:row[iPl],
        country:row[iCountry], city:row[iCity], verify_token:row[iToken], contact:row[iContact], status:'new'
      });
    }catch(_){}

    return { ok:true, id:id, rules_len:text.length, status:'new', verify_token: row[iToken] };
  }catch(err){
    try{ logErr_('rulesCommit_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** ===== Dialog bot (EN/RU), mandatory rules (500–3000), no duplicates ===== */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var st = data.state || { step:0, payload:{}, lang:'' };
    var reply = (data.reply || data.text || '').toString().trim();

    function A(t){ return { ok:true, ask:t, state: st }; }
    function L(p){ return (st.lang==='ru') ? (p.ru) : (p.en); }

    switch (st.step|0){
      case 0:
        st = { step:1, payload:{}, lang:'' };
        return A('Choose language: English or Russian?');
      case 1: {
        var r = reply.toLowerCase();
        if (/^en|english/i.test(r)) st.lang = 'en';
        else if (/^ru|рус/i.test(r)) st.lang = 'ru';
        else return A('Choose language: English or Russian?');
        st.step = 2;
        return A(L({ en:'What is your team name?', ru:'Как называется ваша команда?' }));
      }
      case 2: {
        if (!reply) return A(L({ en:'Please enter a team name', ru:'Пожалуйста, укажите название команды' }));
        st.payload.team = reply; st.step=3;
        return A(L({ en:'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):',
                     ru:'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):' }));
      }
      case 3: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return A(L({ en:'That does not look like a channel URL. Please send https://youtube.com/@handle or https://youtube.com/channel/ID',
                                                  ru:'Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID' }));
        st.payload.channel_url = ch; st.step=4;
        return A(L({ en:'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):',
                     ru:'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):' }));
      }
      case 4: {
        if (!isValidPlaylistUrl_(reply)) return A(L({ en:'Please send a valid playlist URL (https://youtube.com/playlist?list=...)',
                                                      ru:'Пришлите корректный плейлист (https://youtube.com/playlist?list=...)' }));
        st.payload.playlist_url = reply; st.step=5;
        return A(L({ en:'Country/region (e.g., RU, UA, KZ):', ru:'Страна/регион (например, RU, UA, KZ):' }));
      }
      case 5: {
        if (!reply) return A(L({ en:'Please provide a 2-letter country code', ru:'Укажите код страны из двух букв' }));
        st.payload.country = reply; st.step=6;
        return A(L({ en:'City (optional — send "-" to skip):', ru:'Город (опционально — можно пропустить, отправив "-"):' }));
      }
      case 6: {
        if (reply && reply !== '-') st.payload.city = reply;
        st.step = 7;
        return A(L({ en:'Contact (email or @username):', ru:'Контактное лицо (электронная почта или @имя пользователя):' }));
      }
      case 7: {
        if (!reply) return A(L({ en:'Please send a contact', ru:'Пожалуйста, укажите контакт' }));
        st.payload.contact = reply; st.step = 8;
        return A(L({ en:'Paste a short RULES text (500–3000 chars).',
                     ru:'Вставьте краткий текст ПРАВИЛ (500–3000 символов).' }));
      }
      case 8: {
        var rules = String(reply||'').trim();
        if (!(rules.length>=500 && rules.length<=3000)){
          return A(L({ en:'Rules text must be 500–3000 characters. Please paste again.',
                       ru:'Текст правил должен быть 500–3000 символов. Пожалуйста, пришлите ещё раз.' }));
        }
        st.payload.rules_text = rules; st.step = 9;
        return A(L({ en:'Confirm you agree to the Rules and the Privacy Policy (yes/no).',
                     ru:'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).' }));
      }
      case 9: {
        var yes = reply.toLowerCase();
        if (!(/^(y|yes|да)$/.test(yes))) {
          return A(L({ en:'We need your consent to continue. Type "yes" if you agree.',
                       ru:'Нужно согласие, чтобы продолжить. Напишите "да", если согласны.' }));
        }

        // dedup BEFORE creating
        var dup = findDuplicateRegistration_(st.payload.team, st.payload.channel_url, st.payload.playlist_url, st.payload.contact);
        if (dup){
          return {
            ok:true, done:true, duplicate:true, id:dup.id, verify_token:dup.token,
            msg: L({
              en: 'You are already registered (by '+dup.by+'). Your token: '+dup.token+'. Paste it into your playlist description.',
              ru: 'Вы уже зарегистрированы (по '+dup.by+'). Ваш токен: '+dup.token+'. Вставьте его в описание плейлиста.'
            }),
            state: st
          };
        }

        // 1) row in Registrations
        var sh = ensureRegSheet_();
        var id = Utilities.getUuid();
        var token = makeToken_();
        sh.appendRow([
          new Date(), id, st.payload.team, st.payload.channel_url, st.payload.playlist_url,
          st.payload.contact, st.payload.country, (st.payload.city||''), token, 'new', ''
        ]);
        // 2) save rules
        var shR = ensureRulesSheet_();
        shR.appendRow([
          new Date(), id, st.payload.team, st.payload.country, (st.payload.city||''),
          st.payload.channel_url, st.payload.playlist_url, st.payload.rules_text.length, st.payload.rules_text
        ]);

        // notify (best-effort)
        try{
          notifyOnRegistration_({
            id:id, team:st.payload.team, channel_url:st.payload.channel_url, playlist_url:st.payload.playlist_url,
            country:st.payload.country, city:(st.payload.city||''), verify_token:token, contact:st.payload.contact, status:'new'
          });
        }catch(_){}

        st.step = 10;
        return {
          ok: true,
          done: true,
          id: id,
          verify_token: token,
          msg: L({
            en: 'Application saved. Your token: '+token+'. Paste it into your playlist description.',
            ru: 'Заявка сохранена. Ваш токен: '+token+'. Вставьте его в описание плейлиста.'
          }),
          state: st
        };
      }
      default:
        st = { step:0, payload:{}, lang:'' };
        return A('Choose language: English or Russian?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** Legacy single-phase entry kept for compatibility (web form should use register_init) */
function handleRegistration_(data){ return registerInit_(data); }
