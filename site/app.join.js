/**
 * Join form client logic (reads endpoint from site/public/config.json)
 * - Strictly requires JSON response; if HTML/echo arrives — shows a clear error.
 * - Optional: "Mint token" button (server still generates its own token).
 */

let FORM_ENDPOINT = null;

async function loadConfig() {
  const res = await fetch('./public/config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Config not found');
  const cfg = await res.json();
  FORM_ENDPOINT = cfg.FORM_ENDPOINT;
  if (!FORM_ENDPOINT) throw new Error('FORM_ENDPOINT missing in config.json');
}

async function pingEndpoint() {
  // Optional health-check: if server doesn’t return JSON, fail fast
  const r = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ping' })
  });
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    const t = await r.text();
    throw new Error('Endpoint returned non-JSON (likely echo/stub). Check FORM_ENDPOINT.\n' + t.slice(0, 500));
  }
  const j = await r.json();
  if (!j.ok) throw new Error('Ping failed: ' + (j.error || 'unknown error'));
}

function byName(name) {
  return document.querySelector(`[name="${name}"]`);
}

function getTrim(name) {
  const el = byName(name);
  return el ? el.value.trim() : '';
}

function showStatus(msg, ok = false) {
  let box = document.getElementById('join-status');
  if (!box) {
    box = document.createElement('div');
    box.id = 'join-status';
    box.style.marginTop = '1rem';
    document.querySelector('main')?.prepend(box);
  }
  box.textContent = msg;
  box.className = ok ? 'alert alert-ok' : 'alert alert-err';
}

function setBusy(disabled) {
  const btn = document.getElementById('join-submit') || document.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = disabled;
    btn.textContent = disabled ? 'Submitting…' : 'Submit registration';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(btoa(String.fromCharCode(...new Uint8Array(r.result))));
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

async function collectPayload() {
  const team         = getTrim('team');
  const country      = getTrim('country');
  const contact      = getTrim('contact');
  const channel_url  = getTrim('channel_url');
  const playlist_url = getTrim('playlist_url');
  const notes        = getTrim('notes');

  const agree1 = document.querySelector('[name="confirm_info"]')?.checked;
  const agree2 = document.querySelector('[name="agree_rules"]')?.checked;

  if (!team || !country || !contact || !channel_url || !playlist_url) {
    throw new Error('Please fill all required fields (team, country, contact, channel, playlist).');
  }
  if (!agree1 || !agree2) {
    throw new Error('Please confirm accuracy and agree to the Rules.');
  }

  // Optional file
  let fileObj = null;
  const f = document.querySelector('input[type="file"][name="rules_file"]')?.files?.[0];
  if (f) {
    if (f.size > 5 * 1024 * 1024) throw new Error('Rules file too large (max 5 MB).');
    fileObj = {
      name: f.name,
      mime: f.type || 'application/octet-stream',
      base64: await fileToBase64(f)
    };
  }

  return { team, country, contact, channel_url, playlist_url, notes, file: fileObj };
}

async function submitJoin(payload) {
  const r = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // server generates token itself; client does not send "token"
    body: JSON.stringify(payload)
  });
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    const text = await r.text();
    throw new Error('Unexpected non-JSON response from endpoint.\nCheck FORM_ENDPOINT.\n\n' + text.slice(0, 800));
  }
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Server error');
  return j;
}

async function handleMintClick(ev) {
  ev.preventDefault();
  try {
    setBusy(true);
    const r = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mint' })
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      const text = await r.text();
      throw new Error('Unexpected non-JSON from mint.\n' + text.slice(0, 500));
    }
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Mint failed');
    // заполним поле токена, если оно есть на форме — чисто для удобства
    const tokenField = byName('token');
    if (tokenField) tokenField.value = j.token;
    showStatus('Verification token minted. Paste it into your playlist description.', true);
  } catch (e) {
    showStatus(e.message || String(e));
  } finally {
    setBusy(false);
  }
}

async function handleSubmit(ev) {
  ev.preventDefault();
  try {
    setBusy(true);
    const payload = await collectPayload();
    const res = await submitJoin(payload);
    const link = res.issue_url ? `\nYour registration: ${res.issue_url}` : '';
    showStatus(`Registration submitted. We’ll verify your token soon.${link}`, true);
    // optionally reset
    ev.target.reset?.();
  } catch (e) {
    showStatus(e.message || String(e));
  } finally {
    setBusy(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadConfig();
    await pingEndpoint(); // health check, fail fast if echo/stub
  } catch (e) {
    showStatus(e.message || String(e));
    return; // не вешаем обработчики, если эндпоинт не ок
  }

  const form = document.querySelector('form#join-form') || document.querySelector('form[data-join-form]');
  if (form) form.addEventListener('submit', handleSubmit);

  const mintBtn = document.getElementById('mint-token') || document.querySelector('[data-action="mint"]');
  if (mintBtn) mintBtn.addEventListener('click', handleMintClick);
});
