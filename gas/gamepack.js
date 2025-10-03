function handleGamePack_(data){
  var sys = prompt_('SYS_GAMEPACK',
    'Create a Markdown one-pager for a NEW PHYSICAL GAME with sections: Name, Slogan, Players & Equipment, Setup, Objective, Rules, Safety, Variations, Scoring. Language=user.');
  var user = ['Title:',data?.title||'', '\nIdea:',data?.idea||'', '\nOutline of rules:',data?.rules_outline||''].join(' ');
  var res = askLLM_([{role:'system',content:sys},{role:'user',content:user}], {max_tokens:700});
  var blob = Utilities.newBlob(res.text, 'text/markdown', (data?.title||'Game')+'.md');
  var file = DriveApp.createFile(blob);
  return { ok:true, model:res.model, file_id:file.getId(), file_url:'https://drive.google.com/file/d/'+file.getId()+'/view?usp=sharing', md: res.text };
}
