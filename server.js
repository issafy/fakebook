const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const db      = require('./database');

const app = express();
const PORT = 3001;

// In development allow the Vite dev server's origin;
// in production the frontend is served from the same origin.
app.use(cors());
app.use(express.json());

// ─── Static (production only) ───────────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
const isProd   = fs.existsSync(distPath);
if (isProd) {
  app.use(express.static(distPath));
}


// ─── Helpers ───────────────────────────────────────────────────────────────
const getUser = (id) => db.prepare('SELECT id, username, full_name, avatar, bio FROM users WHERE id = ?').get(id);

// Basic Auth middleware
function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  const base64 = authHeader.split(' ')[1];
  try {
    const [username, password] = Buffer.from(base64, 'base64').toString().split(':');
    return { username, password };
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const creds = parseBasicAuth(req.headers['authorization']);
  if (!creds) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(creds.username);
  if (!user || user.password !== creds.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.user = user;
  next();
}

// ─── Users ─────────────────────────────────────────────────────────────────

// GET all users (for the login picker)
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, avatar, bio FROM users').all();
  res.json(users);
});

// GET single user by id
app.get('/api/users/:id', (req, res) => {
  const user = getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST login (Basic Auth check)
app.post('/api/login', (req, res) => {
  const creds = parseBasicAuth(req.headers['authorization']);
  if (!creds) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(creds.username);
  if (!user || user.password !== creds.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ─── Posts ─────────────────────────────────────────────────────────────────

// GET all posts (with author info, like count, comment count)
app.get('/api/posts', requireAuth, (req, res) => {
  const currentUserId = req.user.id;

  const posts = db.prepare(`
    SELECT
      p.id, p.content, p.image_url, p.created_at,
      u.id as author_id, u.username, u.full_name, u.avatar,
      COUNT(DISTINCT l.id) as like_count,
      COUNT(DISTINCT c.id) as comment_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN comments c ON p.id = c.post_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();

  const result = posts.map(post => {
    let liked = false;
    if (currentUserId) {
      const like = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(currentUserId, post.id);
      liked = !!like;
    }
    return { ...post, liked };
  });

  res.json(result);
});

// GET single post with comments
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username, u.full_name, u.avatar,
           COUNT(DISTINCT l.id) as like_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN likes l ON p.id = l.post_id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comments = db.prepare(`
    SELECT c.*, u.username, u.full_name, u.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);

  res.json({ ...post, comments });
});

// POST create post

app.post('/api/posts', requireAuth, (req, res) => {
  const userId = req.user.id;

  const { content, image_url } = req.body;
  if (!content && !image_url) return res.status(400).json({ error: 'Post needs content or image' });

  const info = db.prepare('INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)').run(userId, content || null, image_url || null);

  const post = db.prepare(`
    SELECT p.*, u.username, u.full_name, u.avatar, 0 as like_count, 0 as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({ ...post, liked: false });
});

// DELETE post

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id != userId) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// ─── Likes ─────────────────────────────────────────────────────────────────

// POST toggle like

app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const userId = req.user.id;

  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(userId, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(userId, req.params.id);
  } else {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, req.params.id);
  }

  const { like_count } = db.prepare('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?').get(req.params.id);
  res.json({ liked: !existing, like_count });
});

// ─── Comments ──────────────────────────────────────────────────────────────

// GET comments for post
app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.username, u.full_name, u.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// POST add comment

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const userId = req.user.id;

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });

  const info = db.prepare('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)').run(userId, req.params.id, content);

  const comment = db.prepare(`
    SELECT c.*, u.username, u.full_name, u.avatar
    FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(comment);
});

// ─── SPA Fallback (production) ─────────────────────────────────────────────
// Serve index.html for any route that isn't /api, so the frontend router works.
if (isProd) {
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const mode = isProd ? 'production' : 'development';
  console.log(`🚀 Fakebook running in ${mode} mode at http://localhost:${PORT}`);
});
