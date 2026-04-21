const API = '';
const $  = (sel) => document.querySelector(sel);

function persistUser(user) {
  localStorage.setItem('fb_user', JSON.stringify(user));
}

function loadPersistedUser() {
  try { return JSON.parse(localStorage.getItem('fb_user')); } catch { return null; }
}

function loginAs(user) {
  persistUser(user);
  window.location.href = 'index.html';
}

function switchTab(which) {
  const tabs = { quick: ['tab-quick', 'quick-tab'], creds: ['tab-creds', 'creds-tab'] };
  Object.values(tabs).forEach(([btn, pane]) => {
    $('#' + btn).classList.remove('active');
    $('#' + pane).classList.remove('active');
  });
  $('#' + tabs[which][0]).classList.add('active');
  $('#' + tabs[which][1]).classList.add('active');
}

async function handleLogin(e) {
  e.preventDefault();
  const username = $('#username-input').value.trim();
  const password = $('#password-input').value;
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  errEl.textContent = '';

  if (!username || !password) {
    errEl.textContent = 'Please fill in both fields.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = $('#login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';

  try {
    const basicAuth = 'Basic ' + btoa(`${username}:${password}`);
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Authorization': basicAuth },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    // Save credentials for future requests
    persistUser({ ...data.user, _auth: basicAuth });
    loginAs({ ...data.user, _auth: basicAuth });
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

async function loadUserPicker() {
  const container = $('#user-picker');
  try {
    const res  = await fetch(`${API}/api/users`);
    const users = await res.json();
    container.innerHTML = '';
    users.forEach(u => {
      const card = document.createElement('div');
      card.className = 'user-card-pick';
      card.innerHTML = `
        <img src="${u.avatar}" alt="${u.full_name}" onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}'" />
        <div>
          <p class="uname">${u.full_name}</p>
          <p class="uhandle">@${u.username}</p>
        </div>
      `;
      card.addEventListener('click', () => loginAs(u));
      container.appendChild(card);
    });
  } catch {
    container.innerHTML = "<p style='color:var(--text-muted);font-size:.85rem;'>Could not reach the server. Make sure it's running.</p>";
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (loadPersistedUser()) {
    window.location.href = 'index.html';
    return;
  }
  await loadUserPicker();
});

window.switchTab = switchTab;
window.handleLogin = handleLogin;
