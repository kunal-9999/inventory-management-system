-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(20) DEFAULT 'Kgs', -- Kgs or Lbs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_customers table (many-to-many relationship with annual volume)
CREATE TABLE IF NOT EXISTS product_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  annual_volume DECIMAL(15,2) DEFAULT 0,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, customer_id, year)
);

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock_records table (for opening/closing stock tracking)
CREATE TABLE IF NOT EXISTS stock_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  opening_stock DECIMAL(15,2) DEFAULT 0,
  closing_stock DECIMAL(15,2) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Kgs',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, month, year)
);

-- Create sales table (monthly sales tracking)
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  quantity DECIMAL(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'Kgs',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  container_number VARCHAR(100),
  quantity DECIMAL(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'Kgs',
  shipment_date DATE NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_customers_product ON product_customers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_customers_customer ON product_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_records_product_warehouse ON stock_records(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_records_month_year ON stock_records(month, year);
CREATE INDEX IF NOT EXISTS idx_sales_product_customer ON sales(product_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_month_year ON sales(month, year);
CREATE INDEX IF NOT EXISTS idx_shipments_product_warehouse ON shipments(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipments_month_year ON shipments(month, year);
