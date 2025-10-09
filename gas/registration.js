/** =========================== registration.js ===========================
 * Two-phase registration + dialog bot (EN/RU).
 * Web form:
 *   - register_init -> rules_put (chunks) -> rules_commit
 * Bot:
 *   - handleRegistrationDialog_: collects fields incl. rules_text (500–3000),
 *     then writes to Registrations + Rules directly and returns verify_token.
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

/** Sheets */
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

/** ===== Two-phase API for the web form (kept as before) ===== */
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

/** Chunk buffer for WEB flow (kept) */
function _chunkKey_(id){ return 'rules_chunks:' + id; }
function _getChunks_(id){ var raw = PropertiesService.getScriptProperties().getProperty(_chunkKey_(id)) || '[]'; try { return JSON.parse(raw); } catch(_){ return []; } }
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
    var iId = 1, iTeam=2, iCh=3, iPl=4, iContact=5, iCountry=6, iCity=7, iToken=8, iStatus=9;

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

    return { ok:true, id:id, rules_len:text.length, status:'new', verify_token: row[iToken] };
  }catch(err){
    try{ logErr_('rulesCommit_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** ===== Dialog bot (action: 'register') — EN/RU, mandatory rules_text ===== */
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
      case 1: { // language
        var r = reply.toLowerCase();
        if (/^en|english/i.test(r)) st.lang = 'en';
        else if (/^ru|рус/i.test(r)) st.lang = 'ru';
        else return A('Choose language: English or Russian?');
        st.step = 2;
        return A(L({ en:'What is your team name?', ru:'Как называется ваша команда?' }));
      }
      case 2: { // team
        if (!reply) return A(L({ en:'Please enter a team name', ru:'Пожалуйста, укажите название команды' }));
        st.payload.team = reply; st.step=3;
        return A(L({ en:'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):',
                     ru:'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):' }));
      }
      case 3: { // channel
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return A(L({ en:'That does not look like a channel URL. Please send https://youtube.com/@handle or https://youtube.com/channel/ID',
                                                  ru:'Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID' }));
        st.payload.channel_url = ch; st.step=4;
        return A(L({ en:'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):',
                     ru:'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):' }));
      }
      case 4: { // playlist
        if (!isValidPlaylistUrl_(reply)) return A(L({ en:'Please send a valid playlist URL (https://youtube.com/playlist?list=...)',
                                                      ru:'Пришлите корректный плейлист (https://youtube.com/playlist?list=...)' }));
        st.payload.playlist_url = reply; st.step=5;
        return A(L({ en:'Country/region (e.g., RU, UA, KZ):', ru:'Страна/регион (например, RU, UA, KZ):' }));
      }
      case 5: { // country
        if (!reply) return A(L({ en:'Please provide a 2-letter country code', ru:'Укажите код страны из двух букв' }));
        st.payload.country = reply; st.step=6;
        return A(L({ en:'City (optional — send "-" to skip):', ru:'Город (опционально — можно пропустить, отправив "-"):' }));
      }
      case 6: { // city
        if (reply && reply !== '-') st.payload.city = reply;
        st.step = 7;
        return A(L({ en:'Contact (email or @username):', ru:'Контактное лицо (электронная почта или @имя пользователя):' }));
      }
      case 7: { // contact
        if (!reply) return A(L({ en:'Please send a contact', ru:'Пожалуйста, укажите контакт' }));
        st.payload.contact = reply; st.step = 8;
        return A(L({ en:'Paste a short RULES text (500–3000 chars).',
                     ru:'Вставьте краткий текст ПРАВИЛ (500–3000 символов).' }));
      }
      case 8: { // rules_text mandatory
        var rules = String(reply||'').trim();
        if (!(rules.length>=500 && rules.length<=3000)){
          return A(L({ en:'Rules text must be 500–3000 characters. Please paste again.',
                       ru:'Текст правил должен быть 500–3000 символов. Пожалуйста, пришлите ещё раз.' }));
        }
        st.payload.rules_text = rules; st.step = 9;
        return A(L({ en:'Confirm you agree to the Rules and the Privacy Policy (yes/no).',
                     ru:'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).' }));
      }
      case 9: { // consents
        var yes = reply.toLowerCase();
        if (!(/^(y|yes|да)$/.test(yes))) {
          return A(L({ en:'We need your consent to continue. Type "yes" if you agree.',
                       ru:'Нужно согласие, чтобы продолжить. Напишите "да", если согласны.' }));
        }
        // Create registration + save rules in one go
        try{
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
        }catch(err2){
          try{ logErr_('handleRegistrationDialog_/finalize', err2, { state:st }); }catch(_){}
          return { ok:false, error:String(err2 && err2.message || err2), state:st };
        }
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

/** Compatibility: old single-phase form path just calls init */
function handleRegistration_(data){ return registerInit_(data); }
