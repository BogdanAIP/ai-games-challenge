/** =========================== registration.js ===========================
 * Регистрация: ручная форма (register_form) и диалог (handleRegistrationDialog_).
 * Гибкая валидация YouTube-канала: /channel/<ID>, /@handle, full URLs.
 * Пишем в лист "Registrations". Добавлен verify_token (11-я колонка).
 * После успешной регистрации вызываем handleLeaderboardRefresh_() (если есть).
 * ======================================================================= */

function normalizeChannelUrl_(s){
  s = String(s||'').trim();
  if (!s) return '';
  if (/^@[\w\.\-]+$/i.test(s)) return 'https://www.youtube.com/' + s.replace(/^@/,'@');
  s = s.replace(/^https?:\/\/youtu\.be\//i, 'https://www.youtube.com/');
  var m = s.match(/^https?:\/\/(www\.)?youtube\.com\/([^?#]+)(?:[?#].*)?$/i);
  if (m){
    var path = m[2];
    if (/^channel\/[A-Za-z0-9_\-]+$/i.test(path)) return 'https://www.youtube.com/' + path;
    if (/^@[\w\.\-]+$/i.test(path)) return 'https://www.youtube.com/' + path;
  }
  return s;
}

function isValidChannelUrl_(u){
  u = String(u||'').trim();
  if (!u) return false;
  if (/^@[\w\.\-]+$/i.test(u)) return true;
  if (/^https?:\/\/(www\.)?youtube\.com\/channel\/[A-Za-z0-9_\-]+$/i.test(u)) return true;
  if (/^https?:\/\/(www\.)?youtube\.com\/@[\w\.\-]+$/i.test(u)) return true;
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

function assert_(cond, msg, extra){
  if (!cond){
    var e = new Error(msg||'Validation error');
    if (extra) e.extra = extra;
    throw e;
  }
}

function ensureRegSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  // Шапка из 11 колонок: добавили verify_token
  var header = ['ts','id','team','channel_url','playlist_url','contact','country','city','status','notes','verify_token'];
  if (!sh){
    sh = ss.insertSheet('Registrations');
    sh.getRange(1,1,1,header.length).setValues([header]);
  }else if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
  }else{
    // Если лист уже был, проверим ширину и, при необходимости, расширим до 11 колонок
    if (sh.getLastColumn() < header.length) {
      sh.insertColumnsAfter(sh.getLastColumn(), header.length - sh.getLastColumn());
    }
    // Пере-пишем первый ряд шапкой, чтобы гарантировать наличие verify_token
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}

function genVerifyToken_(){
  // короткий, удобный для вставки токен; достаточно уникален для нашей цели
  return Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
}

/** Основной ручной сабмит из формы (или JSONP) */
function handleRegistration_(data){
  try{
    data = data || {};
    var team   = String(data.team||'').trim();
    var chUrl  = normalizeChannelUrl_(data.channel_url);
    var plUrl  = String(data.playlist_url || data.youtube || '').trim();
    var contact= String(data.contact||'').trim();
    var country= String(data.country||'').trim();
    var city   = String(data.city||'').trim();

    assert_(team, 'Missing field: team');
    assert_(chUrl, 'Missing field: channel_url');
    assert_(isValidChannelUrl_(chUrl), 'Invalid channel_url', { got:String(data.channel_url||''), normalized:chUrl });
    assert_(plUrl, 'Missing field: playlist_url');
    assert_(isValidPlaylistUrl_(plUrl), 'Invalid playlist_url', { got:plUrl });
    assert_(contact, 'Missing field: contact');
    assert_(country, 'Missing field: country');

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var verify_token = genVerifyToken_();

    var row = [
      new Date(), id, team, chUrl, plUrl, contact, country, city || '', 'new', '', verify_token
    ];
    sh.appendRow(row);

    // Лёгкий авто-рефреш лидерборда (если функция определена)
    try{
      if (typeof handleLeaderboardRefresh_ === 'function'){
        handleLeaderboardRefresh_();
      }
    }catch(_){}

    return {
      ok:true,
      id:id,
      team:team,
      channel_url:chUrl,
      playlist_url:plUrl,
      country:country,
      city:city || '',
      verify_token: verify_token
    };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** Диалоговый бот регистрации (поддержка существующего фронта) */
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
        state.payload.team = reply;
        state.step = 2;
        return ask('Ссылка на YouTube-канал (например, https://www.youtube.com/@yourhandle или https://www.youtube.com/channel/ID)?');

      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask('Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID');
        state.payload.channel_url = ch;
        state.step = 3;
        return ask('Ссылка на плейлист сезона (или видео):');
      }

      case 3: {
        if (!isValidPlaylistUrl_(reply)) return ask('Пришлите корректный плейлист (https://youtube.com/playlist?list=...) или видео (https://youtu.be/ID)');
        state.payload.playlist_url = reply;
        state.step = 4;
        return ask('Страна (например, RU, UA, KZ)?');
      }

      case 4:
        if (!reply) return ask('Укажите страну (две буквы, например RU)');
        state.payload.country = reply;
        state.step = 5;
        return ask('Город (опционально — можете пропустить, отправив "-")');

      case 5:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 6;
        return ask('Контакт (email или @username):');

      case 6:
        if (!reply) return ask('Пожалуйста, укажите контакт для связи');
        state.payload.contact = reply;

        var final = handleRegistration_({
          team: state.payload.team,
          channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url,
          country: state.payload.country,
          city: state.payload.city || '',
          contact: state.payload.contact
        });
        if (!final.ok) return { ok:false, error:final.error, details:final.details, state:state };
        state.step = 7;
        return { ok:true, done:true, id:final.id, verify_token: final.verify_token, msg:'Заявка принята! Токен вернулся.', state:state };

      default:
        state = { step:0, payload:{} };
        return ask('Начнём заново. Как называется ваша команда?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
