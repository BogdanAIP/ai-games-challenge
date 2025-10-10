/** =========================== registration.js ===========================
 * Регистрация: форма + диалог.
 * Добавлено:
 *  - Антидубликаты по team/channel_url/playlist_url/contact (CI сравнение)
 *  - Двухфазный поток для длинных правил (register_init → rules_put → rules_commit)
 *  - Уведомления: email (если похож на e-mail) и Telegram-канал (если настроен)
 *  - Бот: двуязычная подача, без дубликатов промптов, онлайновые проверки
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

/** Листы */
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
  sh.getRange(1,1,1,header.length).setValues([header]);
  return sh;
}
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

/** Антидубликаты */
function _ci(s){return String(s||'').trim().toLowerCase();}
function checkDuplicates_({team,chUrl,plUrl,contact}){
  var sh = ensureRegSheet_();
  var vals = sh.getDataRange().getValues();
  var dup = { team:false, channel_url:false, playlist_url:false, contact:false };
  if (!vals || vals.length<=1) return dup;
  var iTeam=2,iCh=3,iPl=4,iContact=5,iStatus=9;
  var t=_ci(team), c=_ci(chUrl), p=_ci(plUrl), m=_ci(contact);
  for (var r=1; r<vals.length; r++){
    var row = vals[r]||[];
    var st  = _ci(row[iStatus]||'');
    if (st==='canceled') continue;
    if (t && _ci(row[iTeam])===t) dup.team = true;
    if (c && _ci(row[iCh])===c) dup.channel_url = true;
    if (p && _ci(row[iPl])===p) dup.playlist_url = true;
    if (m && _ci(row[iContact])===m) dup.contact = true;
  }
  return dup;
}

/** Уведомления */
function looksLikeEmail_(s){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s||'').trim()); }
function notifyRegistration_(rec){
  try{
    var subj = 'AI Games Challenge — Registration received: '+(rec.team||'');
    var body = [
      'Team: ' + (rec.team||''),
      'Country/City: ' + (rec.country||'') + (rec.city? (', '+rec.city):''),
      'Channel: ' + (rec.channel_url||''),
      'Playlist: ' + (rec.playlist_url||''),
      'Verify token: ' + (rec.verify_token||''),
      'ID: ' + (rec.id||'')
    ].join('\n');

    // Email участнику, если дал e-mail
    if (looksLikeEmail_(rec.contact)){
      MailApp.sendEmail({
        to: rec.contact,
        subject: subj,
        htmlBody: body.replace(/\n/g,'<br>')
      });
    }

    // Telegram-пост в официальный канал (если настроен)
    try{
      if (typeof tgPost_ === 'function'){
        var msg = '✅ New registration\n' +
                  'Team: ' + (rec.team||'') + '\n' +
                  'Country/City: ' + (rec.country||'') + (rec.city? (', '+rec.city):'') + '\n' +
                  'Playlist: ' + (rec.playlist_url||'') + '\n' +
                  'Token: ' + (rec.verify_token||'');
        tgPost_(msg);
      }
    }catch(_){}
  }catch(_){}
}

/** Временное хранилище чанков правил */
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

/** 1) Инициализация регистрации (без правил) */
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

    var dup = checkDuplicates_({team:team,chUrl:chUrl,plUrl:plUrl,contact:contact});
    if (dup.team || dup.channel_url || dup.playlist_url || dup.contact){
      return { ok:false, error:'duplicate', duplicates:Object.keys(dup).filter(k=>dup[k]) };
    }

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();
    sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'draft', '' ]);

    _clearChunks_(id);
    return { ok:true, id:id, verify_token:token, team:team, channel_url:chUrl, playlist_url:plUrl, contact:contact, country:country, city:city, status:'draft' };
  }catch(err){
    try{ logErr_('registerInit_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** 2) Приём чанков правил */
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

/** 3) Сборка, валидация (500–3000), сохранение правил + уведомления */
function rulesCommit_(data){
  try{
    data = data || {};
    var id = String(data.id||'').trim();
    assert_(id, 'Missing field: id');

    var sh = ensureRegSheet_();
    var vals = sh.getDataRange().getValues();
    if (!vals || vals.length<=1) throw new Error('No registrations');
    var iId=1,iTeam=2,iCh=3,iPl=4,iContact=5,iCountry=6,iCity=7,iToken=8,iStatus=9;
    var rowIndex=-1,row=null;
    for (var r=1;r<vals.length;r++){
      if (String(vals[r][iId])===id){ rowIndex=r; row=vals[r]; break; }
    }
    assert_(rowIndex>=1, 'Registration not found');

    var text = String((_getChunks_(id)||[]).join('')||'').trim();
    assert_(text.length>=500 && text.length<=3000, 'rules_text must be 500–3000 chars');

    var shRules = ensureRulesSheet_();
    shRules.appendRow([ new Date(), id, row[iTeam]||'', row[iCountry]||'', row[iCity]||'', row[iCh]||'', row[iPl]||'', text.length, text ]);

    sh.getRange(rowIndex+1, iStatus+1).setValue('new');
    _clearChunks_(id);

    // уведомления
    notifyRegistration_({
      id:id, team:row[iTeam], country:row[iCountry], city:row[iCity],
      channel_url:row[iCh], playlist_url:row[iPl], contact:row[iContact],
      verify_token:row[iToken]
    });

    return { ok:true, id:id, rules_len:text.length, status:'new', verify_token: row[iToken] };
  }catch(err){
    try{ logErr_('rulesCommit_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** Доп: одношаговая форма (совместимость). Тоже с антидубликатами. */
function handleRegistration_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || data.youtube || '').trim();
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

    var dup = checkDuplicates_({team:team,chUrl:chUrl,plUrl:plUrl,contact:contact});
    if (dup.team || dup.channel_url || dup.playlist_url || dup.contact){
      return { ok:false, error:'duplicate', duplicates:Object.keys(dup).filter(k=>dup[k]) };
    }

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();
    sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'new', '' ]);

    notifyRegistration_({
      id:id, team:team, country:country, city:city,
      channel_url:chUrl, playlist_url:plUrl, contact:contact,
      verify_token:token
    });

    return { ok:true, id:id, team:team, channel_url:chUrl, playlist_url:plUrl, country:country, city:city, verify_token:token };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** Диалоговый бот регистрации: RU/EN, антидубликаты сразу при вводе */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{}, lang:'' };
    var reply = (data.reply || data.text || '').toString().trim();

    function ask(a){ return { ok:true, ask:a, state: state }; }
    var askLang = 'Choose language: English or Russian? / Выберите язык: English или Русский?';

    switch (state.step|0){
      case 0:
        state = { step:1, payload:{}, lang:'' };
        return ask(askLang);

      case 1: { // choose language
        var s = reply.toLowerCase();
        if (!s || !/(en|eng|english|ru|rus|russian|рус)/.test(s)) return ask(askLang);
        state.lang = /(ru|рус|russian)/.test(s) ? 'ru' : 'en';
        state.step = 2;
        return ask(state.lang==='ru' ? 'Как называется ваша команда?' : 'What is your team name?');
      }

      case 2: { // team
        if (!reply) return ask(state.lang==='ru' ? 'Пожалуйста, укажите название команды' : 'Please enter a team name.');
        var team = reply;
        var dup = checkDuplicates_({team:team});
        if (dup.team){
          return ask(state.lang==='ru' ? 'Такая команда уже зарегистрирована. Укажите другое название.' : 'This team name is already registered. Please choose another one.');
        }
        state.payload.team = team; state.step = 3;
        return ask(state.lang==='ru'
          ? 'Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):'
          : 'Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      }

      case 3: { // channel
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)){
          return ask(state.lang==='ru'
            ? 'Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID'
            : 'This does not look like a channel URL. Send https://youtube.com/@handle or https://youtube.com/channel/ID');
        }
        var dup = checkDuplicates_({chUrl:ch});
        if (dup.channel_url){
          return ask(state.lang==='ru' ? 'Этот канал уже зарегистрирован. Укажите другой.' : 'This channel is already registered. Please provide a different one.');
        }
        state.payload.channel_url = ch; state.step = 4;
        return ask(state.lang==='ru'
          ? 'Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):'
          : 'Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }

      case 4: { // playlist
        var pl = String(reply||'').trim();
        if (!isValidPlaylistUrl_(pl)){
          return ask(state.lang==='ru'
            ? 'Нужен плейлист вида https://youtube.com/playlist?list=...'
            : 'Playlist URL must look like https://youtube.com/playlist?list=...');
        }
        var dup = checkDuplicates_({plUrl:pl});
        if (dup.playlist_url){
          return ask(state.lang==='ru' ? 'Этот плейлист уже зарегистрирован.' : 'This playlist is already registered.');
        }
        state.payload.playlist_url = pl; state.step = 5;
        return ask(state.lang==='ru'
          ? 'Страна/регион (например, RU, UA, KZ):'
          : 'Country/region (e.g., RU, UA, KZ):');
      }

      case 5: { // country
        if (!reply) return ask(state.lang==='ru' ? 'Укажите страну/регион (две буквы, например RU).' : 'Please provide the country/region code (e.g., RU).');
        state.payload.country = reply; state.step = 6;
        return ask(state.lang==='ru'
          ? 'Город (опционально — можно пропустить, отправив "-"):'
          : 'City (optional — send "-" to skip):');
      }

      case 6: { // city
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 7;
        return ask(state.lang==='ru'
          ? 'Контактное лицо (email или @username):'
          : 'Contact (email or @username):');
      }

      case 7: { // contact (also dup check)
        if (!reply) return ask(state.lang==='ru' ? 'Укажите контакт для связи' : 'Please provide a contact.');
        var dup = checkDuplicates_({contact:reply});
        if (dup.contact){
          return ask(state.lang==='ru' ? 'Такой контакт уже есть в системе. Укажите другой.' : 'This contact already exists. Please provide a different one.');
        }
        state.payload.contact = reply; state.step = 8;
        return ask(state.lang==='ru'
          ? 'Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).'
          : 'Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      }

      case 8: { // consents
        var yes = reply.toLowerCase();
        if (!(yes==='да'||yes==='yes'||yes==='y')){
          return ask(state.lang==='ru'
            ? 'Нужно согласие с Правилами и Политикой. Напишите "да", если согласны.'
            : 'You must agree to the Rules and the Privacy Policy. Reply "yes" to continue.');
        }
        state.step = 9;
        return ask(state.lang==='ru'
          ? 'Вставьте ТЕКСТ ПРАВИЛ (500–3000 символов) одним сообщением:'
          : 'Paste the RULES text (500–3000 characters) in one message:');
      }

      // шаг 9 перехватывается фронтом (long-text) и идёт через register_init → rules_put → rules_commit
      default:
        state = { step:0, payload:{}, lang:'' };
        return ask(askLang);
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
