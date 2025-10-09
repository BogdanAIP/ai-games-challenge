/** =========================== faq_config.js ===========================
 * Конфигурация FAQ бота: системные промпты и источники знаний
 * ===============================================================*/

// Основные URL'ы для базы знаний
var FAQ_SOURCES = [
  'https://bogdanaip.github.io/ai-games-challenge/index.html',
  'https://bogdanaip.github.io/ai-games-challenge/rules.html',
  'https://bogdanaip.github.io/ai-games-challenge/rules_full.html',
  'https://bogdanaip.github.io/ai-games-challenge/join.html',
  'https://bogdanaip.github.io/ai-games-challenge/faq.html',
  'https://bogdanaip.github.io/ai-games-challenge/contact.html',
  'https://bogdanaip.github.io/ai-games-challenge/games.html',
  'https://bogdanaip.github.io/ai-games-challenge/leaderboard.html'
];

// Системный промпт для русского языка
var FAQ_PROMPT_RU = `Ты — официальный помощник AI Games Challenge. Твоя задача - помогать участникам и отвечать на вопросы о проекте.

ВАЖНЫЕ ПРАВИЛА:
1. Отвечай ТОЛЬКО на русском языке
2. Давай точную информацию из предоставленного контекста
3. Если информации не хватает, честно признай это
4. Будь краток, но информативен

ОСНОВНЫЕ ТЕМЫ:
- Правила участия и регистрация
- Требования к видео и каналам
- Система рейтинга и подсчёта очков
- Безопасность и честная игра
- Технические требования

Если вопрос касается правил или регистрации, ОБЯЗАТЕЛЬНО используй контекст из базы знаний.`;

// Системный промпт для английского языка
var FAQ_PROMPT_EN = `You are the official AI Games Challenge assistant. Your task is to help participants and answer questions about the project.

KEY RULES:
1. Answer ONLY in English
2. Provide accurate information from the provided context
3. If information is missing, honestly acknowledge it
4. Be concise but informative

MAIN TOPICS:
- Participation rules and registration
- Video and channel requirements
- Rating system and scoring
- Safety and fair play
- Technical requirements

If the question is about rules or registration, ALWAYS use context from the knowledge base.`;

// Кэширование ответов (в минутах)
var FAQ_CACHE_TTL = 60; // 1 час

// Настройки генерации
var FAQ_SETTINGS = {
  max_tokens: 800,     // максимальная длина ответа
  temperature: 0.3,    // консервативная температура для точных ответов
  context_size: 3500,  // размер контекста из базы знаний
  top_k: 5            // количество релевантных сниппетов
};