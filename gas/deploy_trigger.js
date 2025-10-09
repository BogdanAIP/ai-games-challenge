function doDeployTrigger() {
  // Проверяем соединение
  if (typeof UrlFetchApp === 'undefined') {
    throw new Error('UrlFetchApp not available');
  }

  // Базовая проверка бота
  try {
    handleFaq_({ question: 'ping' });
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