import { FORM_ENDPOINT } from "./config.js";

/**
 * Унифицированная отправка любых форм на GAS.
 * Пример: submitToGAS({ name, email, team })
 */
export async function submitToGAS(payload, extraHeaders = {}) {
  const res = await fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GAS error ${res.status}: ${text}`);
  }
  // Пытаемся разобрать JSON; если не JSON — возвращаем текст
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}

/**
 * Утилита: собрать данные из HTMLFormElement в объект.
 */
export function formToObject(formEl) {
  const data = {};
  new FormData(formEl).forEach((v, k) => (data[k] = v));
  return data;
}
