/* ============================================================
   app.js  –  Main website logic
   ============================================================ */

// ───────── SLIDER ─────────
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dotsContainer = document.getElementById('sliderDots');
let sliderInterval;

function initSlider() {
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  });
  startSlider();
}

function goToSlide(n) {
  slides[currentSlide].classList.remove('active');
  document.querySelectorAll('.dot')[currentSlide].classList.remove('active');
  currentSlide = (n + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  document.querySelectorAll('.dot')[currentSlide].classList.add('active');
}

function changeSlide(dir) {
  goToSlide(currentSlide + dir);
  resetSlider();
}

function startSlider() {
  sliderInterval = setInterval(() => goToSlide(currentSlide + 1), 4500);
}

function resetSlider() {
  clearInterval(sliderInterval);
  startSlider();
}

// ───────── NAVBAR ─────────
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// Close menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// Navbar scroll shadow
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  nav.style.boxShadow = window.scrollY > 10 ? '0 2px 18px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.08)';
});

// ───────── RENDER PRODUCTS ─────────
let currentFilter = 'all';

function renderCard(product, container) {
  const finalPrice = getFinalPrice(product);
  const hasDiscount = (product.discountedAmount > 0) || (product.discount > 0);
  const discLabel = product.discountedAmount > 0
    ? `- ${formatPrice(product.discountedAmount)}`
    : (product.discount > 0 ? `${product.discount}% OFF` : '');
  const imgSrc = product.images && product.images[0] ? product.images[0] : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Crect fill=\'%23eee\' width=\'300\' height=\'300\'/%3E%3Ctext fill=\'%23aaa\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E';

  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="product-img-wrap">
      <img src="${imgSrc}" alt="${product.name}" loading="lazy" />
      ${product.topSelling ? '<span class="product-badge top">Top Selling</span>' : ''}
      ${hasDiscount ? `<span class="product-badge" style="top:${product.topSelling ? '40px' : '10px'}">${discLabel}</span>` : ''}
    </div>
    <div class="product-info">
      <div class="product-category">${catLabel(product.category)}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-price">
        <span class="price-current">${formatPrice(finalPrice)}</span>
        ${hasDiscount ? `<span class="price-original">${formatPrice(product.price)}</span>` : ''}
      </div>
      <button class="btn-add-cart" onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
        <i class="fas fa-cart-plus"></i> Add to Cart
      </button>
    </div>
  `;
  card.addEventListener('click', () => {
    window.location.href = `product.html?id=${product.id}`;
  });
  container.appendChild(card);
}

function catLabel(cat) {
  const map = { tshirt: 'T-Shirt', jeans: 'Jeans', hoddie: 'Hoodie' };
  return map[cat] || cat;
}

function renderTopSelling() {
  const grid = document.getElementById('topSellingGrid');
  const msg = document.getElementById('topSellingMsg');
  if (!grid) return;
  grid.innerHTML = '';
  const products = getTopSelling();
  if (products.length === 0) {
    if (msg) msg.style.display = 'flex';
    return;
  }
  if (msg) msg.style.display = 'none';
  products.forEach(p => renderCard(p, grid));
}

function filterProducts(cat, btn) {
  currentFilter = cat;
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Scroll to products section if triggered from category card
  const section = document.getElementById('products');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderAllProducts();
}

function renderAllProducts() {
  const grid = document.getElementById('productsGrid');
  const msg = document.getElementById('noProductsMsg');
  if (!grid) return;
  grid.innerHTML = '';

  let products = getProducts();
  if (currentFilter !== 'all') products = products.filter(p => p.category === currentFilter);

  if (products.length === 0) {
    if (msg) msg.style.display = 'flex';
    return;
  }
  if (msg) msg.style.display = 'none';
  products.forEach(p => renderCard(p, grid));
}

// ───────── QUICK ADD TO CART ─────────
function quickAddToCart(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  // Check if product has stock
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const availableSize = sizes.find(s => product.stock && parseInt(product.stock[s]) > 0);

  if (!availableSize) {
    showToast('Out of stock!');
    return;
  }

  // Redirect to product page for size/color selection
  window.location.href = `product.html?id=${productId}&action=addcart`;
}

// ───────── TOAST ─────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ───────── INIT ─────────
document.addEventListener('DOMContentLoaded', () => {
  initSlider();
  renderTopSelling();
  renderAllProducts();
  updateCartBadge();

  // Re-render when fresh Sheets data arrives
  DataEvents.on('productsLoaded', () => {
    renderTopSelling();
    renderAllProducts();
  });
});
