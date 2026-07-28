/* ============================================================
   data.js  –  Shared data layer
   Stores products & orders in localStorage.
   Syncs to Google Sheets via the deployed Apps Script URL.
   ============================================================ */

// ── Replace this with your deployed Apps Script Web App URL ──
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzUvdDfGRKB3_aI9eJuu9xJQ_UUXphklfQcDhNWV6_CAfklH4j4hi0AUeOQUw3KKzNwlQ/exec';

// ───────── PRODUCTS ─────────
function getProducts() {
  try { return JSON.parse(localStorage.getItem('sj_products') || '[]'); }
  catch { return []; }
}

function saveProducts(products) {
  localStorage.setItem('sj_products', JSON.stringify(products));
}

function addProduct(product) {
  const products = getProducts();
  product.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  product.createdAt = new Date().toISOString();
  products.push(product);
  saveProducts(products);
  syncProductToSheet(product);
  return product;
}

function updateProduct(id, updates) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
  saveProducts(products);
  return products[idx];
}

function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
}

function getTopSelling() {
  return getProducts().filter(p => p.topSelling === true);
}

// ───────── ORDERS ─────────
function getOrders() {
  try { return JSON.parse(localStorage.getItem('sj_orders') || '[]'); }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem('sj_orders', JSON.stringify(orders));
}

function addOrder(order) {
  const orders = getOrders();
  order.id = 'ORD-' + Date.now();
  order.createdAt = new Date().toISOString();
  order.status = 'Pending';
  orders.push(order);
  saveOrders(orders);
  syncOrderToSheet(order);
  return order;
}

function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return;
  orders[idx].status = status;
  saveOrders(orders);
}

// ───────── CART ─────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('sj_cart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('sj_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, size, color, quantity = 1) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return { success: false, message: 'Product not found' };

  // Check stock
  const stockKey = size;
  const available = product.stock && product.stock[stockKey] !== undefined
    ? parseInt(product.stock[stockKey])
    : 0;
  if (available < quantity) return { success: false, message: 'Insufficient stock' };

  const cart = getCart();
  const existing = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId,
      name: product.name,
      price: getFinalPrice(product),
      image: product.images && product.images[0] ? product.images[0] : '',
      size,
      color,
      quantity,
      category: product.category
    });
  }
  saveCart(cart);
  return { success: true };
}

function removeFromCart(productId, size, color) {
  const cart = getCart().filter(i => !(i.productId === productId && i.size === size && i.color === color));
  saveCart(cart);
}

function updateCartQty(productId, size, color, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (item) { item.quantity = quantity; if (item.quantity <= 0) removeFromCart(productId, size, color); else saveCart(cart); }
}

function clearCart() {
  localStorage.removeItem('sj_cart');
  updateCartBadge();
}

function getCartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function updateCartBadge() {
  const count = getCart().reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count;
}

// ───────── HELPERS ─────────
function getFinalPrice(product) {
  const price = parseFloat(product.price) || 0;
  const discount = parseFloat(product.discount) || 0;
  return discount > 0 ? Math.round(price - (price * discount / 100)) : price;
}

function formatPrice(amount) {
  return 'Rs ' + Number(amount).toLocaleString('en-PK');
}

// ───────── GOOGLE SHEETS SYNC ─────────
async function syncProductToSheet(product) {
  if (!SHEET_URL || SHEET_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') return;
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product', data: product })
    });
  } catch (e) { console.warn('Sheet sync failed:', e); }
}

async function syncOrderToSheet(order) {
  if (!SHEET_URL || SHEET_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') return;
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', data: order })
    });
  } catch (e) { console.warn('Sheet sync failed:', e); }
}

// Init badge on load
document.addEventListener('DOMContentLoaded', updateCartBadge);
