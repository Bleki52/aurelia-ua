-- ============================================================================
-- AURELIA UA — Relational Database Schema (PostgreSQL)
-- Coursework 4-Table Normalized Relational Architecture
-- ============================================================================

-- 1. Таблиця зареєстрованих користувачів та адміністраторів
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Таблиця карток лояльності користувачів (Зв'язок 1:N з users)
CREATE TABLE IF NOT EXISTS loyalty_cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    store VARCHAR(80) NOT NULL,
    program VARCHAR(120),
    card_number VARCHAR(80) NOT NULL,
    qr_payload TEXT NOT NULL,
    points VARCHAR(80),
    cashback VARCHAR(80),
    screenshot_data TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Таблиця акційних товарів каталогу
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    city VARCHAR(60) DEFAULT 'ivano-frankivsk',
    category VARCHAR(80) NOT NULL,
    main_category VARCHAR(80) DEFAULT 'Продукти',
    sub_category VARCHAR(80) DEFAULT 'Бакалія',
    promo_tag VARCHAR(80),
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 4. Таблиця цін товару за мережами супермаркетів (Зв'язок 1:N з products)
CREATE TABLE IF NOT EXISTS product_prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    store VARCHAR(60) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    old_price NUMERIC(10, 2),
    source_url TEXT
);

-- Індекси для оптимізації вибірки цін, міст, категорій та карток
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user_id ON loyalty_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_store ON product_prices(store);
CREATE INDEX IF NOT EXISTS idx_products_city ON products(city);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_main_category ON products(main_category);
CREATE INDEX IF NOT EXISTS idx_products_sub_category ON products(sub_category);
