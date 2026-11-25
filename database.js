/**
 * FreeSite Builder & WhatsApp Bot SaaS — Database Engine
 * Automatic Schema Initialization, Domain Registry & Baileys DB Session Storage
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

pool.on('connect', () => {
  console.log('[INFO]: ✅ Neon PostgreSQL Database Connected Successfully!');
});

pool.on('error', (err) => {
  console.error('[ERROR]: Database Pool Error:', err.message);
});

/**
 * সার্ভার চালু হলে সব টেবিল ও সিকিউরিটি কলাম স্বয়ংক্রিয়ভাবে তৈরি হবে
 */
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ১. ইউজার টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        plan VARCHAR(50) DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ২. সার্ভার ম্যানেজমেন্ট টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS worker_servers (
        id SERIAL PRIMARY KEY,
        server_name VARCHAR(100) NOT NULL,
        server_url VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        max_capacity INT DEFAULT 10,
        current_load INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ৩. প্ল্যাটফর্ম ডোমেইন ম্যানেজমেন্ট টেবিল (অ্যাডমিন প্যানেল থেকে ডোমেইন অ্যাড করার জন্য)
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_domains (
        id SERIAL PRIMARY KEY,
        domain_name VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_primary BOOLEAN DEFAULT FALSE,
        notes VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ৪. হোয়াটসঅ্যাপ বট টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_bots (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        server_id INT REFERENCES worker_servers(id) ON DELETE SET NULL,
        bot_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(30),
        website_url VARCHAR(255),
        system_prompt TEXT,
        addressing_style VARCHAR(50) DEFAULT 'ভাইয়া',
        delivery_inside INT DEFAULT 70,
        delivery_outside INT DEFAULT 130,
        admin_phone VARCHAR(30),
        telegram_token VARCHAR(255),
        telegram_chat_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'DISCONNECTED',
        bot_type VARCHAR(50) DEFAULT 'catalog_link',
        business_type VARCHAR(150),
        subdomain VARCHAR(100),
        base_domain VARCHAR(255) DEFAULT 'sojib.de5.net',
        rate_limit_daily INT DEFAULT 300,
        plan VARCHAR(30) DEFAULT 'free',
        expires_at TIMESTAMP,
        package_name VARCHAR(100) DEFAULT 'Free Trial',
        trial_used BOOLEAN DEFAULT FALSE,
        trial_expires_at TIMESTAMP,
        tokens_used INT DEFAULT 0,
        requests_today INT DEFAULT 0,
        gemini_api_key TEXT,
        imgbb_api_key TEXT,
        alert_phone VARCHAR(50),
        knowledge_source VARCHAR(30) DEFAULT 'catalog',
        dashboard_token VARCHAR(128),
        owner_pin_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // পুরনো ডাটাবেজ থাকলে অনুপস্থিত কলামগুলো সেফলি যোগ করা
    await client.query(`
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS bot_type VARCHAR(50) DEFAULT 'catalog_link';
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS business_type VARCHAR(150);
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100);
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS base_domain VARCHAR(255) DEFAULT 'sojib.de5.net';
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS rate_limit_daily INT DEFAULT 300;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'free';
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS package_name VARCHAR(100) DEFAULT 'Free Trial';
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS tokens_used INT DEFAULT 0;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS requests_today INT DEFAULT 0;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS imgbb_api_key TEXT;
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS alert_phone VARCHAR(50);
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS knowledge_source VARCHAR(30) DEFAULT 'catalog';
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS dashboard_token VARCHAR(128);
      ALTER TABLE whatsapp_bots ADD COLUMN IF NOT EXISTS owner_pin_hash VARCHAR(255);
    `);

    // ৫. হোয়াটসঅ্যাপ সেশন টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        bot_id INT NOT NULL,
        session_key VARCHAR(255) NOT NULL,
        session_data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (bot_id, session_key)
      );
    `);

    // ৬. ওয়েবসাইট পণ্য ক্যাটালগ টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_products (
        id SERIAL PRIMARY KEY,
        bot_id INT REFERENCES whatsapp_bots(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) DEFAULT 0,
        regular_price NUMERIC(10, 2),
        category VARCHAR(100),
        in_stock BOOLEAN DEFAULT TRUE,
        buy_link TEXT,
        image_url TEXT,
        demo_images TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE bot_products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE bot_products ADD COLUMN IF NOT EXISTS regular_price NUMERIC(10, 2);
      ALTER TABLE bot_products ADD COLUMN IF NOT EXISTS demo_images TEXT;
    `);

    // ৭. ওয়েবসাইট হোস্ট ও সাবডোমেইন টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS hosted_websites (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        bot_id INT REFERENCES whatsapp_bots(id) ON DELETE CASCADE,
        subdomain VARCHAR(100) NOT NULL,
        base_domain VARCHAR(255) NOT NULL,
        html_content TEXT,
        theme_color VARCHAR(30) DEFAULT '#059669',
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (subdomain, base_domain)
      );
      ALTER TABLE hosted_websites ADD COLUMN IF NOT EXISTS bot_id INT REFERENCES whatsapp_bots(id) ON DELETE CASCADE;
      ALTER TABLE hosted_websites ADD COLUMN IF NOT EXISTS theme_color VARCHAR(30) DEFAULT '#059669';
    `);

    // ৮. অর্ডার, পেমেন্ট, অ্যাডমিন সেটিংস ও ক্যাটালগ টেবিল
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_catalogs (
        id SERIAL PRIMARY KEY,
        catalog_slug VARCHAR(100) UNIQUE,
        store_name VARCHAR(150),
        items_json JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS store_catalogs (
        id SERIAL PRIMARY KEY,
        catalog_slug VARCHAR(100) UNIQUE NOT NULL,
        store_name VARCHAR(150) NOT NULL,
        admin_pin VARCHAR(128) DEFAULT '1234',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE store_catalogs ADD COLUMN IF NOT EXISTS admin_pin VARCHAR(128) DEFAULT '1234';

      CREATE TABLE IF NOT EXISTS store_catalog_items (
        id SERIAL PRIMARY KEY,
        catalog_slug VARCHAR(100) REFERENCES store_catalogs(catalog_slug) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        category VARCHAR(100),
        image_url TEXT,
        demo_images TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE store_catalog_items ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE store_catalog_items ADD COLUMN IF NOT EXISTS demo_images TEXT;

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        bot_id INT REFERENCES whatsapp_bots(id) ON DELETE CASCADE,
        payment_method VARCHAR(50),
        sender_number VARCHAR(50),
        trx_id VARCHAR(100) UNIQUE,
        amount NUMERIC(10, 2),
        approved_days INT DEFAULT 30,
        custom_limit INT DEFAULT 3000,
        status VARCHAR(30) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_days INT DEFAULT 30;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS custom_limit INT DEFAULT 3000;

      CREATE TABLE IF NOT EXISTS admin_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS bot_orders (
        id SERIAL PRIMARY KEY,
        bot_id INT REFERENCES whatsapp_bots(id) ON DELETE CASCADE,
        customer_phone VARCHAR(50),
        customer_name VARCHAR(150),
        shipping_address TEXT,
        product_details TEXT,
        status VARCHAR(50) DEFAULT 'NEW',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor VARCHAR(100) NOT NULL,
        action VARCHAR(120) NOT NULL,
        details TEXT,
        ip_address VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ডিফল্ট ডোমেইন সিড
    await client.query(`
      INSERT INTO platform_domains (domain_name, is_active, is_primary, notes) VALUES
      ('sojib.de5.net', TRUE, TRUE, 'Primary Default Domain'),
      ('sojub.cc.cd', TRUE, FALSE, 'Secondary Default Domain')
      ON CONFLICT (domain_name) DO NOTHING;
    `);

    // ডিফল্ট অ্যাডমিন সেটিংস
    const defaultAdminPass = process.env.ADMIN_PASSWORD || '@1234567890@sojib@1234567890@sojib#';
    await client.query(`
      INSERT INTO admin_settings (key, value) VALUES
      ('bkash_no', '01409084819'),
      ('nagad_no', '01409084819'),
      ('rocket_no', '01409084819'),
      ('max_bots_per_server', '4'),
      ('admin_password', $1)
      ON CONFLICT (key) DO NOTHING;
    `, [defaultAdminPass]);

    await client.query('COMMIT');
    console.log('[INFO]: ✅ All SaaS Database Tables Initialized Automatically!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR]: Failed to initialize database tables:', err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase
};
