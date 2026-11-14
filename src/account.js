import { t, translateText } from './i18n.js';
const $ = id => document.getElementById(id);

export function createAccount(onChange = () => {}) {
  const form = $('account-form'), username = $('account-username'), password = $('account-password');
  const status = $('account-status'), logout = $('account-logout'), playerName = $('name');
  const buttons = [...form.querySelectorAll('button'), logout];
  let current = null, pending = false, guestName = playerName.value;

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }

  function busy(value) {
    pending = value;
    for (const button of buttons) button.disabled = value;
    form.setAttribute('aria-busy', String(value));
  }

  function render(user) {
    if (!current && user) guestName = playerName.value;
    current = user;
    $('account-user').textContent = user?.username || t("Guest");
    form.hidden = Boolean(user);
    logout.hidden = !user;
    playerName.readOnly = Boolean(user);
    playerName.value = user?.username || guestName;
    playerName.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = '';
    onChange(user);
    window.dispatchEvent(new CustomEvent('account-change', { detail: { user } }));
  }

  async function request(path, body) {
    const response = await fetch(`./api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(typeof data?.error === 'string' ? translateText(data.error) : t("Could not complete the request."));
      error.status = response.status;
      throw error;
    }
    if (!data || !('user' in data)) throw new Error(t("Invalid session response."));
    return data.user;
  }

  async function refresh() {
    if (pending) return current;
    busy(true);
    try {
      const user = await request('session');
      render(user);
      message(user ? t('Signed in as {name}.',{name:user.username}) : t("You can join a room as a guest."));
    } catch {
      message(t("Accounts are temporarily unavailable. You can play as a guest."), true);
    } finally {
      busy(false);
    }
    return current;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const registering = event.submitter === $('account-register');
    busy(true);
    message(registering ? t("Creating account…") : t("Signing in…"));
    try {
      const user = await request(registering ? 'register' : 'login', {
        username: username.value.trim(), password: password.value,
      });
      render(user);
      message(t('Signed in as {name}.',{name:user.username}));
      $('account-panel').open = false;
    } catch (error) {
      message(error.message, true);
      password.value = '';
      password.focus();
    } finally {
      busy(false);
    }
  });

  logout.addEventListener('click', async () => {
    if (pending) return;
    busy(true);
    message(t("Signing out…"));
    try {
      const user = await request('logout', {});
      render(user);
      message(t("Signed out. You can play as a guest."));
    } catch (error) {
      message(error.message, true);
    } finally {
      busy(false);
    }
  });

  window.addEventListener('language-change', () => {
    $('account-user').textContent=current?.username || t('Guest');
    if (!pending) message(current ? t('Signed in as {name}.',{name:current.username}) : t('You can join a room as a guest.'));
  });
  const ready = refresh();
  return { ready, refresh, get current() { return current; } };
}
