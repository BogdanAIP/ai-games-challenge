/** =========================== registration.gs ===========================
 * Регистрация: диалоговый ввод + прямая форма.
 * Обновлено: мягкая нормализация YouTube-канала (@handle, /channel/..., /user/..., /c/...)
 * и фиксация текста вопроса (одно @).
 * ===================================================================== */

/** Диалог регистрации (бот на странице Join) */
function handleRegistrationDialog_(data){
  var st = (data && data.state) || { step:0, payload:{} };
  var r  = String((data && data.reply) || '').trim();

  switch (st.step){
    case 0:
      st.step = 1;
      return { ok:true, ask: 'Как называется ваша команда?', state: st };

    case 1:
      st.payload.team = r;
      st.step = 2;
      return { ok:true, ask: 'Страна/регион?', state: st };

    case 2:
      st.payload.country = r;
      st.step = 3;
      return { ok:true, ask: 'Контакт (email/telegram)?', state: st };

    case 3:
      st.payload.contact = r;
      st.step = 4;
      // фиксируем текст: одно @
      return { ok:true, ask: 'Ссылка на YouTube-канал (@handle или /channel/ID)?', state: st };

    case 4:
      st.payload.channel_url = r;
      st.step = 5;
      return { ok:true, ask: 'Ссылка на плейлист сезона (/playlist?list=...)?', state: st };

    case 5:
      st.payload.playlist_url = r;
      st.step = 6;
      return { ok:true, ask: 'Доп. заметки? (можно написать —)', state: st };

    case 6:
      st.payload.notes = (r && r !== '—') ? r : '';
      var res = handleRegistration_(st.payload);
      if (!res.ok){
        // если ошибка — вернём что именно не понравилось (для дебага на фронте)
        return { ok:false, error: res.error, detail: res.detail, got: res.got, normalized: res.normalized };
      }
      return { ok:true, done:true, message:'Готово! Регистрация принята.', token:res.token, issue_url:res.issue_url||'' };

    default:
      return { ok:false, error: 'Bad state' };
  }
}

/** Прямая обработка формы регистрации (и из JSONP, и из POST) */
function handleRegistration_(data){
  var req = ['team','country','contact','channel_url','playlist_url'];
  for (var i=0;i<req.length;i++){
    var k = req[i];
    if (!data[k] || String(data[k]).trim() === ''){
      return { ok:false, error:'Missing field: '+k };
    }
  }

  var chRaw = String(data.channel_url || '');
  var plRaw = String(data.playlist_url || '');

  // «Достроим» канал до полноценного URL + нормализуем http→https и т.п.
  var ch = normalizeUrl_( coerceYoutubeChannelUrl_(chRaw) );
  var pl = normalizeUrl_( plRaw );

  if (!isYoutubeChannelUrlLoose_(ch)){
    return { ok:false, error:'Invalid channel_url', got: chRaw, normalized: ch };
  }
  if (!isYoutubePlaylistUrl_(pl)){
    return { ok:false, error:'Invalid playlist_url', got: plRaw, normalized: pl };
  }

  var token = newToken_();

  // Registrations
  try {
    var ss = SS_();
    var sh = ss.getSheetByName('Registrations') || ss.insertSheet('Registrations');
    if (sh.getLastRow()===0){
      sh.getRange(1,1,1,8).setValues([['ts','team','country','contact','channel_url','playlist_url','issue_url','token']]);
    }
    sh.appendRow([ new Date(), data.team, data.country, data.contact, ch, pl, '', token ]);
  } catch(e){
    logErr_('reg.sheet', e);
  }

  // Users
  try {
    var su = SS_().getSheetByName('Users') || SS_().insertSheet('Users');
    if (su.getLastRow()===0){
      su.getRange(1,1,1,7).setValues([['ts','contact','team','country','channel_url','playlist_url','token']]);
    }
    su.appendRow([ new Date(), data.contact, data.team, data.country, ch, pl, token ]);
  } catch(e){
    logErr_('reg.users', e);
  }

  // (опционально GitHub Issues — если добавишь GH_TOKEN/GH_REPO, можно вернуть сюда)
  return { ok:true, token: token };
}
