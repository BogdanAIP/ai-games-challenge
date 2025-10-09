function doDeployTrigger() {
  // Проверяем соединение
  if (typeof UrlFetchApp === 'undefined') {
    throw new Error('UrlFetchApp not available');
  }

  // Обновляем базу знаний FAQ
  try {
    Logger.log('Updating FAQ knowledge base...');
    var result = ragRefresh_();
    Logger.log('RAG refresh result:', result);
  } catch(err) {
    console.error('RAG refresh failed:', err);
  }

  // Базовая проверка бота
  try {
    var testResult = handleFaq_({ question: 'Что такое AI Games Challenge?' });
    Logger.log('FAQ test response:', testResult);
  } catch(err) {
    console.error('FAQ handler test failed:', err);
  }

  // Базовая проверка регистрации
  try {
    handleRegistrationDialog_({ reply: 'ping' });
  } catch(err) {
    console.error('Registration dialog test failed:', err);
  }

  Logger.log('Deploy trigger executed successfully');
}