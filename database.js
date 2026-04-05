const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'fakebook.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );
`);

// --- Seed Data ---
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (username, full_name, email, password, avatar, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const users = [
    ['harry_p',    'Harry Potter',       'harry@hogwarts.edu',   'password123', 'https://api.dicebear.com/7.x/adventurer/svg?seed=harry&backgroundColor=b6e3f4',    "The Boy Who Lived. Gryffindor ⚡ | Just trying to survive."],
    ['hermione_g', 'Hermione Granger',   'hermione@hogwarts.edu','password123', 'https://api.dicebear.com/7.x/adventurer/svg?seed=hermione&backgroundColor=ffdfbf', "Books & cleverness 📚 | Top of my class at Hogwarts."],
    ['ron_w',      'Ron Weasley',        'ron@hogwarts.edu',     'password123', 'https://api.dicebear.com/7.x/adventurer/svg?seed=ron&backgroundColor=c0aede',      "Wizard chess champion ♟️ | Keeper of the Golden Gate."],
    ['luna_l',     'Luna Lovegood',      'luna@hogwarts.edu',    'password123', 'https://api.dicebear.com/7.x/adventurer/svg?seed=luna&backgroundColor=d1f4d9',     "Ravenclaw 🌙 | You're just as sane as I am."],
    ['neville_l',  'Neville Longbottom', 'neville@hogwarts.edu', 'password123', 'https://api.dicebear.com/7.x/adventurer/svg?seed=neville&backgroundColor=ffd5dc',  "Herbology nerd 🌿 | Gryffindor. Yes, really."],
  ];

  const insertedUsers = users.map(u => {
    const info = insertUser.run(...u);
    return info.lastInsertRowid;
  });

  const [harryId, hermioneId, ronId, lunaId, nevilleId] = insertedUsers;

  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, image_url, created_at)
    VALUES (?, ?, ?, datetime('now', ? || ' hours'))
  `);

  const posts = [
    [harryId,    "Just found out I'm a wizard. No big deal. 🧙‍♂️✨", null, '-72'],
    [harryId,    "Quidditch practice was brutal today. My broom's still smoking 🧹🔥", null, '-48'],
    [hermioneId, "Finished reading 'Hogwarts: A History' for the 12th time. Still finding new things! 📖", null, '-96'],
    [hermioneId, "Pro tip: Always read the spell description before casting. Ask Ron if you don't believe me 😬", null, '-24'],
    [ronId,      "Mum sent another howler. Apparently borrowing the flying car was 'reckless'. WORTH IT. 🚗☁️", null, '-60'],
    [ronId,      "Checkmate in 4 moves. I'm basically a genius.", null, '-12'],
    [lunaId,     "I believe the Nargles are particularly active near the mistletoe today. Stay vigilant 🌟", null, '-84'],
    [lunaId,     "Just spotted what I'm fairly certain was a Crumple-Horned Snorkack in the Forbidden Forest. Bliss.", null, '-36'],
    [nevilleId,  "My Mandrake just screamed loud enough to knock Draco flat. Truly a proud day. 🌱", null, '-108'],
    [nevilleId,  "Gran says I'm getting better. Coming from her, that might be the highest praise imaginable 🌿", null, '-6'],
  ];

  posts.forEach(p => insertPost.run(...p));
}

module.exports = db;
