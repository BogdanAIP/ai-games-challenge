/** registration_dialog_en.js
 * EN-only dialog flow with early duplicate checks for team/channel/contact.
 * Frontend still handles RULES via register_init + rules_put/commit when it sees the RULES prompt.
 */

// helpers already exist in registration.js: normalizeChannelUrl_, isValidChannelUrl_, isValidPlaylistUrl_
function _regSheetValues_() {
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  return sh ? sh.getDataRange().getValues() : null;
}
function _dupTeam_(name){
  name = String(name||'').trim().toLowerCase();
  var vals = _regSheetValues_(); if (!vals || vals.length<=1) return false;
  var iTeam = 2; // [ts,id,team,...]
  for (var r=1;r<vals.length;r++){
    var t = String(vals[r][iTeam]||'').trim().toLowerCase();
    if (t && t === name) return true;
  }
  return false;
}
function _dupChannel_(url){
  var norm = normalizeChannelUrl_(url);
  var vals = _regSheetValues_(); if (!vals || vals.length<=1) return false;
  var iCh = 3; // channel_url
  for (var r=1;r<vals.length;r++){
    var v = String(vals[r][iCh]||'').trim();
    if (v && v === norm) return true;
  }
  return false;
}
function _dupContact_(contact){
  contact = String(contact||'').trim().toLowerCase();
  var vals = _regSheetValues_(); if (!vals || vals.length<=1) return false;
  var iC = 5; // contact
  for (var r=1;r<vals.length;r++){
    var v = String(vals[r][iC]||'').trim().toLowerCase();
    if (v && v === contact) return true;
  }
  return false;
}

/** English-only dialog. No language choice; browser translate can localize UI. */
function handleRegistrationDialogEN_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{} };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }

    switch (state.step|0){
      case 0:
        state = { step:1, payload:{} };
        return ask('What is your team name?');

      case 1: {
        if (!reply) return ask('Please enter your team name.');
        if (_dupTeam_(reply)) return ask('This team name is already taken. Please enter a different team name.');
        state.payload.team = reply;
        state.step = 2;
        return ask('Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      }

      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if (!isValidChannelUrl_(ch)) return ask('That does not look like a channel URL. Please send https://youtube.com/@handle or https://youtube.com/channel/ID');
        if (_dupChannel_(ch)) return ask('This YouTube channel is already registered. Please provide another channel.');
        state.payload.channel_url = ch;
        state.step = 3;
        return ask('Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }

      case 3:
        if (!isValidPlaylistUrl_(reply)) return ask('Please send a valid playlist URL: https://youtube.com/playlist?list=...');
        state.payload.playlist_url = reply;
        state.step = 4;
        return ask('Country/region (e.g., RU, UA, KZ):');

      case 4:
        if (!reply) return ask('Please provide your country/region (2 letters, e.g., RU).');
        state.payload.country = reply;
        state.step = 5;
        return ask('City (optional — send "-" to skip):');

      case 5:
        if (reply && reply !== '-') state.payload.city = reply;
        state.step = 6;
        return ask('Contact (email or @username):');

      case 6: {
        if (!reply) return ask('Please provide a contact (email or @username).');
        if (_dupContact_(reply)) return ask('This contact is already registered. Please provide a different contact.');
        state.payload.contact = reply;
        state.step = 7;
        return ask('Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      }

      case 7: {
        var yes = reply.toLowerCase();
        if (!(yes === 'yes' || yes === 'y' || yes === 'да')) {
          return ask('You need to agree to the Rules and the Privacy Policy to proceed. Type "yes" if you agree.');
        }
        // Frontend will do register_init + rules_put/commit after seeing this RULES prompt:
        state.step = 8;
        return ask('Paste the RULES text (500–3000 characters) in one message:');
      }

      default:
        state = { step:0, payload:{} };
        return ask('What is your team name?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialogEN_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
