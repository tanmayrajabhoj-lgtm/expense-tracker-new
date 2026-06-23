// ============================================
// LEDGER — Expense Tracker logic
// ============================================

const STORAGE_KEY = "ledger_expenses_v1";
const BUDGET_KEY = "ledger_budget_v1";

const CATEGORY_ICONS = {
  Food: "🍽️",
  Transport: "🚕",
  Bills: "🧾",
  Shopping: "🛍️",
  Health: "💊",
  Other: "✶"
};

let expenses = loadExpenses();
let budget = loadBudget();
let activeFilter = "All";
let activeSort = "date-desc";
let selectedCategory = "Other";

// ---------- Persistence (in-memory fallback safe) ----------
let storageWorking = true;

function isStorageAvailable() {
  try {
    const testKey = "__ledger_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedData();
  } catch (e) {
    return seedData();
  }
}

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    storageWorking = true;
  } catch (e) {
    storageWorking = false;
    showToast("Couldn't save — your browser is blocking storage. See the warning banner below.", true);
  }
}

function loadBudget() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? parseFloat(raw) : null;
  } catch (e) { return null; }
}

function saveBudget() {
  try {
    if (budget !== null) localStorage.setItem(BUDGET_KEY, String(budget));
  } catch (e) { /* ignore */ }
}

function seedData() {
  const today = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];
  const d = (offset) => { const x = new Date(today); x.setDate(x.getDate() - offset); return fmt(x); };
  return [
    { id: cryptoId(), desc: "Groceries — weekly run", amount: 1840, category: "Food", date: d(1) },
    { id: cryptoId(), desc: "Auto rickshaw to office", amount: 120, category: "Transport", date: d(2) },
    { id: cryptoId(), desc: "Electricity bill", amount: 2150, category: "Bills", date: d(4) },
    { id: cryptoId(), desc: "New headphones", amount: 3299, category: "Shopping", date: d(6) }
  ];
}

function cryptoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- DOM refs ----------
const form = document.getElementById("expense-form");
const descInput = document.getElementById("desc");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const categoryGrid = document.getElementById("category-grid");
const categoryHidden = document.getElementById("category");
const stamp = document.getElementById("stamp");

const receiptList = document.getElementById("receipt-list");
const emptyState = document.getElementById("empty-state");

const totalValue = document.getElementById("total-value");
const totalSub = document.getElementById("total-sub");
const countValue = document.getElementById("count-value");
const avgSub = document.getElementById("avg-sub");
const topCatValue = document.getElementById("top-cat-value");
const topCatSub = document.getElementById("top-cat-sub");

const filterPills = document.getElementById("filter-pills");
const sortSelect = document.getElementById("sort-select");

const budgetInput = document.getElementById("budget-input");
const budgetBarFill = document.getElementById("budget-bar-fill");
const budgetCaption = document.getElementById("budget-caption");

const toast = document.getElementById("toast");

// ---------- Init ----------
dateInput.valueAsDate = new Date();
if (budget !== null) budgetInput.value = budget;

if (!isStorageAvailable()) {
  storageWorking = false;
  showStorageWarning();
}

render();

function showStorageWarning() {
  const banner = document.createElement("div");
  banner.className = "storage-warning";
  banner.innerHTML = `
    <strong>Your changes won't be saved after refresh.</strong>
    Your browser is blocking local storage for this page — this usually happens when a file is opened
    directly (a <code>file://</code> link), in private/incognito mode, or with strict cookie/site-data
    settings. Try opening this page from a real web address (e.g. via GitHub Pages, or a local server),
    or check your browser's site-data settings for this page.
  `;
  document.body.insertBefore(banner, document.body.firstChild);
}

// ---------- Category chip selection ----------
categoryGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-chip");
  if (!btn) return;
  document.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("selected"));
  btn.classList.add("selected");
  selectedCategory = btn.dataset.cat;
  categoryHidden.value = selectedCategory;
});
// default-select "Other" visually
document.querySelector('.cat-chip[data-cat="Other"]').classList.add("selected");

// ---------- Add expense ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;

  if (!desc) { showToast("Add a short description first.", true); return; }
  if (isNaN(amount) || amount <= 0) { showToast("Enter an amount greater than zero.", true); return; }
  if (!date) { showToast("Pick a date for this expense.", true); return; }

  const entry = {
    id: cryptoId(),
    desc,
    amount: Math.round(amount * 100) / 100,
    category: selectedCategory,
    date
  };

  expenses.unshift(entry);
  saveExpenses();
  render();
  fireStamp();
  if (storageWorking) {
    showToast(`Added "${desc}" to the ledger.`);
  }

  form.reset();
  dateInput.valueAsDate = new Date();
  document.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("selected"));
  document.querySelector('.cat-chip[data-cat="Other"]').classList.add("selected");
  selectedCategory = "Other";
  categoryHidden.value = "Other";
  descInput.focus();
});

function fireStamp() {
  stamp.classList.remove("show");
  // restart animation
  void stamp.offsetWidth;
  stamp.classList.add("show");
}

// ---------- Delete expense ----------
function deleteExpense(id) {
  const li = receiptList.querySelector(`[data-id="${id}"]`);
  const entry = expenses.find((x) => x.id === id);
  if (li) {
    li.classList.add("removing");
    li.addEventListener("animationend", () => {
      expenses = expenses.filter((x) => x.id !== id);
      saveExpenses();
      render();
      if (entry) showToast(`Removed "${entry.desc}".`, false, true);
    }, { once: true });
  } else {
    expenses = expenses.filter((x) => x.id !== id);
    saveExpenses();
    render();
  }
}

// ---------- Filters & sorting ----------
filterPills.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  render();
});

sortSelect.addEventListener("change", () => {
  activeSort = sortSelect.value;
  render();
});

// ---------- Budget ----------
budgetInput.addEventListener("input", () => {
  const val = parseFloat(budgetInput.value);
  budget = isNaN(val) || val <= 0 ? null : val;
  saveBudget();
  renderBudget();
});

function renderBudget() {
  const total = expenses.reduce((sum, x) => sum + x.amount, 0);

  if (budget === null) {
    budgetBarFill.style.width = "0%";
    budgetBarFill.classList.remove("over");
    budgetCaption.textContent = "Set a budget to track your pace this month.";
    return;
  }

  const pct = Math.min((total / budget) * 100, 100);
  budgetBarFill.style.width = pct + "%";

  if (total > budget) {
    budgetBarFill.classList.add("over");
    budgetCaption.textContent = `You're ₹${fmt(total - budget)} over your ₹${fmt(budget)} budget.`;
  } else {
    budgetBarFill.classList.remove("over");
    const remaining = budget - total;
    budgetCaption.textContent = `₹${fmt(remaining)} left of your ₹${fmt(budget)} budget.`;
  }
}

// ---------- Rendering ----------
function getFilteredSorted() {
  let list = activeFilter === "All" ? [...expenses] : expenses.filter((x) => x.category === activeFilter);

  switch (activeSort) {
    case "date-desc": list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); break;
    case "date-asc": list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); break;
    case "amount-desc": list.sort((a, b) => b.amount - a.amount); break;
    case "amount-asc": list.sort((a, b) => a.amount - b.amount); break;
  }
  return list;
}

function render() {
  renderSummary();
  renderBudget();
  renderList();
}

function renderSummary() {
  const total = expenses.reduce((sum, x) => sum + x.amount, 0);
  const count = expenses.length;

  animateNumber(totalValue, total, true);
  countValue.textContent = count;

  totalSub.textContent = count === 0 ? "No entries yet" : `across ${count} ${count === 1 ? "entry" : "entries"}`;
  avgSub.textContent = count === 0 ? "— avg per entry" : `₹${fmt(total / count)} avg per entry`;

  if (count === 0) {
    topCatValue.textContent = "—";
    topCatSub.textContent = "No data yet";
    return;
  }

  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  topCatValue.textContent = `${CATEGORY_ICONS[top[0]] || "✶"} ${top[0]}`;
  topCatSub.textContent = `₹${fmt(top[1])} spent`;
}

function animateNumber(el, target, isCurrency) {
  const start = parseFloat(el.dataset.raw || "0");
  const duration = 450;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = isCurrency ? `₹${fmt(current)}` : Math.round(current);
    if (progress < 1) requestAnimationFrame(step);
    else el.dataset.raw = String(target);
  }
  requestAnimationFrame(step);
}

function renderList() {
  const list = getFilteredSorted();
  receiptList.innerHTML = "";

  if (expenses.length === 0) {
    emptyState.classList.add("show");
    receiptList.style.display = "none";
    return;
  }
  emptyState.classList.remove("show");
  receiptList.style.display = "flex";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.style.textAlign = "center";
    li.style.padding = "30px 0";
    li.style.color = "var(--text-dim)";
    li.style.fontSize = "0.9rem";
    li.textContent = `No entries in "${activeFilter}" yet.`;
    receiptList.appendChild(li);
    return;
  }

  list.forEach((x) => {
    const li = document.createElement("li");
    li.className = "receipt";
    li.dataset.id = x.id;
    li.innerHTML = `
      <div class="receipt-icon">${CATEGORY_ICONS[x.category] || "✶"}</div>
      <div class="receipt-main">
        <p class="receipt-desc">${escapeHtml(x.desc)}</p>
        <p class="receipt-meta">
          <span>${formatDate(x.date)}</span>
          <span class="dot">•</span>
          <span class="receipt-cat-tag">${escapeHtml(x.category)}</span>
        </p>
      </div>
      <div class="receipt-amount">₹${fmt(x.amount)}</div>
      <button class="delete-btn" aria-label="Delete ${escapeHtml(x.desc)}" title="Delete entry">
        <svg viewBox="0 0 20 20" fill="none"><path d="M5 6H15M8 6V4.5C8 4 8.4 3.5 9 3.5H11C11.6 3.5 12 4 12 4.5V6M6.5 6L7 16C7 16.5 7.4 17 8 17H12C12.6 17 13 16.5 13 16L13.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    `;
    li.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(x.id));
    receiptList.appendChild(li);
  });
}

// ---------- Helpers ----------
function fmt(num) {
  return num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(isoStr) {
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

let toastTimer;
function showToast(message, isError = false, isDelete = false) {
  clearTimeout(toastTimer);
  toast.innerHTML = `<span class="toast-dot"></span>${escapeHtml(message)}`;
  toast.classList.toggle("toast-error", isError || isDelete);
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
