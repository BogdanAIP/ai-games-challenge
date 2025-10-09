/** =========================== setup.js (maintenance) ===========================
 * Инструменты обслуживания: фиксация шапки и колонок в Registrations.
 * Шапка: ['ts','id','team','channel_url','playlist_url','contact','country','city','verify_token','status','notes']
 * ============================================================================ */

function fixRegistrationsHeader_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  var header = ['ts','id','team','channel_url','playlist_url','contact','country','city','verify_token','status','notes'];
  if (!sh){
    sh = ss.insertSheet('Registrations');
    sh.getRange(1,1,1,header.length).setValues([header]);
    return { ok:true, created:true };
  }
  // Прочитаем факт. колонки и удалим всё, что правее ожидаемой шапки
  var lastCol = sh.getLastColumn();
  var needCols = header.length;
  if (lastCol > needCols){
    sh.deleteColumns(needCols+1, lastCol-needCols); // отрежем «хвост» (включая status.1 и т.д.)
  }
  // Переустановим шапку (гарантируем порядок)
  sh.getRange(1,1,1,needCols).setValues([header]);
  return { ok:true, trimmed:(lastCol-needCols>0) };
}
