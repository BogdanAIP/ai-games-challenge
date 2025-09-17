async function loadBoard(){
  const res = await fetch('public/leaderboard.json', {cache:'no-store'});
  const data = await res.json();
  const rows = data.entries
    .sort((a,b)=>b.score - a.score)
    .map((e,i)=>`<tr>
      <td>${i+1}</td>
      <td>${e.title}</td>
      <td><a href="${e.youtube.playlist}" target="_blank" rel="noopener">Playlist</a></td>
      <td>${e.metrics.views30d}</td>
      <td>${e.metrics.likes30d}</td>
      <td>${e.metrics.er.toFixed(3)}</td>
      <td><strong>${e.score.toFixed(3)}</strong></td>
    </tr>`).join('');
  document.getElementById('board').innerHTML =
    `<table><thead><tr>
      <th>#</th><th>Game</th><th>Playlist</th><th>V30</th><th>L30</th><th>ER</th><th>Score</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}
loadBoard().catch(console.error);

async function loadMiniBoard(){
  try{
    const res = await fetch('public/leaderboard.json', {cache:'no-store'});
    if(!res.ok) throw new Error('no leaderboard.json');
    const data = await res.json();
    const entries = (data.entries||[]).slice().sort((a,b)=>b.score-a.score).slice(0,5);
    if(entries.length===0){ document.getElementById('mini-board').innerHTML = '<p class="muted">No entries yet.</p>'; return; }
    const rows = entries.map((e,i)=>(
      `<tr>
         <td>${i+1}</td>
         <td>${e.title}</td>
         <td><a href="${(e.youtube&&e.youtube.playlist)||'#'}" target="_blank" rel="noopener">Playlist</a></td>
         <td style="text-align:right;"><strong>${(e.score||0).toFixed(3)}</strong></td>
       </tr>`
    )).join('');
    document.getElementById('mini-board').innerHTML =
      `<table><thead><tr><th>#</th><th>Game</th><th>Link</th><th style="text-align:right;">Score</th></tr></thead><tbody>${rows}</tbody></table>`;
  }catch(err){
    document.getElementById('mini-board').innerHTML = '<p class="muted">Leaderboard coming soon.</p>';
  }
}
loadMiniBoard();

