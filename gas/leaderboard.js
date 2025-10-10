/** leaderboard.js — зеркалим команды в Leaderboard (нулевые метрики) **/
function ensureLbSheet_(){
  var ss = SS_(); var sh = ss.getSheetByName('Leaderboard');
  if (!sh){ sh = ss.insertSheet('Leaderboard'); }
  sh.getRange(1,1,1,4).setValues([['team','views','likes','er']]);
  try{ sh.getRange(2,2,Math.max(1,sh.getMaxRows()-1),3).setNumberFormat('0'); }catch(_){}
  return sh;
}
function readRegistrationsTeams_(){
  var ss = SS_(); var sh = ss.getSheetByName('Registrations'); if (!sh) return [];
  var v = sh.getDataRange().getValues(); if (!v || v.length<=1) return [];
  var out=[]; for (var r=1;r<v.length;r++){ var t=String((v[r][2]||'')).trim(); if (t) out.push(t); } // team = col index 2
  var seen={}; return out.filter(function(t){ var k=t.toLowerCase(); if (seen[k]) return false; seen[k]=1; return true; });
}
function mirrorTeamsToLeaderboard_(teams){
  var sh = ensureLbSheet_(); var last = sh.getLastRow(); if (last>1) sh.getRange(2,1,last-1,4).clearContent();
  if (!teams.length) return 0;
  var rows = teams.map(function(t){ return [t,0,0,0]; });
  sh.getRange(2,1,rows.length,4).setValues(rows);
  return rows.length;
}
function handleLeaderboardRefresh_(){
  try{
    var n = mirrorTeamsToLeaderboard_(readRegistrationsTeams_());
    return { ok:true, updated:n, refreshed_at:new Date().toISOString() };
  }catch(err){ return { ok:false, error:String(err && err.message || err) }; }
}
