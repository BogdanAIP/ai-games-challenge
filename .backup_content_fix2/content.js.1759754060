function handleContent_(data){
  // normalize aliases so front can send type/topic too
  try{
    if (data && !data.task && data.type)  data.task  = data.type;
    if (data && !data.task && data.topic) data.task  = data.topic;
  }catch(_){ /* noop */ }
  var task  = String(data?.task || '').trim(); // slogan | yt_description | logo_brief | brand_tone | music_brief
  var topic = String(data?.topic|| '').trim();
  if (!task || !topic) return {ok:false,error:'task/topic required'};
  var sys = prompt_('SYS_CONTENT',
    'You generate concise marketing assets: slogans (≤8 words), YouTube descriptions (≤150 words + 3 hashtags), logo briefs (bullets), brand tone (bullets), music brief (tempo/mood/instruments). Language=user.');
  var user = 'Task: '+task+'\nTopic: '+topic+'\nConstraints: concise, ready-to-use.';
  var res = askLLM_([{role:'system',content:sys},{role:'user',content:user}], {max_tokens:300});
  return {ok:true, model:res.model, result:res.text};
}
