
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER,
    date TEXT,
    desc_text TEXT
);