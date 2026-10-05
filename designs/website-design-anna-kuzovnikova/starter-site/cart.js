/**
 * ChiActive Demonstration Shopping Cart
 * Fully client-side using localStorage so items & promo codes persist across page views.
 */

(function () {
  const STORAGE_KEY = 'chiactive_cart_items';
  const PROMO_KEY = 'chiactive_applied_promo';

  // Available Promo Codes
  const PROMO_CODES = {
    'STUDENT15': { discount: 0.15, label: '15% Student Discount (.edu)' },
    'WINDYCITY': { discount: 0.15, label: '15% Chicago Local Perk' },
    'CHIACTIVE': { discount: 0.20, label: '20% Campus Launch VIP' }
  };

  // Helper to get cart from localStorage
  function getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading cart from localStorage', e);
      return [];
    }
  }

  // Helper to save cart to localStorage
  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      updateCartBadge();
      renderCartDrawer();
    } catch (e) {
      console.error('Error saving cart to localStorage', e);
    }
  }

  // Promo code helpers
  function getAppliedPromo() {
    try {
      const code = localStorage.getItem(PROMO_KEY);
      if (code && PROMO_CODES[code.toUpperCase()]) {
        return { code: code.toUpperCase(), ...PROMO_CODES[code.toUpperCase()] };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function saveAppliedPromo(code) {
    if (code) {
      localStorage.setItem(PROMO_KEY, code.toUpperCase());
    } else {
      localStorage.removeItem(PROMO_KEY);
    }
    renderCartDrawer();
  }

  // Update badge counter in header
  function updateCartBadge() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badges = document.querySelectorAll('.cart-badge, #cart-count');
    badges.forEach(badge => {
      badge.textContent = totalCount;
      badge.style.display = 'inline-block';
    });
  }

  // Show a brief toast notification
  function showToast(message, isSuccess = true) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = isSuccess ? 'var(--primary)' : 'var(--accent-red)';
    toast.innerHTML = `<span>${isSuccess ? '✓' : 'ℹ'}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Add item to cart
  window.addToCart = function (product) {
    const cart = getCart();
    const existing = cart.find(item => item.id === product.id);

    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.image,
        quantity: 1
      });
    }

    saveCart(cart);
    showToast(`Added <strong>${product.name}</strong> to your bag!`);
    openCartDrawer();
  };

  // Change quantity
  window.changeQty = function (id, delta) {
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.quantity = (item.quantity || 1) + delta;
    if (item.quantity <= 0) {
      window.removeFromCart(id);
      return;
    }

    saveCart(cart);
  };

  // Remove item
  window.removeFromCart = function (id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
  };

  // Open & Close Drawer
  window.openCartDrawer = function () {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
      renderCartDrawer();
      drawer.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeCartDrawer = function () {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Promo code actions
  window.applyPromoCode = function () {
    const input = document.getElementById('cart-promo-input');
    const msgEl = document.getElementById('cart-promo-msg');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
      if (msgEl) {
        msgEl.textContent = 'Please enter a promo code.';
        msgEl.className = 'promo-msg error';
      }
      return;
    }

    if (PROMO_CODES[code]) {
      saveAppliedPromo(code);
      input.value = '';
      if (msgEl) {
        msgEl.textContent = `Applied ${code}! (${(PROMO_CODES[code].discount * 100)}% off)`;
        msgEl.className = 'promo-msg success';
      }
      showToast(`🎉 Applied code <strong>${code}</strong>: ${PROMO_CODES[code].label}!`);
    } else {
      if (msgEl) {
        msgEl.innerHTML = `Invalid code. Tip: Try <strong>STUDENT15</strong> for 15% off!`;
        msgEl.className = 'promo-msg error';
      }
    }
  };

  window.removePromoCode = function () {
    saveAppliedPromo(null);
    showToast(`Removed promo code.`, false);
  };

  // Render drawer contents
  function renderCartDrawer() {
    const itemsContainer = document.getElementById('cart-drawer-items');
    const summaryContainer = document.getElementById('cart-drawer-summary');
    if (!itemsContainer || !summaryContainer) return;

    const cart = getCart();
    const appliedPromo = getAppliedPromo();

    if (cart.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🎒</div>
          <h4>Your ChiActive bag is empty</h4>
          <p>Get geared up for the Chicago season ahead!</p>
        </div>
      `;
      summaryContainer.innerHTML = `
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span>$0.00</span>
        </div>
      `;
      return;
    }

    let subtotal = 0;
    let html = '';

    cart.forEach(item => {
      const itemTotal = item.price * (item.quantity || 1);
      subtotal += itemTotal;
      html += `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='images/logo-v1.png'">
          <div>
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            <div class="cart-item-controls">
              <button class="qty-btn" type="button" onclick="changeQty('${item.id}', -1)" aria-label="Decrease quantity">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" type="button" onclick="changeQty('${item.id}', 1)" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="remove-item-btn" type="button" onclick="removeFromCart('${item.id}')" title="Remove item" aria-label="Remove item">✕</button>
        </div>
      `;
    });

    itemsContainer.innerHTML = html;

    // Calculate Discounts & Totals
    let discountAmount = 0;
    let total = subtotal;

    if (appliedPromo) {
      discountAmount = subtotal * appliedPromo.discount;
      total = Math.max(0, subtotal - discountAmount);
    }

    let summaryHtml = `
      <!-- Promo Input Section -->
      <div class="promo-box">
        <div class="promo-input-row">
          <input type="text" id="cart-promo-input" placeholder="Promo code (e.g. STUDENT15)" autocomplete="off">
          <button type="button" onclick="applyPromoCode()">Apply</button>
        </div>
        <div id="cart-promo-msg" class="promo-msg">
          ${appliedPromo ? `
            <div class="promo-tag">
              <span>🎟️ ${appliedPromo.code} (-${(appliedPromo.discount * 100)}%)</span>
              <button type="button" onclick="removePromoCode()" title="Remove promo" aria-label="Remove promo">&times;</button>
            </div>
          ` : '💡 Try: <strong>STUDENT15</strong> or <strong>WINDYCITY</strong>'}
        </div>
      </div>

      <!-- Pricing Breakdown -->
      <div class="cart-subtotal" style="font-size:0.95rem; margin-bottom:4px; font-weight:600; color:var(--text);">
        <span>Subtotal</span>
        <span>$${subtotal.toFixed(2)}</span>
      </div>
    `;

    if (appliedPromo) {
      summaryHtml += `
        <div class="cart-discount-row">
          <span>Discount (${appliedPromo.code})</span>
          <span>-$${discountAmount.toFixed(2)}</span>
        </div>
      `;
    }

    summaryHtml += `
      <div class="cart-total-row">
        <span>Estimated Total</span>
        <span style="color:var(--primary);">$${total.toFixed(2)}</span>
      </div>
    `;

    summaryContainer.innerHTML = summaryHtml;

    // Update drawer header count
    const countEl = document.getElementById('cart-drawer-count');
    if (countEl) {
      countEl.textContent = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
  }

  // Initialize UI on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Inject Cart Drawer HTML if not present
    if (!document.getElementById('cart-drawer')) {
      const drawerMarkup = `
        <div id="cart-overlay" class="cart-overlay" onclick="closeCartDrawer()"></div>
        <aside id="cart-drawer" class="cart-drawer" aria-labelledby="cart-title" role="dialog" aria-modal="true">
          <div class="cart-header">
            <h3 id="cart-title">Your Gear Bag (<span id="cart-drawer-count">0</span>)</h3>
            <button class="close-cart-btn" onclick="closeCartDrawer()" aria-label="Close cart">&times;</button>
          </div>
          <div id="cart-drawer-items" class="cart-items">
            <!-- items injected by JS -->
          </div>
          <div class="cart-footer">
            <div id="cart-drawer-summary">
              <!-- summary and promo injected by JS -->
            </div>
            <p class="cart-notice">⚡ Free shipping on student orders over $50 in Chicago. Demo checkout only.</p>
            <button class="btn btn-secondary checkout-btn" type="button" onclick="alert('Demo store checkout: Your ChiActive order is placed with demo discount!')">Proceed to Checkout</button>
          </div>
        </aside>
      `;
      document.body.insertAdjacentHTML('beforeend', drawerMarkup);
    }

    // Attach click listener to any cart button
    document.querySelectorAll('.cart-btn, [href="#cart"], a:has(.cart-badge)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCartDrawer();
      });
    });

    // Allow Enter key in promo input
    document.body.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'cart-promo-input' && e.key === 'Enter') {
        e.preventDefault();
        applyPromoCode();
      }
    });

    updateCartBadge();
    renderCartDrawer();
  });
})();
