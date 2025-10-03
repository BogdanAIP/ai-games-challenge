function handleLeaderboardRefresh_(){
  var key = PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
  if (!key) return {ok:false, error:'YOUTUBE_API_KEY missing'};
  var maxPerPl = Math.max(1, Number(cfg_('LB_MAX_VIDEOS_PER_PLAYLIST','50')));

  var ss = SS_();
  var reg = ss.getSheetByName('Registrations'); if (!reg || reg.getLastRow()<2) return {ok:false,error:'No registrations'};
  var rows = reg.getRange(2,1,reg.getLastRow()-1,8).getValues();

  var statsByTeam = []; // {team, views, likes, comments}
  rows.forEach(function(r){
    var team = String(r[1]||''), playlistUrl = String(r[5]||'');
    if (!team || !playlistUrl) return;
    var listId = extractPlaylistId_(playlistUrl); if (!listId) return;

    // 1) playlistItems → videoIds
    var videoIds = [];
    var pageToken = '';
    while(true){
      var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId='
                + encodeURIComponent(listId) + (pageToken?('&pageToken='+pageToken):'') + '&key=' + key;
      var resp = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
      if (resp.getResponseCode()!==200) { logErr_('yt.playlistItems', new Error(resp.getContentText()), {team:team}); break; }
      var j = JSON.parse(resp.getContentText());
      (j.items||[]).forEach(function(it){
        var vid = it?.contentDetails?.videoId; if (vid) videoIds.push(vid);
      });
      pageToken = j.nextPageToken || '';
      if (!pageToken || videoIds.length>=maxPerPl) break;
    }
    videoIds = videoIds.slice(0, maxPerPl);
    if (!videoIds.length) { statsByTeam.push({team:team,views:0,likes:0,comments:0}); return; }

    // 2) videos.list → statistics
    var totals = {views:0,likes:0,comments:0};
    for (var i=0;i<videoIds.length;i+=50){
      var ids = videoIds.slice(i,i+50).join(',');
      var url2 = 'https://www.googleapis.com/youtube/v3/videos?part=statistics&id='+ids+'&key='+key;
      var r2 = UrlFetchApp.fetch(url2, {muteHttpExceptions:true});
      if (r2.getResponseCode()!==200) { logErr_('yt.videos', new Error(r2.getContentText()), {team:team}); continue; }
      var j2 = JSON.parse(r2.getContentText());
      (j2.items||[]).forEach(function(v){
        var s = v.statistics||{};
        totals.views    += Number(s.viewCount||0);
        totals.likes    += Number(s.likeCount||0);
        totals.comments += Number(s.commentCount||0);
      });
    }
    statsByTeam.push({team:team,views:totals.views,likes:totals.likes,comments:totals.comments});
  });

  // 3) score и запись в Leaderboard
  // Пример: 1 балл = 1k просмотров + 5*лайков + 10*комментов (подбери формулу)
  statsByTeam.forEach(function(s){ s.score = Math.round(s.views/1000 + 5*s.likes + 10*s.comments); });
  statsByTeam.sort(function(a,b){ return b.score - a.score; });
  for (var i=0;i<statsByTeam.length;i++) statsByTeam[i].rank = i+1;

  var lb = ss.getSheetByName('Leaderboard') || ss.insertSheet('Leaderboard');
  lb.clearContents(); lb.getRange(1,1,1,7).setValues([['ts','team','score','views','likes','comments','rank']]);
  var now = new Date();
  var vals = statsByTeam.map(function(s){ return [now, s.team, s.score, s.views, s.likes, s.comments, s.rank]; });
  if (vals.length) lb.getRange(2,1,vals.length,7).setValues(vals);

  return {ok:true, updated: vals.length, refreshed_at: now.toISOString()};
}
function extractPlaylistId_(url){
  try{ var u = new URL(url); if (u.pathname.replace(/\/+$/,'')!=='/playlist') return ''; return u.searchParams.get('list')||''; }catch(_){ return ''; }
}
