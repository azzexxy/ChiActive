(function () {
  var KEY = "chiactive-cart";

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(data)) return [];
      return data.filter(function (item) {
        return item && typeof item.name === "string" && typeof item.price === "number";
      }).map(function (item) {
        return {
          name: item.name,
          price: Math.round(item.price),
          qty: Math.max(1, parseInt(item.qty, 10) || 1),
          size: item.size ? String(item.size) : ""
        };
      });
    } catch (err) {
      return [];
    }
  }

  function money(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  function parseCents(text) {
    var match = String(text).replace(/,/g, "").match(/(\d+\.\d{2}|\d+)/);
    if (!match) return NaN;
    return Math.round(parseFloat(match[1]) * 100);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function countOf(items) {
    return items.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function paintCount(items) {
    var total = countOf(items);
    document.querySelectorAll(".cart-link").forEach(function (link) {
      var badge = link.querySelector(".cart-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cart-count";
        link.appendChild(badge);
      }
      if (total > 0) {
        badge.hidden = false;
        badge.textContent = String(total);
      } else {
        badge.hidden = true;
        badge.textContent = "";
      }
    });
  }

  function paintCart(items) {
    var root = document.getElementById("cart");
    if (!root) return;
    if (!items.length) {
      root.innerHTML = "<p>Your bag is empty.</p>";
      return;
    }
    var subtotal = 0;
    var html = '<div class="cart-list">';
    items.forEach(function (item, index) {
      subtotal += item.price * item.qty;
      html += '<div class="cart-row">';
      html += '<div><p class="cart-name">' + escapeHtml(item.name) + "</p>";
      if (item.size) html += '<p class="cart-size">Size ' + escapeHtml(item.size) + "</p>";
      html += "</div>";
      html += '<p class="cart-price">' + money(item.price) + "</p>";
      html += '<p class="cart-qty">Quantity ' + item.qty + "</p>";
      html += '<button type="button" class="cart-remove" data-index="' + index + '">Remove</button>';
      html += "</div>";
    });
    html += "</div>";
    html += '<p class="cart-subtotal">Subtotal ' + money(subtotal) + "</p>";
    root.innerHTML = html;
    root.querySelectorAll(".cart-remove").forEach(function (button) {
      button.addEventListener("click", function () {
        var next = load();
        next.splice(parseInt(button.getAttribute("data-index"), 10), 1);
        save(next);
      });
    });
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    paintCount(items);
    paintCart(items);
  }

  function addItem(name, cents, qty, size) {
    var items = load();
    size = size || "";
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var found = null;
    items.forEach(function (item) {
      if (item.name === name && item.price === cents && item.size === size) found = item;
    });
    if (found) found.qty += qty;
    else items.push({ name: name, price: cents, qty: qty, size: size });
    save(items);
  }

  function cardPrice(card) {
    var priceEl = card.querySelector(".price");
    if (!priceEl) return NaN;
    var copy = priceEl.cloneNode(true);
    copy.querySelectorAll(".price-old").forEach(function (old) { old.remove(); });
    return parseCents(copy.textContent);
  }

  document.querySelectorAll(".product-card").forEach(function (card) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "add-to-cart";
    button.textContent = "Add to cart";
    card.appendChild(button);
    button.addEventListener("click", function () {
      var nameEl = card.querySelector("h3");
      var name = nameEl ? nameEl.textContent.trim() : "";
      var cents = cardPrice(card);
      if (!name || !isFinite(cents)) return;
      addItem(name, cents, 1, "");
      button.textContent = "Added";
      window.setTimeout(function () { button.textContent = "Add to cart"; }, 1200);
    });
  });

  var form = document.querySelector(".buybox form");
  if (form) {
    var button = form.querySelector("button");
    var size = form.querySelector("#size");
    var qty = form.querySelector("#qty");
    var note = document.createElement("p");
    note.className = "buy-note";
    note.hidden = true;
    note.setAttribute("role", "status");
    if (button) button.before(note);
    if (size) {
      size.addEventListener("change", function () {
        if (size.value && size.value !== "Choose an option") note.hidden = true;
      });
    }
    if (button) {
      button.addEventListener("click", function () {
        var chosen = size ? size.value : "";
        if (!chosen || chosen === "Choose an option") {
          note.hidden = false;
          note.classList.add("is-error");
          note.textContent = "Choose a size.";
          if (size) size.focus();
          return;
        }
        var nameEl = document.querySelector(".buybox h1");
        var priceEl = document.querySelector(".buybox .price");
        var name = nameEl ? nameEl.textContent.trim() : "";
        var cents = priceEl ? parseCents(priceEl.textContent) : NaN;
        if (!name || !isFinite(cents)) return;
        addItem(name, cents, qty ? qty.value : 1, chosen);
        note.hidden = false;
        note.classList.remove("is-error");
        note.textContent = "Added to your bag.";
      });
    }
  }

  var items = load();
  paintCount(items);
  paintCart(items);
})();
