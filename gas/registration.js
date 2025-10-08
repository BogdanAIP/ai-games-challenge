/** =========================== registration.js ===========================
 * Регистрация: ручная форма (register_form) и диалог (handleRegistrationDialog_).
 * Бот: RU/EN (первый шаг — выбор языка). Больше НЕ спрашиваем "rules URL".
 * Плейлист обязателен и только playlist URL (видео запрещены).
 * Требуем согласие с правилами/политикой. Всегда возвращаем verify_token.
 * Пишем в лист "Registrations" (создаём, если нет). Шапка включает verify_token.
 * ======================================================================= */function normalizeChannelUrl_(s){
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
/** Only playlists are valid now */
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
}/** ensure Registrations header (including verify_token) */
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
  var first = sh.getRange(1,1,1,Math.max(header.length,sh.getLastColumn())).getValues()[0];
  var cols = first.map(function(v){return String(v||'').toLowerCase().trim();});
  if (cols.indexOf('verify_token') === -1){
    sh.insertColumnAfter(8); // after city -> new col 9
    sh.getRange(1,1,1,header.length).setValues([header]);
  }else{
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}/** 8-char uppercase hex token */
function makeToken_(){
  var s = Utilities.getUuid().replace(/-/g,'').toUpperCase();
  return s.slice(-8);
}/** Manual form (or JSONP) */
function handleRegistration_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || '').trim();
    var contact = String(data.contact||'').trim();
    var country = String(data.country||'').trim();
    var city    = String(data.city||'').trim();
    var acceptRules  = !!data.accept_rules;
    var acceptPolicy = !!data.accept_policy;    assert_(team, 'Missing field: team');
    assert_(chUrl, 'Missing field: channel_url');
    assert_(isValidChannelUrl_(chUrl), 'Invalid channel_url', { got:String(data.channel_url||''), normalized:chUrl });
    assert_(plUrl, 'Missing field: playlist_url');
    assert_(isValidPlaylistUrl_(plUrl), 'Invalid playlist_url', { got:plUrl });
    assert_(contact, 'Missing field: contact');
    assert_(country, 'Missing field: country');
    assert_(acceptRules,  'Missing consent: accept_rules');
    assert_(acceptPolicy, 'Missing consent: accept_policy');    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();    var row = [new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'new', ''];
    sh.appendRow(row);    return { ok:true, id:id, team:team, channel_url:chUrl, playlist_url:plUrl,
             country:country, city:city, verify_token:token };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}/** ==== Dialog bot (bilingual RU/EN) ==== */
function _T_(lang, key, a){
  var M = {
    en: {
      choose_lang: "Choose language: English or Russian?",
      ask_team: "What is your team name?",
      ask_channel: "Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):",
      bad_channel: "Doesn't look like a channel link. Please send https://youtube.com/@handle or https://youtube.com/channel/ID",
      ask_playlist: "Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):",
      bad_playlist: "Only playlist links are accepted (https://youtube.com/playlist?list=...).",
      ask_country: "Country/region (e.g., RU, UA, KZ):",
      need_country: "Please provide a 2-letter country code (e.g., RU).",
      ask_city: "City (optional — send '-' to skip):",
      ask_contact: "Contact (email or @username):",
      need_contact: "Please provide a contact.",
      ask_consent: "Confirm you agree to the Rules and the Privacy Policy (yes/no).",
      consent_required: "We need your consent to proceed. Type 'yes' if you agree.",
      done: function(tok){ return "Registration saved. Your verification token: " + tok + ". Paste it into your playlist description, then reply 'done' when ready."; }
    },
    ru: {
      choose_lang: "Выберите язык: Русский или English?",
      ask_team: "Как называется ваша команда?",
      ask_channel: "Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):",
      bad_channel: "Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID",
      ask_playlist: "Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):",
      bad_playlist: "Принимаем только плейлист (https://youtube.com/playlist?list=...).",
      ask_country: "Страна/регион (например, RU, UA, KZ):",
      need_country: "Укажите 2-буквенный код страны (например, RU).",
      ask_city: "Город (опционально — можно пропустить, отправив '-')",
      ask_contact: "Контакт (email или @username):",
      need_contact: "Укажите контакт для связи.",
      ask_consent: "Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет).",
      consent_required: "Нужно согласие, чтобы продолжить. Напишите «да», если согласны.",
      done: function(tok){ return "Заявка сохранена. Ваш токен: " + tok + ". Вставьте его в описание плейлиста и ответьте «готово», когда закончите."; }
    }
  };
  var msg = (M[lang] && M[lang][key]) || (M.en && M.en[key]) || key;
  if (typeof msg === 'function') return msg(a);
  return msg;
}
function _yes_(lang, s){
  s = String(s||'').trim().toLowerCase();
  if (lang === 'ru') return (s === 'да' || s === 'y' || s === 'yes');
  return (s === 'yes' || s === 'y' || s === 'да'); // accept both
}
function _pickLang_(s){
  s = String(s||'').trim().toLowerCase();
  if (!s) return '';
  if (/(^|[^a-z])en(g(lish)?)?($|[^a-z])/i.test(s) || s === 'en') return 'en';
  if (/^ru|рус|russian|русский/.test(s)) return 'ru';
  if (s === 'english') return 'en';
  if (s === 'russian' || s === 'русский') return 'ru';
  return '';
}function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{}, lang:'' };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }    switch (state.step|0){
      case 0: {
        // language selection
        if (!state.lang){
          var guess = _pickLang_(reply);
          if (guess){
            state.lang = guess;
            state.step = 1;
            return ask(_T_(state.lang, 'ask_team'));
          }
          // if reply empty, ask to choose language
          return ask(_T_(state.lang || 'en', 'choose_lang'));
        }
        state.step = 1;
        return ask(_T_(state.lang, 'ask_team'));
      }      case 1:
        if (!reply) return ask(_T_(state.lang, 'ask_team'));
        state.payload.team = reply;
        state.step = 2;
        return ask(_T_(state.lang, 'ask_channel'));      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask(_T_(state.lang, 'bad_channel'));
        state.payload.channel_url = ch;
        state.step = 3;
        return ask(_T_(state.lang, 'ask_playlist'));
      }      case 3:
        if (!isValidPlaylistUrl_(reply)) return ask(_T_(state.lang, 'bad_playlist'));
        state.payload.playlist_url = reply;
        state.step = 4;
        return ask(_T_(state.lang, 'ask_country'));      case 4:
        if (!reply) return ask(_T_(state.lang, 'need_country'));
        state.payload.country = reply;
        state.step = 5;
        return ask(_T_(state.lang, 'ask_city'));      case 5:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 6;
        return ask(_T_(state.lang, 'ask_contact'));      case 6:
        if (!reply) return ask(_T_(state.lang, 'need_contact'));
        state.payload.contact = reply;
        state.step = 7;
        return ask(_T_(state.lang, 'ask_consent'));      case 7: {
        if (!_yes_(state.lang, reply)) return ask(_T_(state.lang, 'consent_required'));
        var final = handleRegistration_({
          team: state.payload.team,
          channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url,
          country: state.payload.country,
          city: state.payload.city || '',
          contact: state.payload.contact,
          accept_rules: true,
          accept_policy: true
        });
        if (!final.ok) return { ok:false, error:final.error, details:final.details, state:state };
        state.step = 8;
        return {
          ok:true,
          done:true,
          id:final.id,
          verify_token:final.verify_token,
          msg:_T_(state.lang, 'done', final.verify_token),
          state:state
        };
      }      default:
        state = { step:0, payload:{}, lang: state.lang || '' };
        return ask(_T_(state.lang || 'en', 'ask_team'));
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}