/** =========================== registration.js ===========================
 * Регистрация: ручная форма (register_form) и диалог (handleRegistrationDialog_).
 * Обязательные поля: team, channel_url, playlist_url, contact, country, accept_rules, accept_policy, rules_text (500–3000).
 * Валидация YouTube-канала (/channel/ID или @handle), плейлиста (только playlist).
 * Всегда возвращаем verify_token; пишем заявки в "Registrations", правила — в "Rules".
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

/** гарантируем лист Registrations (с verify_token в шапке) */
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
    sh.insertColumnAfter(8);
  }
  sh.getRange(1,1,1,header.length).setValues([header]);
  return sh;
}

/** гарантируем лист Rules (хранение текстовых правил) */
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
function saveRules_(reg){
  // reg: {id, team, country, city, channel_url, playlist_url, rules_text}
  var sh = ensureRulesSheet_();
  var text = String(reg.rules_text||'');
  sh.appendRow([
    new Date(),
    reg.id || '',
    reg.team || '',
    reg.country || '',
    reg.city || '',
    reg.channel_url || '',
    reg.playlist_url || '',
    text.length,
    text
  ]);
}

/** токен верификации (8-символьный HEX) */
function makeToken_(){
  var s = Utilities.getUuid().replace(/-/g,'').toUpperCase();
  return s.slice(-8);
}

/** Ручная регистрация (форма/JSONP/POST) */
function handleRegistration_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || '').trim(); // только playlist
    var contact = String(data.contact||'').trim();
    var country = String(data.country||'').trim();
    var city    = String(data.city||'').trim();
    var rules   = String(data.rules_text||'').trim();
    var acceptRules  = !!data.accept_rules;
    var acceptPolicy = !!data.accept_policy;

    assert_(team, 'Missing field: team');
    assert_(chUrl, 'Missing field: channel_url');
    assert_(isValidChannelUrl_(chUrl), 'Invalid channel_url', { got:String(data.channel_url||''), normalized:chUrl });
    assert_(plUrl, 'Missing field: playlist_url');
    assert_(isValidPlaylistUrl_(plUrl), 'Invalid playlist_url', { got:plUrl });
    assert_(contact, 'Missing field: contact');
    assert_(country, 'Missing field: country');
    // правила теперь обязательны
    assert_(rules && rules.length>=500 && rules.length<=3000, 'Missing or invalid rules_text (500–3000 chars)');
    assert_(acceptRules,  'Missing consent: accept_rules');
    assert_(acceptPolicy, 'Missing consent: accept_policy');

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();

    sh.appendRow([ new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'new', '' ]);
    // сохраняем правила в отдельный лист
    saveRules_({ id:id, team:team, country:country, city:city, channel_url:chUrl, playlist_url:plUrl, rules_text:rules });

    return { ok:true, id:id, team:team, channel_url:chUrl, playlist_url:plUrl,
             country:country, city:city, verify_token:token };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** Диалоговый бот регистрации (двуязычный, с обязательными правилами) */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{}, lang:'' };
    var reply = (data.reply || data.text || '').toString().trim();

    function T(en,ru){ return (state.lang==='ru') ? ru : en; }
    function ask(a){ return { ok:true, ask:a, state: state }; }

    switch (state.step|0){
      case 0: {
        // выбор языка
        var lower = reply.toLowerCase();
        if (!state.lang){
          // если уже прислали ответ
          if (lower.indexOf('rus')===0 || lower==='ru' || lower==='русский') state.lang='ru';
          else if (lower.indexOf('eng')===0 || lower==='en' || lower==='english') state.lang='en';
          if (!state.lang){
            return ask("Choose language: English or Russian?");
          }
        }
        state.step = 1;
        return ask(T(
          "What is your team name?",
          "Как называется ваша команда?"
        ));
      }

      case 1:
        if (!reply) return ask(T("Please enter your team name","Пожалуйста, укажите название команды"));
        state.payload.team = reply; state.step = 2;
        return ask(T(
          "Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):",
          "Ссылка на YouTube-канал (https://youtube.com/@handle или https://youtube.com/channel/ID):"
        ));

      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask(T(
          "Doesn’t look like a channel link. Please send https://youtube.com/@handle or https://youtube.com/channel/ID",
          "Не похоже на ссылку канала. Пришлите https://youtube.com/@handle или https://youtube.com/channel/ID"
        ));
        state.payload.channel_url = ch; state.step = 3;
        return ask(T(
          "Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):",
          "Пришлите ссылку на СЕЗОННЫЙ плейлист (только https://youtube.com/playlist?list=...):"
        ));
      }

      case 3:
        if (!isValidPlaylistUrl_(reply)) return ask(T(
          "Please send a valid playlist link (https://youtube.com/playlist?list=...).",
          "Пришлите корректный плейлист (https://youtube.com/playlist?list=...)."
        ));
        state.payload.playlist_url = reply; state.step = 4;
        return ask(T("Country/region (e.g., RU, UA, KZ):","Страна/регион (например, RU, UA, KZ):"));

      case 4:
        if (!reply) return ask(T("Please enter your country (2 letters)","Укажите страну (две буквы)"));
        state.payload.country = reply; state.step = 5;
        return ask(T("City (optional — send '-' to skip):","Город (опционально — можно пропустить, отправив '-')"));

      case 5:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 6;
        return ask(T("Contact (email or @username):","Контактное лицо (электронная почта или @имя пользователя):"));

      case 6:
        if (!reply) return ask(T("Please provide a contact","Пожалуйста, укажите контакт для связи"));
        state.payload.contact = reply; state.step = 7;
        return ask(T(
          "Paste short RULES text here (500–3000 characters). This is required to prevent duplicates and enable AI checks.",
          "Вставьте краткий текст ПРАВИЛ (500–3000 символов). Это обязательно для проверки уникальности."
        ));

      case 7: {
        var rules = String(reply||'').trim();
        if (!(rules.length>=500 && rules.length<=3000)) {
          return ask(T(
            "Rules text must be 500–3000 characters. Please paste again.",
            "Текст правил должен быть 500–3000 символов. Пожалуйста, пришлите ещё раз."
          ));
        }
        state.payload.rules_text = rules;
        state.step = 8;
        return ask(T(
          "Confirm you agree to the Rules and the Privacy Policy (yes/no).",
          "Подтвердите согласие с Правилами и Политикой конфиденциальности (да/нет)."
        ));
      }

      case 8: {
        var yes = reply.toLowerCase();
        var agreed = (yes==='да'||yes==='yes'||yes==='y');
        if (!agreed) {
          return ask(T(
            "We need your consent to proceed. Type 'yes' if you agree.",
            "Чтобы продолжить, нужно согласие. Напишите «да», если согласны."
          ));
        }
        // финальный сабмит
        var final = handleRegistration_({
          team: state.payload.team,
          channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url,
          country: state.payload.country,
          city: state.payload.city || '',
          contact: state.payload.contact,
          rules_text: state.payload.rules_text,
          accept_rules: true,
          accept_policy: true
        });
        if (!final.ok) return { ok:false, error:final.error, details:final.details, state:state };
        state.step = 9;
        return {
          ok:true, done:true, id:final.id, verify_token:final.verify_token,
          msg: T(
            'Application saved. Your token: '+final.verify_token+'. Paste it into your playlist description.',
            'Заявка сохранена. Ваш токен: '+final.verify_token+'. Вставьте его в описание плейлиста.'
          ),
          state:state
        };
      }

      default:
        state = { step:0, payload:{}, lang: state.lang||'' };
        return ask(T("Let’s start over. What is your team name?","Начнём заново. Как называется ваша команда?"));
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
