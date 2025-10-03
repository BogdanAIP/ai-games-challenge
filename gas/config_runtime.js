/** ============== config_runtime.gs ============== */
function SS_(){
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function ensureSheets_(){
  var ss = SS_();
  var defs = [
    ['AppLog',       ['ts','where','error','meta','env']],
    ['Config',       ['key','value']],
    ['Prompts',      ['name','text']],
    ['RagSources',   ['url']],
    ['RagPages',     ['url','title','content','updated_at']],
    ['FaqCache',     ['key','answer','ts']],
    ['Registrations',['ts','team','country','contact','channel_url','playlist_url','issue_url','token']],
    ['Users',        ['ts','contact','team','country','channel_url','playlist_url','token']],
    ['Leaderboard',  ['ts','team','score','views','likes','comments','rank']]
  ];
  defs.forEach(function(d){
    var sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
    if (sh.getLastRow()===0) sh.getRange(1,1,1,d[1].length).setValues([d[1]]);
  });
}

function cfg_(key, fallback){
  var sp = PropertiesService.getScriptProperties().getProperty(key);
  if (sp != null && sp !== '') return sp;
  var ss = SS_(), sh = ss.getSheetByName('Config');
  if (sh){
    var last = sh.getLastRow();
    var vals = sh.getRange(2,1,Math.max(last-1,0),2).getValues();
    for (var i=0;i<vals.length;i++) if (String(vals[i][0]||'')===key) return String(vals[i][1]||'');
  }
  return (fallback!=null)? String(fallback) : '';
}

function prompt_(name, fallback){
  var ss = SS_(), sh = ss.getSheetByName('Prompts');
  if (sh){
    var last = sh.getLastRow();
    var vals = sh.getRange(2,1,Math.max(last-1,0),2).getValues();
    for (var i=0;i<vals.length;i++) if (String(vals[i][0]||'')===name) return String(vals[i][1]||'');
  }
  return fallback || '';
}

function getRagUrls_(){
  var ss = SS_(), sh = ss.getSheetByName('RagSources');
  if (!sh || sh.getLastRow()<2) return [];
  var vals = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  return vals.map(function(r){ return String(r[0]).trim(); })
             .filter(function(u){ return u && /^https?:\/\//.test(u); });
}

function logErr_(where, err, meta){
  try{
    var ss = SS_(), sh = ss.getSheetByName('AppLog') || ss.insertSheet('AppLog');
    if (sh.getLastRow()===0) sh.getRange(1,1,1,5).setValues([['ts','where','error','meta','env']]);
    sh.appendRow([ new Date(), where, String(err && err.message || err), JSON.stringify(meta||{}), cfg_('APP_ENV','') ]);
  }catch(_){}
}

function initProject_(){ ensureSheets_(); }

