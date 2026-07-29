/* ============================================================
   admin.js  –  Admin panel logic  (v3 – jeans sizes)
   Password: 1234
   ============================================================ */

const ADMIN_PASSWORD = '1234';

// ── Size definitions (mirrors product.js) ───────────────────
const ADMIN_CLOTHING_SIZES = [
  { key: 'XS',  label: 'Extra Small (XS)' },
  { key: 'S',   label: 'Small (S)' },
  { key: 'M',   label: 'Medium (M)' },
  { key: 'L',   label: 'Large (L)' },
  { key: 'XL',  label: 'Extra Large (XL)' },
  { key: 'XXL', label: 'Double Extra Large (XXL)' }
];
const ADMIN_JEANS_SIZES = [
  '26','28','30','32','34','36','38','40','42','44'
].map(s => ({ key: s, label: s }));

function getAdminSizes(category) {
  return category === 'jeans' ? ADMIN_JEANS_SIZES : ADMIN_CLOTHING_SIZES;
}

/**
 * Render the stock input grid for the correct category.
 * prefix = 'add' | 'edit'
 * existingStock = optional object { key: qty } to pre-fill values
 */
function renderStockGrid(prefix, category, existingStock = {}) {
  const gridId   = prefix + 'StockGrid';
  const grid     = document.getElementById(gridId);
  if (!grid) return;

  const sizes = getAdminSizes(category);
  if (!category || sizes.length === 0) {
    grid.innerHTML = '<div class="stock-hint">Select a category above to see size options</div>';
    return;
  }

  grid.innerHTML = sizes.map(s => `
    <div class="stock-item">
      <span>${s.label}</span>
      <input type="number" id="${prefix}Stock_${s.key}"
             min="0" value="${existingStock[s.key] ?? 0}" placeholder="0" />
    </div>
  `).join('');
}

/** Read stock values from the currently rendered grid */
function readStockFromGrid(prefix, category) {
  const sizes = getAdminSizes(category);
  const stock = {};
  sizes.forEach(s => {
    const el = document.getElementById(`${prefix}Stock_${s.key}`);
    stock[s.key] = el ? (parseInt(el.value) || 0) : 0;
  });
  return stock;
}

// ───────── AUTH ─────────
function adminLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById('adminPwd').value;
  if (pwd === ADMIN_PASSWORD) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'flex';
    sessionStorage.setItem('sj_admin', '1');
    initAdmin();
  } else {
    const err = document.getElementById('loginError');
    err.style.display = 'block';
    document.getElementById('adminPwd').value = '';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

function adminLogout() {
  sessionStorage.removeItem('sj_admin');
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPwd').value = '';
}

function togglePwd() {
  const input = document.getElementById('adminPwd');
  const icon  = document.getElementById('eyeIcon');
  input.type  = input.type === 'password' ? 'text' : 'password';
  icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

// ───────── INIT ─────────
async function initAdmin() {
  showLoadingOverlay(true);
  // Fetch fresh data from Sheets so admin always sees live data
  await fetchProducts();
  await fetchOrders();
  showLoadingOverlay(false);
  renderUpdateList();
  renderOrders();
  updatePendingBadge();
}

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sj_admin') === '1') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'flex';
    initAdmin();
  }
});

// Loading overlay while fetching
function showLoadingOverlay(show) {
  let el = document.getElementById('adminLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.8);z-index:9000;display:flex;align-items:center;justify-content:center;gap:12px;font-size:1rem;color:#1a1a2e;font-weight:600;';
    el.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i> Loading latest data...';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ───────── TABS ─────────
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.classList.add('active');
  document.getElementById('adminSidebar').classList.remove('open');

  if (tabId === 'updateProduct') renderUpdateList();
  if (tabId === 'viewOrders') {
    fetchOrders().then(() => renderOrders());
  }
}

function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
}

// ───────── IMAGE HANDLING ─────────
const imageSets = { addImagePreview: [], editImagePreview: [] };

function previewImages(input, previewId, append = false) {
  const files     = Array.from(input.files);
  const maxImages = 12;
  if (!append) imageSets[previewId] = [];

  const remaining = maxImages - imageSets[previewId].length;
  const toProcess = files.slice(0, remaining);
  if (files.length > remaining) showToast(`Max ${maxImages} images. ${files.length - remaining} skipped.`);

  toProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      imageSets[previewId].push(ev.target.result);
      renderImagePreviews(previewId);
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderImagePreviews(previewId) {
  const container = document.getElementById(previewId);
  if (!container) return;
  container.innerHTML = '';
  imageSets[previewId].forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'preview-thumb';
    div.innerHTML = `
      <img src="${src}" alt="Preview ${i + 1}" />
      <div class="remove-img" onclick="removePreviewImage('${previewId}', ${i})">
        <i class="fas fa-times"></i>
      </div>`;
    container.appendChild(div);
  });
}

function removePreviewImage(previewId, index) {
  imageSets[previewId].splice(index, 1);
  renderImagePreviews(previewId);
}

// ───────── ADD PRODUCT ─────────
async function handleAddProduct(e) {
  e.preventDefault();
  const name             = document.getElementById('addName').value.trim();
  const category         = document.getElementById('addCategory').value;
  const price            = parseFloat(document.getElementById('addPrice').value) || 0;
  const discountedAmount = parseFloat(document.getElementById('addDiscountedAmount').value) || 0;
  const colors           = document.getElementById('addColors').value.trim();
  const desc             = document.getElementById('addDescription').value.trim();
  const topSell          = document.getElementById('addTopSelling').checked;

  if (!name || !category || price <= 0) { showToast('Please fill in all required fields'); return; }
  if (discountedAmount >= price)         { showToast('Discounted amount cannot be ≥ price'); return; }

  const stock = readStockFromGrid('add', category);
  const images  = imageSets['addImagePreview'].slice(0, 12);
  const product = { name, category, price, discountedAmount, colors, description: desc, topSelling: topSell, stock, images };

  const btn = e.submitter || document.querySelector('#addProductForm .btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  await addProduct(product);

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
  showToast('Product added successfully!');
  document.getElementById('addProductForm').reset();
  imageSets['addImagePreview'] = [];
  renderImagePreviews('addImagePreview');
  renderStockGrid('add', ''); // reset grid to placeholder
}

// ───────── UPDATE PRODUCT LIST ─────────
function renderUpdateList() {
  const container = document.getElementById('updateProductList');
  if (!container) return;
  const query    = (document.getElementById('updateSearch')?.value || '').toLowerCase();
  let products   = getProducts();
  if (query) products = products.filter(p => p.name.toLowerCase().includes(query) || p.category.includes(query));

  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML = `<div class="no-products-admin"><i class="fas fa-box-open"></i><p>No products found.</p></div>`;
    return;
  }

  products.forEach(p => {
    const imgSrc = p.images && p.images[0] ? p.images[0] : '';
    const final  = getFinalPrice(p);
    const card   = document.createElement('div');
    card.className = 'update-card';
    card.onclick   = () => openEditModal(p.id);
    card.innerHTML = `
      <div class="update-card-img">
        <img src="${imgSrc}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="update-card-info">
        <div class="update-card-name">${p.name}</div>
        <div class="update-card-meta">
          <span>${catLabel(p.category)}</span>
          <span>${formatPrice(final)}</span>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

// ───────── EDIT MODAL ─────────
function openEditModal(productId) {
  const p = getProducts().find(pr => pr.id === productId);
  if (!p) return;

  document.getElementById('editProductId').value      = p.id;
  document.getElementById('editName').value            = p.name;
  document.getElementById('editCategory').value        = p.category;
  document.getElementById('editPrice').value           = p.price;
  // Support both new (discountedAmount) and legacy (discount %) fields
  document.getElementById('editDiscountedAmount').value =
    p.discountedAmount !== undefined ? p.discountedAmount
    : (p.discount ? Math.round(p.price * p.discount / 100) : 0);
  document.getElementById('editColors').value          = p.colors || '';
  document.getElementById('editDescription').value     = p.description || '';
  document.getElementById('editTopSelling').checked    = !!p.topSelling;

  // Render the correct size stock grid FIRST, then fill values
  const stock = p.stock || {};
  renderStockGrid('edit', p.category, stock);

  imageSets['editImagePreview'] = p.images ? [...p.images] : [];
  renderImagePreviews('editImagePreview');

  document.getElementById('editModalOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditModal(e) {
  if (e && e.target !== document.getElementById('editModalOverlay')) return;
  document.getElementById('editModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
  imageSets['editImagePreview'] = [];
}

// ───────── SAVE EDITED PRODUCT ─────────
async function handleUpdateProduct(e) {
  e.preventDefault();
  const id               = document.getElementById('editProductId').value;
  const name             = document.getElementById('editName').value.trim();
  const category         = document.getElementById('editCategory').value;
  const price            = parseFloat(document.getElementById('editPrice').value) || 0;
  const discountedAmount = parseFloat(document.getElementById('editDiscountedAmount').value) || 0;
  const colors           = document.getElementById('editColors').value.trim();
  const desc             = document.getElementById('editDescription').value.trim();
  const topSell          = document.getElementById('editTopSelling').checked;

  if (discountedAmount >= price && discountedAmount > 0) {
    showToast('Discounted amount cannot be ≥ price'); return;
  }

  const stock  = readStockFromGrid('edit', category);
  const images = imageSets['editImagePreview'].slice(0, 12);
  const btn    = document.querySelector('#editProductForm .btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  await updateProduct(id, { name, category, price, discountedAmount, colors, description: desc, topSelling: topSell, stock, images });

  btn.disabled  = false;
  btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';

  showToast('Product updated!');
  document.getElementById('editModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
  imageSets['editImagePreview'] = [];
  renderUpdateList();
}

// ───────── DELETE PRODUCT ─────────
async function confirmDeleteProduct() {
  const id = document.getElementById('editProductId').value;
  if (!id) return;
  if (!confirm('Delete this product? This cannot be undone.')) return;

  await deleteProduct(id);
  document.getElementById('editModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
  renderUpdateList();
  showToast('Product deleted.');
}

// ───────── ORDERS ─────────
function renderOrders() {
  const container = document.getElementById('ordersList');
  const noMsg     = document.getElementById('noOrdersMsg');
  if (!container) return;

  const filter = document.getElementById('orderStatusFilter')?.value || 'all';
  let orders   = getOrders().slice().reverse(); // newest first
  if (filter !== 'all') orders = orders.filter(o => o.status === filter);

  container.innerHTML = '';
  if (orders.length === 0) {
    noMsg.style.display = 'flex';
    return;
  }
  noMsg.style.display = 'none';

  orders.forEach(order => {
    const date        = new Date(order.createdAt).toLocaleString('en-PK');
    const card        = document.createElement('div');
    card.className    = 'order-card';
    card.innerHTML = `
      <div class="order-card-header">
        <div>
          <div class="order-id">${order.id}</div>
          <div class="order-date">${date}</div>
        </div>
        <select class="status-select status-${order.status || 'Pending'}"
                onchange="changeOrderStatus('${order.id}', this)">
          ${['Pending','Confirmed','Shipped','Delivered','Cancelled'].map(s =>
            `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
      <div class="order-customer">
        <strong>${order.customer.name}</strong>
        <p><i class="fas fa-phone fa-xs"></i> ${order.customer.phone}
           &nbsp;|&nbsp;
           <i class="fas fa-map-marker-alt fa-xs"></i> ${order.customer.address}</p>
        ${order.customer.notes ? `<p><i class="fas fa-sticky-note fa-xs"></i> ${order.customer.notes}</p>` : ''}
      </div>
      <table class="order-items-table">
        <thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${(order.items || []).map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.size}</td>
              <td>${item.color}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.subtotal || item.price * item.quantity)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="order-total-row">
        <span>Subtotal: ${formatPrice(order.subtotal)}</span>
        <span>Delivery: ${formatPrice(order.deliveryCharge)}</span>
        <strong>Total: ${formatPrice(order.total)}</strong>
      </div>`;
    container.appendChild(card);
  });

  updatePendingBadge();
}

async function changeOrderStatus(orderId, select) {
  const newStatus      = select.value;
  select.className     = 'status-select status-' + newStatus;
  await updateOrderStatus(orderId, newStatus);
  updatePendingBadge();
  showToast(`Order marked as ${newStatus}`);
}

function updatePendingBadge() {
  const pending = getOrders().filter(o => o.status === 'Pending').length;
  const badge   = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent  = pending > 0 ? pending : '';
    badge.style.display = pending > 0 ? 'inline' : 'none';
  }
}

// ───────── HELPERS ─────────
function catLabel(cat) {
  return { tshirt: 'T-Shirt', jeans: 'Jeans', hoddie: 'Hoodie' }[cat] || cat;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
