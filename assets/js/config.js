/**
 * Глобальная конфигурация клиентской части сайта.
 * ВАЖНО: один источник правды для GAS эндпоинта.
 */
export const FORM_ENDPOINT =
  typeof window !== "undefined" && window.FORM_ENDPOINT
    ? window.FORM_ENDPOINT
    : "https://script.google.com/macros/s/AKfycbwEoubAzQRPUGryKHVwQ0L5aZq0hRgtTtEKg7gB_NhvXItfIaNQdogn4TBcDxXpNk8A/exec";
