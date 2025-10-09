/** =========================== registration.js ===========================
 * Регистрация: ручная форма (register_form) и диалог (handleRegistrationDialog_).
 * Валидация YouTube-канала (channel/@handle), плейлиста/видео.
 * Требуем согласие с правилами/политикой. Всегда возвращаем verify_token.
 * Пишем в лист "Registrations" (создаём, если нет). Шапка расширена токеном и rules_url.
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
  if (/^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[A-Za-z0-9_\-]+/i.test(u)) return true;
  if (/^https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_\-]+/i.test(u)) return true;
  if (/^https?:\/\/youtu\.be\/[A-Za-z0-9_\-]+/i.test(u)) return true;
  return false;
}
function isValidHttpUrl_(u){
  u = String(u||'').trim();
  if (!u) return true; // optional
  return /^https?:\/\/.+/i.test(u);
}
function assert_(cond, msg, extra){
  if (!cond){
    var e = new Error(msg||'Validation error');
    if (extra) e.extra = extra;
    throw e;
  }
}

/** гарантируем наличие шапки (включая verify_token и rules_url) */
function ensureRegSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  var header = ['ts','id','team','channel_url','playlist_url','contact','country','city','verify_token','rules_url','status','notes'];
  if (!sh){
    sh = ss.insertSheet('Registrations');
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  var first = sh.getRange(1,1,1,Math.max(header.length,sh.getLastColumn())).getValues()[0];
  var cols = first.map(function(v){return String(v||'').toLowerCase().trim();});
  // добавить недостающие колонки
  if (cols.indexOf('verify_token') === -1) sh.insertColumnAfter(8);
  if (cols.indexOf('rules_url') === -1) sh.insertColumnAfter(9);
  // переписать шапку по порядку
  sh.getRange(1,1,1,header.length).setValues([header]);
  return sh;
}

/** выдаём/создаём verify_token (8-симв верхний HEX) */
function makeToken_(){
  var s = Utilities.getUuid().replace(/-/g,'').toUpperCase();
  return s.slice(-8);
}

/** Основной ручной сабмит из формы (или JSONP) */
function handleRegistration_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || data.youtube || '').trim();
    var rulesUrl= String(data.rules_url||'').trim(); // optional
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
    assert_(isValidHttpUrl_(rulesUrl), 'Invalid rules_url', { got:rulesUrl });

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();

    var row = [new Date(), id, team, chUrl, plUrl, contact, country, city, token, rulesUrl, 'new', ''];
    sh.appendRow(row);

    // поддерживаем видимость на лидерборде
    try{ if (typeof handleLeaderboardRefresh_ === 'function') handleLeaderboardRefresh_(); }catch(_){}

    return { ok:true, id:id, team:team, channel_url:chUrl, playlist_url:plUrl,
             country:country, city:city, verify_token:token, rules_url:rulesUrl };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** Диалоговый бот регистрации */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{} };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }

    switch (state.step|0){
      case 0:
        state = { step:1, payload:{} };
        return ask('Как называется ваша команда?');
      case 1:
        if (!reply) return ask('Пожалуйста, укажите название команды');
        state.payload.team = reply; state.step = 2;
        return ask('Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID)?');
      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask('Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID');
        state.payload.channel_url = ch; state.step = 3;
        return ask('Ссылка на плейлист сезона (или видео):');
      }
      case 3:
        if (!isValidPlaylistUrl_(reply)) return ask('Пришлите корректный плейлист (https://youtube.com/playlist?list=...) или видео (https://youtu.be/ID)');
        state.payload.playlist_url = reply; state.step = 4;
        return ask('Страна (например, RU, UA, KZ)?');
      case 4:
        if (!reply) return ask('Укажите страну (две буквы, например RU)');
        state.payload.country = reply; state.step = 5;
        return ask('Город (опционально — можно пропустить, отправив "-")');
      case 5:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 6;
        return ask('Контакт (email или @username):');
      case 6:
        if (!reply) return ask('Пожалуйста, укажите контакт для связи');
        state.payload.contact = reply; state.step = 7;
        return ask('Дайте ссылку на Rules (Google Doc/Drive, GitHub) или "-" чтобы пропустить:');
      case 7:
        if (reply && reply !== '-') state.payload.rules_url = reply;
        state.step = 8;
        return ask('Подтвердите согласие с Правилами и Политикой (да/нет)');
      case 8: {
        var yes = reply.toLowerCase();
        if (!(yes === 'да' || yes === 'yes' || yes === 'y')) {
          return ask('Нужно согласие с правилами и политикой, чтобы продолжить. Напишите "да" если согласны.');
        }
        var final = handleRegistration_({
          team: state.payload.team,
          channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url,
          country: state.payload.country,
          city: state.payload.city || '',
          contact: state.payload.contact,
          rules_url: state.payload.rules_url || '',
          accept_rules: true,
          accept_policy: true
        });
        if (!final.ok) return { ok:false, error:final.error, details:final.details, state:state };
        state.step = 9;
        return { ok:true, done:true, id:final.id, verify_token:final.verify_token,
                 msg:'Заявка принята! Токен: '+final.verify_token+'. Добавьте его в описание плейлиста и ответьте здесь "готово".',
                 state:state };
      }
      default:
        state = { step:0, payload:{} };
        return ask('Начнём заново. Как называется ваша команда?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
