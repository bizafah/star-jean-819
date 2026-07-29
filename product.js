/* ============================================================
   product.js  –  Product detail page logic
   ============================================================ */

// Sizes for T-Shirts and Hoodies
const CLOTHING_SIZES = [
  { key: 'XS',  label: 'Extra Small' },
  { key: 'S',   label: 'Small' },
  { key: 'M',   label: 'Medium' },
  { key: 'L',   label: 'Large' },
  { key: 'XL',  label: 'Extra Large' },
  { key: 'XXL', label: 'Double Extra Large' }
];

// Sizes for Jeans (waist sizes)
const JEANS_SIZES = [
  { key: '26', label: '26' },
  { key: '28', label: '28' },
  { key: '30', label: '30' },
  { key: '32', label: '32' },
  { key: '34', label: '34' },
  { key: '36', label: '36' },
  { key: '38', label: '38' },
  { key: '40', label: '40' },
  { key: '42', label: '42' },
  { key: '44', label: '44' }
];

function getSizesForCategory(category) {
  return category === 'jeans' ? JEANS_SIZES : CLOTHING_SIZES;
}

let selectedSize = null;
let selectedColor = null;
let selectedQty = 1;
let currentProduct = null;
let currentImageIndex = 0;

// ───────── INIT ─────────
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { showNotFound(); return; }

  // Render immediately from cache, then re-render when Sheets data arrives
  const renderFromId = () => {
    const products = getProducts();
    currentProduct = products.find(p => p.id === id);
    if (!currentProduct) { showNotFound(); return; }
    renderProduct(currentProduct);
    renderRelated(currentProduct);
  };

  renderFromId();

  DataEvents.on('productsLoaded', () => {
    if (currentProduct) renderFromId();
  });

  if (params.get('action') === 'addcart') {
    document.querySelector('.size-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// ───────── RENDER ─────────
function renderProduct(p) {
  document.title = p.name + ' – Star Jeans 819';
  document.getElementById('breadcrumbName').textContent = p.name;
  document.getElementById('productLoading').style.display = 'none';

  const finalPrice = getFinalPrice(p);
  const hasDiscount = (p.discountedAmount > 0) || (p.discount > 0);
  // Always show as percentage on the website
  const discPct = p.discountedAmount > 0
    ? Math.round(p.discountedAmount / p.price * 100)
    : (p.discount || 0);
  const discLabel = discPct > 0 ? `${discPct}% OFF` : '';
  const images = p.images && p.images.length > 0 ? p.images : [''];
  const colors = p.colors ? p.colors.split(',').map(c => c.trim()).filter(Boolean) : [];

  const container = document.getElementById('productPage');
  container.innerHTML = `
    <div class="product-layout">

      <!-- GALLERY -->
      <div class="product-gallery">
        <div class="main-image-wrap">
          <img src="${images[0] || ''}" alt="${p.name}" id="mainImage" />
        </div>
        <div class="thumb-strip" id="thumbStrip">
          ${images.map((img, i) => `
            <div class="thumb ${i === 0 ? 'active' : ''}" onclick="switchImage(${i})">
              <img src="${img}" alt="Image ${i + 1}" loading="lazy" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- INFO -->
      <div class="product-detail-info">
        <div class="pd-category">${catLabel(p.category)}</div>
        <h1 class="pd-name">${p.name}</h1>

        <div class="pd-price-row">
          <span class="pd-price">${formatPrice(finalPrice)}</span>
          ${hasDiscount ? `<span class="pd-original">${formatPrice(p.price)}</span>` : ''}
          ${hasDiscount ? `<span class="pd-discount">${discLabel}</span>` : ''}
        </div>

        <div class="pd-divider"></div>

        ${colors.length > 0 ? `
        <div>
          <div class="pd-label">Color: <span id="selectedColorLabel" style="font-weight:400;color:#666;">${colors[0] || ''}</span></div>
          <div class="color-options" id="colorOptions">
            ${colors.map((c, i) => `
              <span class="color-chip-text ${i === 0 ? 'selected' : ''}"
                onclick="selectColor('${c}', this)">${c}</span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div>
          <div class="pd-label">Size: <span id="selectedSizeLabel" style="font-weight:400;color:#666;">Select a size</span></div>
          <div class="size-options" id="sizeOptions">
            ${getSizesForCategory(p.category).map(s => {
              const stock = p.stock && p.stock[s.key] !== undefined ? parseInt(p.stock[s.key]) : 0;
              return `<button class="size-btn ${stock === 0 ? 'out-of-stock' : ''}"
                data-size="${s.key}" data-stock="${stock}"
                onclick="selectSize('${s.key}', '${s.label}', ${stock}, this)"
                ${stock === 0 ? 'disabled' : ''}
                title="${s.label} – ${stock > 0 ? stock + ' in stock' : 'Out of stock'}"
              >${s.key}</button>`;
            }).join('')}
          </div>
          <div class="size-stock-note" id="stockNote"></div>
        </div>

        <div>
          <div class="pd-label">Quantity</div>
          <div class="qty-row">
            <div class="qty-ctrl">
              <button onclick="changeQty(-1)"><i class="fas fa-minus"></i></button>
              <span id="qtyDisplay">1</span>
              <button onclick="changeQty(1)"><i class="fas fa-plus"></i></button>
            </div>
            <span class="qty-max-note" id="qtyNote"></span>
          </div>
        </div>

        <div class="action-btns">
          <button class="btn-add-to-cart" onclick="handleAddToCart()">
            <i class="fas fa-shopping-cart"></i> Add to Cart
          </button>
          <button class="btn-buy-now" onclick="handleBuyNow()">
            <i class="fas fa-bolt"></i> Buy Now
          </button>
        </div>

        ${p.description ? `
        <div class="pd-divider"></div>
        <div>
          <div class="pd-desc-title">Product Description</div>
          <div class="pd-desc">${p.description}</div>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // Set defaults
  if (colors.length > 0) selectedColor = colors[0];
  selectedSize = null;
  selectedQty = 1;
}

// ───────── IMAGE GALLERY ─────────
function switchImage(index) {
  const mainImg = document.getElementById('mainImage');
  const thumbs = document.querySelectorAll('.thumb');
  const p = currentProduct;
  if (!p || !p.images || !p.images[index]) return;

  mainImg.style.opacity = '0';
  setTimeout(() => {
    mainImg.src = p.images[index];
    mainImg.style.opacity = '1';
  }, 150);

  thumbs.forEach(t => t.classList.remove('active'));
  if (thumbs[index]) thumbs[index].classList.add('active');
  currentImageIndex = index;
}

// ───────── COLOR SELECTION ─────────
function selectColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.color-chip-text, .color-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const label = document.getElementById('selectedColorLabel');
  if (label) label.textContent = color;
}

// ───────── SIZE SELECTION ─────────
function selectSize(key, label, stock, el) {
  if (stock === 0) return;
  selectedSize = key;
  selectedQty = 1;
  document.getElementById('qtyDisplay').textContent = 1;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const sizeLabel = document.getElementById('selectedSizeLabel');
  if (sizeLabel) sizeLabel.textContent = label;
  const note = document.getElementById('stockNote');
  if (note) note.textContent = stock <= 5 ? `Only ${stock} left!` : `${stock} in stock`;
  const qtyNote = document.getElementById('qtyNote');
  if (qtyNote) qtyNote.textContent = `Max: ${stock}`;
}

// ───────── QUANTITY ─────────
function changeQty(delta) {
  if (!selectedSize) { showToast('Please select a size first'); return; }
  const btn = document.querySelector(`.size-btn[data-size="${selectedSize}"]`);
  const maxStock = btn ? parseInt(btn.dataset.stock) : 1;
  selectedQty = Math.max(1, Math.min(selectedQty + delta, maxStock));
  document.getElementById('qtyDisplay').textContent = selectedQty;
}

// ───────── ADD TO CART ─────────
function handleAddToCart() {
  if (!selectedSize) { showToast('Please select a size'); return; }
  if (!selectedColor && currentProduct.colors) { showToast('Please select a color'); return; }
  const result = addToCart(currentProduct.id, selectedSize, selectedColor || 'Default', selectedQty);
  if (result.success) {
    showToast('Added to cart!');
    updateCartBadge();
  } else {
    showToast(result.message || 'Could not add to cart');
  }
}

function handleBuyNow() {
  if (!selectedSize) { showToast('Please select a size'); return; }
  if (!selectedColor && currentProduct.colors) { showToast('Please select a color'); return; }
  const result = addToCart(currentProduct.id, selectedSize, selectedColor || 'Default', selectedQty);
  if (result.success) {
    window.location.href = 'cart.html';
  } else {
    showToast(result.message || 'Could not add to cart');
  }
}

// ───────── RELATED PRODUCTS ─────────
function renderRelated(product) {
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  if (!section || !grid) return;

  const related = getProducts()
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  if (related.length === 0) return;
  section.style.display = 'block';
  related.forEach(p => {
    const finalPrice = getFinalPrice(p);
    const imgSrc = p.images && p.images[0] ? p.images[0] : '';
    const relDiscPct = p.discountedAmount > 0
      ? Math.round(p.discountedAmount / p.price * 100)
      : (p.discount || 0);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${imgSrc}" alt="${p.name}" loading="lazy" />
        ${relDiscPct > 0 ? `<span class="product-badge">${relDiscPct}% OFF</span>` : ''}
      </div>
      <div class="product-info">
        <div class="product-category">${catLabel(p.category)}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">
          <span class="price-current">${formatPrice(finalPrice)}</span>
          ${relDiscPct > 0 ? `<span class="price-original">${formatPrice(p.price)}</span>` : ''}
        </div>
        <button class="btn-add-cart" onclick="event.stopPropagation()">View Product</button>
      </div>
    `;
    card.addEventListener('click', () => { window.location.href = `product.html?id=${p.id}`; });
    grid.appendChild(card);
  });
}

// ───────── HELPERS ─────────
function catLabel(cat) {
  const map = { tshirt: 'T-Shirt', jeans: 'Jeans', hoddie: 'Hoodie' };
  return map[cat] || cat;
}

function showNotFound() {
  document.getElementById('productLoading').style.display = 'none';
  document.getElementById('productNotFound').style.display = 'flex';
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}
