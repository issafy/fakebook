/* ═══════════════════════════════════════════════════════════
   FAKEBOOK — Client-side Logic
   API Base: http://localhost:3001
   ═══════════════════════════════════════════════════════════ */

const API = '';

// ─── State ──────────────────────────────────────────────────
let currentUser  = null;
let activePostId = null;   // for comments modal

// ─── Utilities ──────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function showToast(msg, duration = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── Screens ────────────────────────────────────────────────
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

// ─── Auth ────────────────────────────────────────────────────
function persistUser(user) {
  currentUser = user;
  localStorage.setItem('fb_user', JSON.stringify(user));
}
function loadPersistedUser() {
  try { return JSON.parse(localStorage.getItem('fb_user')); } catch { return null; }
}
function logout() {
  currentUser = null;
  localStorage.removeItem('fb_user');
  window.location.href = 'login.html';
}

function loginAs(user) {
  persistUser(user);
  applyUserToUI();
  showScreen('feed-screen');
  loadFeed();
  loadPeople();
}

function applyUserToUI() {
  $('#header-avatar').src    = currentUser.avatar || '';
  $('#header-name').textContent = currentUser.full_name;
  $('#sidebar-avatar').src   = currentUser.avatar || '';
  $('#sidebar-name').textContent = currentUser.full_name;
  $('#sidebar-username').textContent = '@' + currentUser.username;
  $('#sidebar-bio').textContent = currentUser.bio || '';
  $('#modal-avatar').src     = currentUser.avatar || '';
  $('#modal-author-name').textContent = currentUser.full_name;
  $('#comment-author-avatar').src = currentUser.avatar || '';
}

// ─── Login tabs ─────────────────────────────────────────────
function switchTab(which) {
  const tabs = { quick: ['tab-quick', 'quick-tab'], creds: ['tab-creds', 'creds-tab'] };
  Object.values(tabs).forEach(([btn, pane]) => {
    $('#' + btn).classList.remove('active');
    $('#' + pane).classList.remove('active');
  });
  $('#' + tabs[which][0]).classList.add('active');
  $('#' + tabs[which][1]).classList.add('active');
}

// Credentials form
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
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    loginAs(data.user);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

// Load user picker
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
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Could not reach the server. Make sure it\'s running.</p>';
  }
}

// ─── People sidebar ─────────────────────────────────────────
async function loadPeople() {
  const list = $('#people-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const res   = await fetch(`${API}/api/users`);
    const users = await res.json();
    list.innerHTML = '';
    users.filter(u => u.id !== currentUser.id).forEach(u => {
      const row = document.createElement('div');
      row.className = 'person-row';
      row.innerHTML = `
        <img src="${u.avatar}" alt="${u.full_name}" onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}'" />
        <div>
          <p class="person-name">${u.full_name}</p>
          <p class="person-handle">@${u.username}</p>
        </div>
      `;
      list.appendChild(row);
    });
  } catch {
    list.innerHTML = '';
  }
}

// ─── Feed ────────────────────────────────────────────────────
async function loadFeed() {
  const container = $('#feed-posts');
  container.innerHTML = '<div class="spinner centered"></div>';
  try {
    const res   = await fetch(`${API}/api/posts`, {
      headers: { 'x-user-id': currentUser.id },
    });
    const posts = await res.json();
    container.innerHTML = '';
    if (!posts.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No posts yet. Be the first!</p>';
      return;
    }
    posts.forEach((p, i) => {
      const card = createPostCard(p, i);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Failed to load posts.</p>';
  }
}

function createPostCard(post, index = 0) {
  const card = document.createElement('div');
  card.className = 'post-card glass';
  card.dataset.postId = post.id;
  card.style.animationDelay = `${index * 60}ms`;

  const isOwner = currentUser && post.author_id === currentUser.id;

  card.innerHTML = `
    <div class="post-header">
      <img class="post-avatar" src="${post.avatar}" alt="${post.full_name}"
           onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${post.username}'" />
      <div>
        <p class="post-author-name">${post.full_name}</p>
        <p class="post-author-handle">@${post.username}</p>
      </div>
      <span class="post-time">${timeAgo(post.created_at)}</span>
    </div>
    ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ''}
    ${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="Post image" onerror="this.style.display='none'" />` : ''}
    <div class="post-actions">
      <button class="action-btn like-btn ${post.liked ? 'liked' : ''}" data-post-id="${post.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${post.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span class="like-count">${post.like_count}</span>
      </button>
      <button class="action-btn comment-btn" data-post-id="${post.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="comment-count">${post.comment_count}</span>
      </button>
      ${isOwner ? `
        <button class="action-btn delete-btn" data-post-id="${post.id}" title="Delete post">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>` : ''}
    </div>
  `;

  // Bind events
  card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card));
  card.querySelector('.comment-btn').addEventListener('click', () => openCommentsModal(post.id));
  if (isOwner) {
    card.querySelector('.delete-btn').addEventListener('click', () => deletePost(post.id, card));
  }

  return card;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Likes ───────────────────────────────────────────────────
async function toggleLike(postId, card) {
  const btn       = card.querySelector('.like-btn');
  const countSpan = btn.querySelector('.like-count');
  const svg       = btn.querySelector('svg path');

  try {
    const res  = await fetch(`${API}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'x-user-id': currentUser.id },
    });
    const data = await res.json();
    countSpan.textContent = data.like_count;

    if (data.liked) {
      btn.classList.add('liked');
      svg.setAttribute('fill', 'currentColor');
    } else {
      btn.classList.remove('liked');
      svg.setAttribute('fill', 'none');
    }
    // Pop animation
    btn.style.transform = 'scale(1.25)';
    setTimeout(() => btn.style.transform = '', 200);
  } catch { showToast('Could not update like.'); }
}

// ─── New Post ────────────────────────────────────────────────
function openNewPostModal() {
  $('#post-content').value = '';
  $('#post-image-url').value = '';
  $('#image-preview-wrap').classList.add('hidden');
  $('#char-count').textContent = '0 / 500';
  $('#new-post-modal').classList.remove('hidden');
  setTimeout(() => $('#post-content').focus(), 100);
}
function closeNewPostModal() { $('#new-post-modal').classList.add('hidden'); }
function closeModalOnBackdrop(e) {
  if (e.target === $('#new-post-modal')) closeNewPostModal();
}

// Char counter & image preview
$('#post-content')?.addEventListener('input', () => {
  const len = document.getElementById('post-content').value.length;
  document.getElementById('char-count').textContent = `${len} / 500`;
});

$('#post-image-url')?.addEventListener('input', () => {
  const url = document.getElementById('post-image-url').value.trim();
  const wrap = document.getElementById('image-preview-wrap');
  const img  = document.getElementById('image-preview');
  if (url) {
    img.src = url;
    wrap.classList.remove('hidden');
    img.onerror = () => wrap.classList.add('hidden');
  } else {
    wrap.classList.add('hidden');
  }
});

async function submitPost() {
  const content   = $('#post-content').value.trim();
  const image_url = $('#post-image-url').value.trim();
  if (!content && !image_url) { showToast('Add some text or an image!'); return; }

  const btn = $('#submit-post-btn');
  btn.disabled = true;

  try {
    const res  = await fetch(`${API}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ content, image_url: image_url || null }),
    });
    const post = await res.json();
    if (!res.ok) throw new Error(post.error);

    closeNewPostModal();
    const card = createPostCard(post, 0);
    card.style.animationDelay = '0ms';
    const list = $('#feed-posts');
    list.insertBefore(card, list.firstChild);
    showToast('✨ Post shared!');
  } catch (err) {
    showToast('Could not share post: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ─── Delete Post ─────────────────────────────────────────────
async function deletePost(postId, card) {
  if (!confirm('Delete this post?')) return;
  try {
    const res = await fetch(`${API}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': currentUser.id },
    });
    if (!res.ok) throw new Error();
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    card.style.transition = 'all 0.25s ease';
    setTimeout(() => card.remove(), 250);
    showToast('Post deleted.');
  } catch { showToast('Could not delete post.'); }
}

// ─── Comments ────────────────────────────────────────────────
async function openCommentsModal(postId) {
  activePostId = postId;
  $('#comment-input').value = '';
  $('#comments-list').innerHTML = '<div class="spinner"></div>';
  $('#comments-modal').classList.remove('hidden');
  await loadComments(postId);
  setTimeout(() => $('#comment-input').focus(), 150);
}
function closeCommentsModal() { $('#comments-modal').classList.add('hidden'); activePostId = null; }
function closeCommentsOnBackdrop(e) {
  if (e.target === $('#comments-modal')) closeCommentsModal();
}

async function loadComments(postId) {
  try {
    const res  = await fetch(`${API}/api/posts/${postId}/comments`);
    const data = await res.json();
    renderComments(data);
  } catch { $('#comments-list').innerHTML = '<p style="color:var(--text-muted)">Failed.</p>'; }
}

function renderComments(comments) {
  const list = $('#comments-list');
  if (!comments.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:1rem 0">No comments yet. Be first!</p>';
    return;
  }
  list.innerHTML = '';
  comments.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <img src="${c.avatar}" alt="${c.full_name}" onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${c.username}'" />
      <div class="comment-bubble">
        <strong>${c.full_name}</strong>
        <p>${escapeHtml(c.content)}</p>
        <time>${timeAgo(c.created_at)}</time>
      </div>
    `;
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
}

function handleCommentKey(e) { if (e.key === 'Enter') submitComment(); }

async function submitComment() {
  if (!activePostId) return;
  const input   = $('#comment-input');
  const content = input.value.trim();
  if (!content) return;

  try {
    const res  = await fetch(`${API}/api/posts/${activePostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ content }),
    });
    const comment = await res.json();
    if (!res.ok) throw new Error(comment.error);
    input.value = '';
    await loadComments(activePostId);

    // Update count on feed card
    const card = document.querySelector(`[data-post-id="${activePostId}"]`);
    if (card) {
      const span = card.querySelector('.comment-count');
      if (span) span.textContent = parseInt(span.textContent) + 1;
    }
  } catch (err) { showToast('Could not post comment.'); }
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Setup event listeners that can't use onclick in HTML (character-counter etc.)
  document.getElementById('post-content').addEventListener('input', function() {
    document.getElementById('char-count').textContent = `${this.value.length} / 500`;
  });
  document.getElementById('post-image-url').addEventListener('input', function() {
    const wrap = document.getElementById('image-preview-wrap');
    const img  = document.getElementById('image-preview');
    if (this.value) {
      img.src = this.value;
      wrap.classList.remove('hidden');
      img.onerror = () => wrap.classList.add('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  });

  // Resume session
  const stored = loadPersistedUser();
  if (stored) {
    currentUser = stored;
    applyUserToUI();
    loadFeed();
    loadPeople();
  } else {
    window.location.href = 'login.html';
  }
});

window.logout = logout;
window.openNewPostModal = openNewPostModal;
window.closeNewPostModal = closeNewPostModal;
window.closeModalOnBackdrop = closeModalOnBackdrop;
window.submitPost = submitPost;
window.openCommentsModal = openCommentsModal;
window.closeCommentsModal = closeCommentsModal;
window.closeCommentsOnBackdrop = closeCommentsOnBackdrop;
window.submitComment = submitComment;
window.handleCommentKey = handleCommentKey;
