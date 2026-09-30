// Tiny bag counter so you can check the script loaded.
var KEY = 'test-design-bag';
function count() { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } }
function show() { var el = document.getElementById('bag-count'); if (el) el.textContent = count(); }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-add]'); if (!b) return;
  try { localStorage.setItem(KEY, count() + 1); } catch (err) {}
  b.textContent = 'Added!'; setTimeout(function () { b.textContent = 'Add to bag'; }, 1200); show();
});
show();
