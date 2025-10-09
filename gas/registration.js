/** =========================== registration.js ===========================
 * Регистрация: ручная форма (register_form) и диалог (handleRegistrationDialog_).
 * Валидация YouTube-канала (channel/@handle), плейлиста.
 * Требуем согласие с правилами/политикой. Всегда возвращаем verify_token.
 * Пишем в лист "Registrations". Короткий текст правил пишем в "GameRules".
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
  return false;
}
function assert_(cond, msg, extra){
  if (!cond){
    var e = new Error(msg||'Validation error');
    if (extra) e.extra = extra;
    throw e;
  }
}

/** Registrations sheet header (with verify_token) */
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
    sh.getRange(1,1,1,header.length).setValues([header]);
  }else{
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}

/** GameRules sheet header */
function ensureRulesSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('GameRules');
  var header = ['ts','reg_id','team','channel_url','playlist_url','verify_token','country','city','contact','rules_text','rules_len'];
  if (!sh){
    sh = ss.insertSheet('GameRules');
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
    return sh;
  }
  return sh;
}

/** 8-char HEX token */
function makeToken_(){
  var s = Utilities.getUuid().replace(/-/g,'').toUpperCase();
  return s.slice(-8);
}

/** Manual/JSONP submission */
function handleRegistration_(data){
  try{
    data = data || {};
    var team    = String(data.team||'').trim();
    var chUrl   = normalizeChannelUrl_(data.channel_url);
    var plUrl   = String(data.playlist_url || '').trim();
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
    assert_(acceptRules,  'Missing consent: accept_rules');
    assert_(acceptPolicy, 'Missing consent: accept_policy');

    var sh = ensureRegSheet_();
    var id = Utilities.getUuid();
    var token = makeToken_();

    var row = [new Date(), id, team, chUrl, plUrl, contact, country, city, token, 'new', ''];
    sh.appendRow(row);

    // Save rules text (optional) in separate sheet
    if (rules){
      rules = rules.slice(0, 3000);
      var sr = ensureRulesSheet_();
      sr.appendRow([new Date(), id, team, chUrl, plUrl, token, country, city, contact, rules, rules.length]);
    }

    return { ok:true, id:id, team:team, channel_url:chUrl, playlist_url:plUrl,
             country:country, city:city, verify_token:token };
  }catch(err){
    try{ logErr_('handleRegistration_', err, { data:data }); }catch(_){}
    var out = { ok:false, error:String(err && err.message || err) };
    if (err && err.extra) out.details = err.extra;
    return out;
  }
}

/** Dialog bot */
function handleRegistrationDialog_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{} };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }

    switch (state.step|0){
      case 0:
        state = { step:1, payload:{} };
        return ask('Choose language: English or Russian?');
      case 1:
        // language is handled on frontend; proceed
        state.step = 2;
        return ask('What is your team name?');
      case 2:
        if (!reply) return ask('What is your team name?');
        state.payload.team = reply; state.step = 3;
        return ask('Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      case 3: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask('Please send channel URL like https://youtube.com/@handle or https://youtube.com/channel/ID');
        state.payload.channel_url = ch; state.step = 4;
        return ask('Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }
      case 4:
        if (!isValidPlaylistUrl_(reply)) return ask('Please send correct playlist URL: https://youtube.com/playlist?list=...');
        state.payload.playlist_url = reply; state.step = 5;
        return ask('Country/region (e.g., RU, UA, KZ):');
      case 5:
        if (!reply) return ask('Please provide country/region (two letters).');
        state.payload.country = reply; state.step = 6;
        return ask('City (optional — send "-" to skip):');
      case 6:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 7;
        return ask('Contact (email or @username):');
      case 7:
        if (!reply) return ask('Please provide a contact.');
        state.payload.contact = reply;
        state.step = 7.5;
        return ask('Optional: paste short rules text (<= 3000 chars), or "-" to skip.');
      case 7.5:
        if (reply && reply !== '-') state.payload.rules_text = String(reply).slice(0,3000);
        state.step = 8;
        return ask('Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      case 8: {
        var yes = reply.toLowerCase();
        if (!(yes === 'da' || yes === 'да' || yes === 'yes' || yes === 'y')) {
          return ask('You must agree to proceed. Type "yes" if you agree.');
        }
        var final = handleRegistration_({
          team: state.payload.team,
          channel_url: state.payload.channel_url,
          playlist_url: state.payload.playlist_url,
          country: state.payload.country,
          city: state.payload.city || '',
          contact: state.payload.contact,
          rules_text: state.payload.rules_text || '',
          accept_rules: true,
          accept_policy: true
        });
        if (!final.ok) return { ok:false, error:final.error, details:final.details, state:state };
        state.step = 9;
        return { ok:true, done:true, id:final.id, verify_token:final.verify_token,
                 msg:'Registration saved. Your token: '+final.verify_token+'. Paste it into your playlist description.',
                 state:state };
      }
      default:
        state = { step:0, payload:{} };
        return ask('Choose language: English or Russian?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialog_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
