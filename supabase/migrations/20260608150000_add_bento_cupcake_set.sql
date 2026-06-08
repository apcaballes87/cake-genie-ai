-- Add Bento Cupcake Set base prices
INSERT INTO productsizes_cakegenie (type, thickness, cakesize, price, display_order, is_active) VALUES
('Bento Cupcake Set', '2 in', '4" Bento + 5 Cupcakes', 699, 1, true)
ON CONFLICT DO NOTHING;