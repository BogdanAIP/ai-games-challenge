/** =========================== notify.js ===========================
 * Отправка приветствий: email (если есть адрес) + пост в Telegram-канал.
 * Требуются Script Properties:
 *   TELEGRAM_BOT_TOKEN = xxx:yyyy
 *   TELEGRAM_CHANNEL   = @your_channel (или -1001234567890)
 *   EMAIL_FROM         = noreply@example.com (опц., если хотите задать from)
 * ================================================================== */

function _prop_(k, def){ 
  try{ return (PropertiesService.getScriptProperties().getProperty(k) || '').trim() || def || ''; }catch(_){ return def||''; } 
}

function _isEmail_(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim()); }
function _maybeEmail_(contact){
  const s = String(contact||'').trim();
  if (_isEmail_(s)) return s;
  // вытащим email если он в строке
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : '';
}
function _maybeTelegramHandle_(contact){
  const s = String(contact||'').trim();
  // поддержим @username или t.me/username
  const m = s.match(/(?:^|\/)@?([A-Za-z0-9_]{5,})$/);
  return m ? '@' + m[1] : '';
}

function sendEmailGreeting_(to, subject, html){
  if (!to) return {ok:false, error:'no_email'};
  try{
    const from = _prop_('EMAIL_FROM','');
    if (from){
      MailApp.sendEmail({ to, subject, htmlBody: html, name: 'AI Games Challenge', noReply: true, replyTo: from });
    }else{
      MailApp.sendEmail({ to, subject, htmlBody: html, name: 'AI Games Challenge' });
    }
    return {ok:true};
  }catch(err){
    try{ logErr_('sendEmailGreeting_', err, {to}); }catch(_){}
    return {ok:false, error:String(err&&err.message||err)};
  }
}

function telegramPost_(text){
  const token = _prop_('TELEGRAM_BOT_TOKEN','');
  const chat  = _prop_('TELEGRAM_CHANNEL','');
  if (!token || !chat) return { ok:false, error:'telegram_not_configured' };
  try{
    const url = 'https://api.telegram.org/bot'+token+'/sendMessage';
    const payload = { chat_id: chat, text: text, disable_web_page_preview: true };
    const res = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json', payload: JSON.stringify(payload), muteHttpExceptions:true });
    const code = res.getResponseCode();
    return { ok: code>=200 && code<300, code, body: res.getContentText() };
  }catch(err){
    try{ logErr_('telegramPost_', err, {}); }catch(_){}
    return { ok:false, error:String(err&&err.message||err) };
  }
}

/** Публичный хук: вызывать после финальной регистрации (после rules_commit_) */
function notifyOnRegistration_(reg){
  // reg: { team, channel_url, playlist_url, country, city, contact, verify_token }
  try{
    const email = _maybeEmail_(reg.contact||'');
    const tg    = _maybeTelegramHandle_(reg.contact||'');
    const title = 'AI Games Challenge — registration confirmed';
    const lines = [
      'Welcome to AI Games Challenge!',
      'Team: ' + (reg.team||''),
      'Country/City: ' + [reg.country||'', reg.city||''].filter(Boolean).join(', '),
      'Channel: ' + (reg.channel_url||''),
      'Playlist: ' + (reg.playlist_url||''),
      'Verification token: ' + (reg.verify_token||''),
      '',
      'Paste the token into your playlist description. We will verify it soon.',
      '',
      'Good luck!'
    ];
    const text = lines.join('\n');
    const html = '<p>Welcome to <b>AI Games Challenge</b>!</p>'
               + '<p><b>Team:</b> '+(reg.team||'')+'<br>'
               + '<b>Country/City:</b> '+([reg.country||'', reg.city||''].filter(Boolean).join(', '))+'<br>'
               + '<b>Channel:</b> '+(reg.channel_url||'')+'<br>'
               + '<b>Playlist:</b> '+(reg.playlist_url||'')+'<br>'
               + '<b>Verification token:</b> '+(reg.verify_token||'')+'</p>'
               + '<p>Paste the token into your playlist description. We will verify it soon.</p>'
               + '<p>Good luck!</p>';

    if (email) sendEmailGreeting_(email, title, html);
    // В Telegram: публикуем приветствие в официальном канале (в личку боту нельзя писать первым)
    telegramPost_('New team registered: ' + (reg.team||'') + '\n'
      + 'Channel: ' + (reg.channel_url||'') + '\n'
      + 'Playlist: ' + (reg.playlist_url||'') + '\n'
      + 'Token: ' + (reg.verify_token||''));

    return { ok:true, email: !!email };
  }catch(err){
    try{ logErr_('notifyOnRegistration_', err, { reg }); }catch(_){}
    return { ok:false, error:String(err&&err.message||err) };
  }
}
