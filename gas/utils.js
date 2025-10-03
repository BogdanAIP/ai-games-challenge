/** =============================== utils.gs ===============================
 * Общие хелперы: токены, URL, нормализация YouTube, валидация.
 * Добавлено:
 *  - coerceYoutubeChannelUrl_() — принимает @handle, /channel/..., /user/..., /c/...
 *  - isYoutubeChannelUrlLoose_() — «мягкая» проверка канала
 * ===================================================================== */

function newToken_(){
  var r1 = Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  var r2 = Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  return 'AIGC-' + r1 + '-' + r2;
}

function normalizeUrl_(s){
  var t = String(s||'').trim();
  t = t.replace(/^https?:\/\/m\.youtube\.com/i, 'https://www.youtube.com');
  t = t.replace(/^http:\/\//i, 'https://');
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
  t = t.replace(/\/+(\?|#|$)/, '$1');
  return t;
}

function isUrl_(s){
  try { var u = new URL(String(s)); return ['http:','https:'].indexOf(u.protocol) >= 0; }
  catch(e){ return false; }
}

function isYoutubeHost_(host){
  var h = (host || '').toLowerCase().replace(/^m\./,'');
  return h === 'www.youtube.com' || h === 'youtube.com';
}

/** Плейлист считается валидным, если это /playlist?list=<ID> (+любой хвост query ok) */
function isYoutubePlaylistUrl_(s){
  if (!isUrl_(s)) return false;
  var u = new URL(String(s));
  if (!isYoutubeHost_(u.hostname)) return false;
  if (u.pathname.replace(/\/+$/,'') !== '/playlist') return false;
  var list = u.searchParams.get('list') || '';
  return /^[A-Za-z0-9_-]{12,}$/.test(list);
}

/** Преобразование канал-ссылки в полноценный https://www.youtube.com/... */
function coerceYoutubeChannelUrl_(s){
  var t = String(s||'').trim();

  // @handle → https://www.youtube.com/@handle
  if (/^@[\w.\-]{2,}$/i.test(t)){
    return 'https://www.youtube.com/' + t;
  }

  // youtube.com/... без схемы → добавить https://
  if (/^(?:https?:\/\/)?(?:www\.)?youtube\.com\b/i.test(t)){
    return 'https://' + t.replace(/^https?:\/\//i,'').replace(/^\/+/,'');
  }

  // короткие пути без домена → подставить домен
  if (/^\/(channel|user|c)\//i.test(t) || /^\/@/i.test(t)){
    return 'https://www.youtube.com' + (t.startsWith('/') ? t : '/'+t);
  }

  // иначе — вернуть как есть (вдруг уже полный URL c https://)
  return t;
}

/** Мягкая проверка канала: /channel/ID, /@handle, /user/name, /c/name */
function isYoutubeChannelUrlLoose_(s){
  var u;
  try { u = new URL(String(s)); } catch(e){ return false; }
  var host = (u.hostname||'').toLowerCase().replace(/^m\./,'');
  if (!(host === 'www.youtube.com' || host === 'youtube.com')) return false;

  var parts = u.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
  if (!parts.length) return false;

  if (parts[0] === 'channel' && parts[1]){
    return /^[A-Za-z0-9_-]{10,}$/.test(parts[1]); // обычно UC..., но специально не требуем префикс UC
  }
  if (parts[0].charAt(0) === '@'){
    var handle = parts[0].slice(1);
    return /^[A-Za-z0-9._-]{2,}$/.test(handle);
  }
  if ((parts[0] === 'user' || parts[0] === 'c') && parts[1]){
    return /^[A-Za-z0-9._-]{2,}$/.test(parts[1]);
  }
  return false;
}

function mask_(s){
  return String(s || '').replace(/(.{2}).+(@.*)?$/, '$1***$2');
}
