function onOpen(){
  SpreadsheetApp.getUi().createMenu('AIGC Admin')
    .addItem('1) initProject_', 'initProject_')
    .addItem('2) seedAll_', 'seedAll_')
    .addItem('3) ragRefresh_', 'ragRefresh_')
    .addItem('4) LB refresh', 'handleLeaderboardRefresh_')
    .addToUi();
}
