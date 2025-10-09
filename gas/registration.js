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
