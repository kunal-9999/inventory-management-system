-- Insert sample customers
INSERT INTO customers (name, email, phone, address) VALUES
('ABC Manufacturing', 'contact@abcmfg.com', '+1-555-0101', '123 Industrial Ave, City A'),
('XYZ Corp', 'orders@xyzcorp.com', '+1-555-0102', '456 Business Blvd, City B'),
('Global Traders Ltd', 'info@globaltraders.com', '+1-555-0103', '789 Commerce St, City C')
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO products (name, description, unit) VALUES
('Premium Steel Rods', 'High-grade steel rods for construction', 'Kgs'),
('Aluminum Sheets', 'Industrial aluminum sheets', 'Kgs'),
('Copper Wire', 'Electrical copper wire', 'Lbs'),
('Stainless Pipes', 'Stainless steel pipes', 'Kgs')
ON CONFLICT DO NOTHING;

-- Insert sample warehouses
INSERT INTO warehouses (name, location) VALUES
('Main Warehouse', 'Downtown Storage Facility'),
('North Depot', 'North Industrial Zone'),
('South Hub', 'South Distribution Center')
ON CONFLICT DO NOTHING;

-- Insert sample product-customer relationships with annual volumes
INSERT INTO product_customers (product_id, customer_id, annual_volume, year)
SELECT 
  p.id,
  c.id,
  CASE 
    WHEN p.name = 'Premium Steel Rods' AND c.name = 'ABC Manufacturing' THEN 50000.00
    WHEN p.name = 'Aluminum Sheets' AND c.name = 'XYZ Corp' THEN 25000.00
    WHEN p.name = 'Copper Wire' AND c.name = 'Global Traders Ltd' THEN 15000.00
    ELSE 10000.00
  END,
  2024
FROM products p
CROSS JOIN customers c
WHERE (p.name = 'Premium Steel Rods' AND c.name = 'ABC Manufacturing')
   OR (p.name = 'Aluminum Sheets' AND c.name = 'XYZ Corp')
   OR (p.name = 'Copper Wire' AND c.name = 'Global Traders Ltd')
ON CONFLICT (product_id, customer_id, year) DO NOTHING;
