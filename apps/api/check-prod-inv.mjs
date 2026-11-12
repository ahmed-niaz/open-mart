import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env' });
const sql = postgres(process.env.POSTGRES_DB_URL);

try {
  const products = await sql`
    SELECT id, title, sku, status, created_at FROM products ORDER BY created_at DESC
  `;
  console.log('Total Products in DB:', products.length);
  console.log('Sample products:', products.slice(0, 10));

  const inventoryItems = await sql`
    SELECT id, product_id, sku, quantity_on_hand, reserved_quantity FROM inventory_items
  `;
  console.log('Total Inventory Items in DB:', inventoryItems.length);
  console.log('Inventory items:', inventoryItems);
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
