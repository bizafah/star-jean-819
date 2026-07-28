/* ============================================================
   cart.js  –  Cart page logic
   Delivery charge: Rs 350 (fixed)
   ============================================================ */

const DELIVERY_CHARGE = 350;

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  renderCartPage();
});

// ───────── RENDER CART PAGE ─────────
function renderCartPage() {
  const cart = getCart();
  const emptyEl   = document.getElementById('cartEmpty');
  const layoutEl  = document.getElementById('cartLayout');

  if (cart.length === 0) {
    emptyEl.style.display  = 'flex';
    layoutEl.style.display = 'none';
    return;
  }

  emptyEl.style.display  = 'none';
  layoutEl.style.display = 'grid';
  renderCartItems(cart);
  renderSummary(cart);
}

// ───────── CART ITEMS ─────────
function renderCartItems(cart) {
  const list = document.getElementById('cartItemsList');
  list.innerHTML = '';

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    const imgSrc = item.image || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'88\' height=\'88\'%3E%3Crect fill=\'%23eee\' width=\'88\' height=\'88\'/%3E%3C/svg%3E';
    const key = `${item.productId}__${item.size}__${item.color}`;

    const el = document.createElement('div');
    el.className = 'cart-item';
    el.dataset.key = key;
    el.innerHTML = `
      <div class="cart-item-img">
        <img src="${imgSrc}" alt="${item.name}" />
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Size: ${item.size} &nbsp;|&nbsp; Color: ${item.color}</div>
        <div class="cart-item-price">${formatPrice(item.price)} each</div>
      </div>
      <div class="cart-item-actions">
        <div class="cart-item-subtotal">${formatPrice(itemTotal)}</div>
        <div class="cart-qty-ctrl">
          <button onclick="changeItemQty('${item.productId}','${item.size}','${item.color}',-1)">
            <i class="fas fa-minus"></i>
          </button>
          <span>${item.quantity}</span>
          <button onclick="changeItemQty('${item.productId}','${item.size}','${item.color}',1)">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <button class="btn-remove-item" onclick="removeItem('${item.productId}','${item.size}','${item.color}')" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    list.appendChild(el);
  });
}

// ───────── SUMMARY ─────────
function renderSummary(cart) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total    = subtotal + DELIVERY_CHARGE;
  document.getElementById('summarySubtotal').textContent = formatPrice(subtotal);
  document.getElementById('summaryTotal').textContent    = formatPrice(total);
}

// ───────── QUANTITY CHANGE ─────────
function changeItemQty(productId, size, color, delta) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (!item) return;

  // Check stock limit when increasing
  if (delta > 0) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    const maxStock = product && product.stock && product.stock[size] !== undefined
      ? parseInt(product.stock[size]) : 999;
    if (item.quantity >= maxStock) { showToast('Maximum stock reached'); return; }
  }

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId, size, color);
  } else {
    saveCart(cart);
  }
  renderCartPage();
}

// ───────── REMOVE ITEM ─────────
function removeItem(productId, size, color) {
  removeFromCart(productId, size, color);
  renderCartPage();
  showToast('Item removed');
}

// ───────── SUBMIT ORDER ─────────
async function submitOrder(e) {
  e.preventDefault();
  const cart = getCart();
  if (cart.length === 0) { showToast('Your cart is empty'); return; }

  const name    = document.getElementById('custName').value.trim();
  const phone   = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const notes   = document.getElementById('custNotes').value.trim();

  if (!name || !phone || !address) { showToast('Please fill all required fields'); return; }

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing order...';

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total    = subtotal + DELIVERY_CHARGE;

  const order = {
    customer: { name, phone, address, notes },
    items: cart.map(i => ({
      productId: i.productId,
      name:      i.name,
      size:      i.size,
      color:     i.color,
      price:     i.price,
      quantity:  i.quantity,
      subtotal:  i.price * i.quantity
    })),
    subtotal,
    deliveryCharge: DELIVERY_CHARGE,
    total,
    paymentMethod: 'Cash on Delivery'
  };

  // Place order (addOrder now auto-deducts stock in Sheets + local cache)
  try {
    const savedOrder = await addOrder(order);
    clearCart();
    showSuccessModal(savedOrder);
  } catch (err) {
    console.error('Order failed:', err);
    showToast('Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
  }
}

// ───────── SUCCESS MODAL ─────────
function showSuccessModal(order) {
  const modal   = document.getElementById('successModal');
  const msgEl   = document.getElementById('successMsg');
  const idEl    = document.getElementById('modalOrderId');

  msgEl.textContent = `Thank you, ${order.customer.name}! Your order has been placed. We'll call you at ${order.customer.phone} to confirm delivery.`;
  idEl.textContent  = `Order ID: ${order.id}  |  Total: ${formatPrice(order.total)} (incl. Rs 350 delivery)`;
  modal.style.display = 'flex';
  document.getElementById('cartLayout').style.display = 'none';
  updateCartBadge();
}

// ───────── HELPERS ─────────
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
