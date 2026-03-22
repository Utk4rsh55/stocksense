-- StockSense Database Schema
-- Run this file to create all tables: psql -U postgres -d stocksense -f schema.sql

-- Enable UUID extension (optional, we use SERIAL for simplicity)

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- PRODUCTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku_code VARCHAR(50) UNIQUE,
  category VARCHAR(80) DEFAULT 'General',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER DEFAULT 5,
  expiry_date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- SALES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(10,2) DEFAULT 0,
  payment_method VARCHAR(30) DEFAULT 'cash',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- SALE ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity_sold INTEGER NOT NULL DEFAULT 1,
  price_at_sale NUMERIC(10,2) NOT NULL,
  cost_at_sale NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_code);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
