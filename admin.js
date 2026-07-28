/* ============================================================
   admin.js  –  Admin panel logic
   Password: 1234
   ============================================================ */

const ADMIN_PASSWORD = '1234';
let editingImages = []; // base64 strings for currently editing product

// ───────── AUTH ─────────
function adminLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById('adminPwd').value;
  if (pwd === ADMIN_PASSWORD) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
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
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

// ───────── INIT ─────────
function initAdmin() {
  // Auto-login if session exists
  if (sessionStorage.getItem('sj_admin') === '1') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'flex';
  }
  renderUpdateList();
  renderOrders();
  updatePendingBadge();
}

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sj_admin') === '1') initAdmin();
});

// ───────── TABS ─────────
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.classList.add('active');

  // Close mobile sidebar
  document.getElementById('adminSidebar').classList.remove('open');

  if (tabId === 'updateProduct') renderUpdateList();
  if (tabId === 'viewOrders')   renderOrders();
}

function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
}

// ───────── IMAGE HANDLING ─────────
// Stores base64 arrays per preview container
const imageSets = { addImagePreview: [], editImagePreview: [] };

function previewImages(input, previewId, append = false) {
  const files = Array.from(input.files);
  const maxImages = 12;
  if (!append) imageSets[previewId] = [];

  const remaining = maxImages - imageSets[previewId].length;
  const toProcess = files.slice(0, remaining);

  if (files.length > remaining) showToast(`Max ${maxImages} images allowed. ${files.length - remaining} skipped.`);

  toProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      imageSets[previewId].push(ev.target.result);
      renderImagePreviews(previewId);
    };
    reader.readAsDataURL(file);
  });

  input.value = ''; // reset so same file can be re-added
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
      </div>
    `;
    container.appendChild(div);
  });
}

function removePreviewImage(previewId, index) {
  imageSets[previewId].splice(index, 1);
  renderImagePreviews(previewId);
}

// ───────── ADD PRODUCT ─────────
function handleAddProduct(e) {
  e.preventDefault();
  const name     = document.getElementById('addName').value.trim();
  const category = document.getElementById('addCategory').value;
  const price    = parseFloat(document.getElementById('addPrice').value) || 0;
  const discount = parseFloat(document.getElementById('addDiscount').value) || 0;
  const colors   = document.getElementById('addColors').value.trim();
  const desc     = document.getElementById('addDescription').value.trim();
  const topSell  = document.getElementById('addTopSelling').checked;

  if (!name || !category || price <= 0) { showToast('Please fill in all required fields'); return; }

  const stock = {
    XS: parseInt(document.getElementById('stock_XS').value) || 0,
    S:  parseInt(document.getElementById('stock_S').value)  || 0,
    M:  parseInt(document.getElementById('stock_M').value)  || 0,
    L:  parseInt(document.getElementById('stock_L').value)  || 0,
    XL: parseInt(document.getElementById('stock_XL').value) || 0
  };

  const images = imageSets['addImagePreview'].slice(0, 12);

  const product = { name, category, price, discount, colors, description: desc, topSelling: topSell, stock, images };
  addProduct(product);

  showToast('Product added successfully!');
  document.getElementById('addProductForm').reset();
  imageSets['addImagePreview'] = [];
  renderImagePreviews('addImagePreview');
}

// ───────── UPDATE PRODUCT LIST ─────────
function renderUpdateList() {
  const container = document.getElementById('updateProductList');
  if (!container) return;
  const query = (document.getElementById('updateSearch')?.value || '').toLowerCase();
  let products = getProducts();
  if (query) products = products.filter(p => p.name.toLowerCase().includes(query) || p.category.includes(query));

  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML = `<div class="no-products-admin"><i class="fas fa-box-open"></i><p>No products found.</p></div>`;
    return;
  }

  products.forEach(p => {
    const imgSrc = p.images && p.images[0] ? p.images[0] : '';
    const card = document.createElement('div');
    card.className = 'update-card';
    card.onclick = () => openEditModal(p.id);
    card.innerHTML = `
      <div class="update-card-img">
        <img src="${imgSrc}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="update-card-info">
        <div class="update-card-name">${p.name}</div>
        <div class="update-card-meta">
          <span>${catLabel(p.category)}</span>
          <span>${formatPrice(getFinalPrice(p))}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ───────── EDIT MODAL ─────────
function openEditModal(productId) {
  const products = getProducts();
  const p = products.find(pr => pr.id === productId);
  if (!p) return;

  document.getElementById('editProductId').value  = p.id;
  document.getElementById('editName').value        = p.name;
  document.getElementById('editCategory').value    = p.category;
  document.getElementById('editPrice').value       = p.price;
  document.getElementById('editDiscount').value    = p.discount || 0;
  document.getElementById('editColors').value      = p.colors || '';
  document.getElementById('editDescription').value = p.description || '';
  document.getElementById('editTopSelling').checked = !!p.topSelling;

  const stock = p.stock || {};
  ['XS','S','M','L','XL'].forEach(s => {
    document.getElementById(`editStock_${s}`).value = stock[s] || 0;
  });

  // Load existing images
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
function handleUpdateProduct(e) {
  e.preventDefault();
  const id       = document.getElementById('editProductId').value;
  const name     = document.getElementById('editName').value.trim();
  const category = document.getElementById('editCategory').value;
  const price    = parseFloat(document.getElementById('editPrice').value) || 0;
  const discount = parseFloat(document.getElementById('editDiscount').value) || 0;
  const colors   = document.getElementById('editColors').value.trim();
  const desc     = document.getElementById('editDescription').value.trim();
  const topSell  = document.getElementById('editTopSelling').checked;

  const stock = {
    XS: parseInt(document.getElementById('editStock_XS').value) || 0,
    S:  parseInt(document.getElementById('editStock_S').value)  || 0,
    M:  parseInt(document.getElementById('editStock_M').value)  || 0,
    L:  parseInt(document.getElementById('editStock_L').value)  || 0,
    XL: parseInt(document.getElementById('editStock_XL').value) || 0
  };

  const images = imageSets['editImagePreview'].slice(0, 12);
  updateProduct(id, { name, category, price, discount, colors, description: desc, topSelling: topSell, stock, images });

  showToast('Product updated!');
  document.getElementById('editModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
  imageSets['editImagePreview'] = [];
  renderUpdateList();
}

// ───────── DELETE PRODUCT ─────────
function confirmDeleteProduct() {
  const id = document.getElementById('editProductId').value;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
  deleteProduct(id);
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

  const filter   = document.getElementById('orderStatusFilter')?.value || 'all';
  let orders = getOrders().slice().reverse(); // newest first
  if (filter !== 'all') orders = orders.filter(o => o.status === filter);

  container.innerHTML = '';
  if (orders.length === 0) {
    noMsg.style.display = 'flex';
    return;
  }
  noMsg.style.display = 'none';

  orders.forEach(order => {
    const date = new Date(order.createdAt).toLocaleString('en-PK');
    const statusClass = 'status-' + (order.status || 'Pending');
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div class="order-card-header">
        <div>
          <div class="order-id">${order.id}</div>
          <div class="order-date">${date}</div>
        </div>
        <select class="status-select ${statusClass}" onchange="changeOrderStatus('${order.id}', this)">
          ${['Pending','Confirmed','Shipped','Delivered','Cancelled'].map(s =>
            `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
      <div class="order-customer">
        <strong>${order.customer.name}</strong>
        <p><i class="fas fa-phone fa-xs"></i> ${order.customer.phone} &nbsp;|&nbsp; <i class="fas fa-map-marker-alt fa-xs"></i> ${order.customer.address}</p>
        ${order.customer.notes ? `<p><i class="fas fa-sticky-note fa-xs"></i> ${order.customer.notes}</p>` : ''}
      </div>
      <table class="order-items-table">
        <thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.size}</td>
              <td>${item.color}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="order-total-row">
        <span>Subtotal: ${formatPrice(order.subtotal)}</span>
        <span>Delivery: ${formatPrice(order.deliveryCharge)}</span>
        <strong>Total: ${formatPrice(order.total)}</strong>
      </div>
    `;
    container.appendChild(card);
  });

  updatePendingBadge();
}

function changeOrderStatus(orderId, select) {
  const newStatus = select.value;
  // Update class for color
  select.className = 'status-select status-' + newStatus;
  updateOrderStatus(orderId, newStatus);
  updatePendingBadge();
  showToast(`Order marked as ${newStatus}`);
}

function updatePendingBadge() {
  const pending = getOrders().filter(o => o.status === 'Pending').length;
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent = pending > 0 ? pending : '';
    badge.style.display = pending > 0 ? 'inline' : 'none';
  }
}

// ───────── HELPERS ─────────
function catLabel(cat) {
  const map = { tshirt: 'T-Shirt', jeans: 'Jeans', hoddie: 'Hoodie' };
  return map[cat] || cat;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
