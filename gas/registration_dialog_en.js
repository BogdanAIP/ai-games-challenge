/** EN-only dialog with early duplicate checks on team/channel/playlist/contact. */

function _regVals_(){ var ss=SS_(); var sh=ss.getSheetByName('Registrations'); return sh?sh.getDataRange().getValues():null; }
function _dupTeam_(name){ name=String(name||'').trim().toLowerCase(); if(!name) return false; var v=_regVals_(); if(!v||v.length<=1) return false; for(var r=1;r<v.length;r++){ if(String(v[r][2]||'').trim().toLowerCase()===name) return true; } return false; }
function _dupChannel_(url){ var n=normalizeChannelUrl_(url); if(!n) return false; var v=_regVals_(); if(!v||v.length<=1) return false; for(var r=1;r<v.length;r++){ if(String(v[r][3]||'').trim()===n) return true; } return false; }
function _dupPlaylist_(pl){ pl=String(pl||'').trim(); if(!pl) return false; var v=_regVals_(); if(!v||v.length<=1) return false; for(var r=1;r<v.length;r++){ if(String(v[r][4]||'').trim()===pl) return true; } return false; }
function _dupContact_(c){ c=String(c||'').trim().toLowerCase(); if(!c) return false; var v=_regVals_(); if(!v||v.length<=1) return false; for(var r=1;r<v.length;r++){ if(String(v[r][5]||'').trim().toLowerCase()===c) return true; } return false; }

function handleRegistrationDialogEN_(data){
  try{
    data = data || {};
    var state = data.state || { step:0, payload:{} };
    var reply = (data.reply || data.text || '').toString().trim();
    function ask(a){ return { ok:true, ask:a, state: state }; }

    switch (state.step|0){
      case 0: state={step:1,payload:{}}; return ask('What is your team name?');
      case 1:
        if(!reply) return ask('Please enter your team name.');
        if(_dupTeam_(reply)) return ask('This team name is already taken. Please enter a different team name.');
        state.payload.team=reply; state.step=2;
        return ask('Link to your YouTube channel (https://youtube.com/@handle or https://youtube.com/channel/ID):');
      case 2: {
        var ch = normalizeChannelUrl_(reply);
        if(!isValidChannelUrl_(ch)) return ask('That does not look like a channel URL. Please send https://youtube.com/@handle or https://youtube.com/channel/ID');
        if(_dupChannel_(ch)) return ask('This YouTube channel is already registered. Please provide another channel.');
        state.payload.channel_url=ch; state.step=3;
        return ask('Send your SEASON playlist URL (must be https://youtube.com/playlist?list=...):');
      }
      case 3:
        if(!isValidPlaylistUrl_(reply)) return ask('Please send a valid playlist URL: https://youtube.com/playlist?list=...');
        if(_dupPlaylist_(reply)) return ask('This playlist is already registered. Please provide a different playlist.');
        state.payload.playlist_url=reply; state.step=4;
        return ask('Country/region (e.g., RU, UA, KZ):');
      case 4:
        if(!reply) return ask('Please provide your country/region (2 letters, e.g., RU).');
        state.payload.country=reply; state.step=5;
        return ask('City (optional — send "-" to skip):');
      case 5:
        if(reply && reply!=='-') state.payload.city=reply;
        state.step=6; return ask('Contact (email or @username):');
      case 6:
        if(!reply) return ask('Please provide a contact (email or @username).');
        if(_dupContact_(reply)) return ask('This contact is already registered. Please provide a different contact.');
        state.payload.contact=reply; state.step=7;
        return ask('Confirm you agree to the Rules and the Privacy Policy (yes/no).');
      case 7: {
        var yes = reply.toLowerCase();
        if(!(yes==='yes'||yes==='y'||yes==='да')) return ask('You need to agree to the Rules and the Privacy Policy to proceed. Type "yes" if you agree.');
        state.step=8; return ask('Paste the RULES text (500–3000 characters) in one message:');
      }
      default:
        state={step:0,payload:{}}; return ask('What is your team name?');
    }
  }catch(err){
    try{ logErr_('handleRegistrationDialogEN_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
