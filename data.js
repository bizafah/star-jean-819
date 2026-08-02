/* ============================================================
   data.js  –  Centralized data layer  (v2)

   Google Sheets = single source of truth for ALL devices.
   localStorage  = read-cache only (speeds up page loads,
                   works offline as fallback).

   Flow:
     • On every page load → fetch fresh data from Sheets
       and update the local cache.
     • All writes go DIRECTLY to Sheets, then refresh cache.
     • Any device reading the site always gets Sheets data.
   ============================================================ */

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzUvdDfGRKB3_aI9eJuu9xJQ_UUXphklfQcDhNWV6_CAfklH4j4hi0AUeOQUw3KKzNwlQ/exec';

// ── tiny event bus so pages can react when data arrives ──────
const DataEvents = {
  _cbs: {},
  on(ev, cb)   { (this._cbs[ev] = this._cbs[ev] || []).push(cb); },
  emit(ev, d)  { (this._cbs[ev] || []).forEach(cb => cb(d)); }
};

// ═══════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════

function getProducts() {
  try { return JSON.parse(localStorage.getItem('sj_products') || '[]'); }
  catch { return []; }
}

function _saveProductsCache(products) {
  localStorage.setItem('sj_products', JSON.stringify(products));
}

/** Fetch fresh products from Sheets → update cache → return array */
async function fetchProducts() {
  if (!_sheetReady()) return getProducts();
  try {
    const res  = await fetch(`${SHEET_URL}?action=getProducts`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      // Images are now URLs stored in Sheets — no local merging needed.
      // Every device gets the same images from the CDN.
      _saveProductsCache(json.data);
      DataEvents.emit('productsLoaded', json.data);
      return json.data;
    }
  } catch (e) { console.warn('fetchProducts failed, using cache:', e); }
  return getProducts();
}

function getTopSelling() {
  return getProducts().filter(p => p.topSelling === true);
}

/** Add product: save to cache + POST full product (with image URLs) to Sheets */
function addProduct(product) {
  product.id        = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  product.createdAt = new Date().toISOString();
  const products = getProducts();
  products.push(product);
  _saveProductsCache(products);
  _post({ type: 'product', data: product }); // background sync
  return product;
}

/** Update product: update cache + POST full product (with image URLs) to Sheets */
function updateProduct(id, updates) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
  _saveProductsCache(products);
  _post({ type: 'product', data: products[idx] }); // background sync
  return products[idx];
}

/** Delete product: remove from cache + background sync to Sheets */
function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  _saveProductsCache(products);
  _post({ type: 'deleteProduct', data: { id } }); // background sync
}

// ═══════════════════════════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════════════════════════

function getOrders() {
  try { return JSON.parse(localStorage.getItem('sj_orders') || '[]'); }
  catch { return []; }
}

function _saveOrdersCache(orders) {
  localStorage.setItem('sj_orders', JSON.stringify(orders));
}

/** Fetch fresh orders from Sheets → update cache → return array */
async function fetchOrders() {
  if (!_sheetReady()) return getOrders();
  try {
    const res  = await fetch(`${SHEET_URL}?action=getOrders`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      _saveOrdersCache(json.data);
      DataEvents.emit('ordersLoaded', json.data);
      return json.data;
    }
  } catch (e) { console.warn('fetchOrders failed, using cache:', e); }
  return getOrders();
}

/** Place order: save to cache, deduct stock, background sync to Sheets */
async function addOrder(order) {
  order.id        = 'ORD-' + Date.now();
  order.createdAt = new Date().toISOString();
  order.status    = 'Pending';

  const orders = getOrders();
  orders.push(order);
  _saveOrdersCache(orders);

  // Deduct stock from local cache immediately
  deductStock(order.items);

  // Both Sheets calls go in the background — cart page doesn't need to wait
  _post({ type: 'order', data: order });
  _post({ type: 'updateStock', data: { items: order.items } });

  return order;
}

/** Update order status: update cache + background sync to Sheets */
function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx    = orders.findIndex(o => o.id === id);
  if (idx !== -1) {
    orders[idx].status = status;
    _saveOrdersCache(orders);
  }
  _post({ type: 'updateOrderStatus', data: { id, status } }); // background sync
}

// ═══════════════════════════════════════════════════════════
//  STOCK DEDUCTION
// ═══════════════════════════════════════════════════════════

/** Deduct stock from local cache immediately + background sync to Sheets */
function deductStock(items) {
  if (!items || items.length === 0) return;

  const products = getProducts();
  items.forEach(item => {
    const p = products.find(pr => pr.id === item.productId);
    if (!p) return;
    if (typeof p.stock === 'string') {
      try { p.stock = JSON.parse(p.stock); } catch { p.stock = {}; }
    }
    if (!p.stock) p.stock = {};
    const cur = parseInt(p.stock[item.size]) || 0;
    p.stock[item.size] = Math.max(0, cur - item.quantity);
  });
  _saveProductsCache(products);

  _post({ type: 'updateStock', data: { items } }); // background sync
}

// ═══════════════════════════════════════════════════════════
//  CART  (device-local – intentional)
// ═══════════════════════════════════════════════════════════

function getCart() {
  try { return JSON.parse(localStorage.getItem('sj_cart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('sj_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, size, color, quantity = 1) {
  const products  = getProducts();
  const product   = products.find(p => p.id === productId);
  if (!product) return { success: false, message: 'Product not found' };

  // stock may arrive as a JSON string from Sheets in rare cases — parse it
  const stock = typeof product.stock === 'string'
    ? (() => { try { return JSON.parse(product.stock); } catch { return {}; } })()
    : (product.stock || {});

  // If the size key exists and is explicitly 0 → out of stock.
  // If the key is missing entirely → stock unknown, allow the purchase.
  const stockValue = stock[size];
  const available  = stockValue !== undefined && stockValue !== ''
    ? parseInt(stockValue)
    : null; // null = unknown

  if (available !== null && available < quantity) {
    return { success: false, message: 'Insufficient stock' };
  }

  const cart     = getCart();
  const existing = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId,
      name:     product.name,
      price:    getFinalPrice(product),
      image:    product.images && product.images[0] ? product.images[0] : '',
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
  saveCart(getCart().filter(i => !(i.productId === productId && i.size === size && i.color === color)));
}

function updateCartQty(productId, size, color, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (!item) return;
  item.quantity = quantity;
  if (item.quantity <= 0) removeFromCart(productId, size, color);
  else saveCart(cart);
}

function clearCart() {
  localStorage.removeItem('sj_cart');
  updateCartBadge();
}

function getCartTotal() {
  return getCart().reduce((s, i) => s + i.price * i.quantity, 0);
}

function updateCartBadge() {
  const count = getCart().reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count;
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Final price = price – discountedAmount (Rs).
 * discountedAmount replaces the old percentage discount.
 * Legacy products that still have a `discount` % field are
 * handled gracefully for backward compatibility.
 */
function getFinalPrice(product) {
  const price = parseFloat(product.price) || 0;

  // New field: discountedAmount in Rs
  if (product.discountedAmount !== undefined && product.discountedAmount !== null) {
    const off = parseFloat(product.discountedAmount) || 0;
    return off > 0 ? Math.round(price - off) : price;
  }

  // Legacy fallback: discount %
  const pct = parseFloat(product.discount) || 0;
  return pct > 0 ? Math.round(price - (price * pct / 100)) : price;
}

function formatPrice(amount) {
  return 'Rs ' + Number(amount).toLocaleString('en-PK');
}

function _sheetReady() {
  return SHEET_URL && SHEET_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
}

// ── Generic POST to Apps Script – fire and forget ────────────
// We never need to wait for the Sheets response. Data is already
// saved to localStorage instantly. Sheets syncs in the background.
function _post(payload) {
  if (!_sheetReady()) return;
  fetch(SHEET_URL, {
    method:  'POST',
    mode:    'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  }).catch(e => console.warn('Sheet sync failed (non-blocking):', e));
  // intentionally no return / no await — caller does NOT need to wait
}

// ── Boot: fetch fresh data on every page load ────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();

  if (_sheetReady()) {
    // Fetch products (and orders if on admin page)
    fetchProducts().then(() => {
      // Re-render if the page has already set up a render hook
      DataEvents.emit('ready', null);
    });
  }
});
