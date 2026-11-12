// Budget Tracker front end

let transactions = [];
let chart;

const els = {
  total: document.querySelector('#total'),
  income: document.querySelector('#income'),
  expenses: document.querySelector('#expenses'),
  list: document.querySelector('#tbody'),
  count: document.querySelector('#t-count'),
  name: document.querySelector('#t-name'),
  amount: document.querySelector('#t-amount'),
  error: document.querySelector('.form .error'),
  banner: document.querySelector('#offline-banner'),
  sync: document.querySelector('#sync-status'),
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyShort = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// ---------- Rendering ----------
function renderTotals() {
  const income = transactions.filter((t) => t.value > 0).reduce((sum, t) => sum + t.value, 0);
  const expenses = transactions.filter((t) => t.value < 0).reduce((sum, t) => sum + t.value, 0);
  els.total.textContent = money.format(income + expenses);
  els.income.textContent = money.format(income);
  els.expenses.textContent = money.format(Math.abs(expenses));
}

function renderList() {
  els.list.innerHTML = '';
  els.count.textContent = `${transactions.length} total`;

  if (!transactions.length) {
    els.list.innerHTML = '<li class="empty">No transactions yet. Add your first one above.</li>';
    return;
  }

  transactions.forEach((t) => {
    const li = document.createElement('li');
    li.className = 't-item';
    const positive = t.value >= 0;
    li.innerHTML = `
      <span class="t-icon ${positive ? 'in' : 'out'}" aria-hidden="true">${positive ? '↑' : '↓'}</span>
      <span class="t-main"><span class="t-name"></span><span class="t-date">${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${t.pending ? ' · <em>waiting to sync</em>' : ''}</span></span>
      <span class="t-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : '−'}${money.format(Math.abs(t.value))}</span>
    `;
    li.querySelector('.t-name').textContent = t.name;
    els.list.appendChild(li);
  });
}

function renderChart() {
  if (typeof Chart === 'undefined') return; // chart library not available (e.g. first visit offline)

  const ordered = transactions.slice().reverse();
  let sum = 0;
  const labels = ordered.map((t) => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const data = ordered.map((t) => (sum += t.value));

  if (chart) chart.destroy();
  const ctx = document.getElementById('myChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.25)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Balance',
          data,
          fill: true,
          backgroundColor: gradient,
          borderColor: '#4f46e5',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#4f46e5',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => money.format(c.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: (v) => moneyShort.format(v) }, grid: { color: '#eef0f6' } },
      },
    },
  });
}

function renderAll() {
  renderTotals();
  renderList();
  renderChart();
}

// ---------- Data ----------
async function loadTransactions() {
  try {
    const res = await fetch('/api/transaction');
    const saved = (await res.json()).map((t) => ({ ...t, value: Number(t.value) }));
    const pending = (await pendingDB.getAll().catch(() => [])).map((t) => ({ ...t, pending: true }));
    transactions = [...pending.reverse(), ...saved];
  } catch {
    transactions = [];
  }
  renderAll();
}

async function syncPending() {
  const pending = await pendingDB.getAll().catch(() => []);
  if (!pending.length || !navigator.onLine) return;

  els.sync.textContent = 'Syncing…';
  try {
    const res = await fetch('/api/transaction/bulk', {
      method: 'POST',
      body: JSON.stringify(pending),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('sync failed');
    await pendingDB.clear();
    els.sync.textContent = `Synced ${pending.length} offline ${pending.length === 1 ? 'entry' : 'entries'}`;
    await loadTransactions();
  } catch {
    els.sync.textContent = 'Sync failed, will retry';
  }
  setTimeout(() => (els.sync.textContent = ''), 4000);
}

async function sendTransaction(isAdding) {
  const name = els.name.value.trim();
  const amount = parseFloat(els.amount.value);

  if (!name || !amount || amount <= 0) {
    els.error.textContent = !name ? 'Please add a description.' : 'Please enter an amount greater than 0.';
    (!name ? els.name : els.amount).focus();
    return;
  }
  els.error.textContent = '';

  const transaction = {
    name,
    value: Math.round((isAdding ? amount : -amount) * 100) / 100,
    date: new Date().toISOString(),
  };

  // Show it right away, then save
  transactions.unshift(transaction);
  renderAll();
  els.name.value = '';
  els.amount.value = '';
  els.name.focus();

  try {
    const res = await fetch('/api/transaction', {
      method: 'POST',
      body: JSON.stringify(transaction),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('save failed');
  } catch {
    // Offline or server unreachable: keep it on this device and sync later
    await pendingDB.add(transaction);
    transaction.pending = true;
    renderList();
  }
}

// ---------- Events ----------
document.querySelector('#add-btn').addEventListener('click', () => sendTransaction(true));
document.querySelector('#sub-btn').addEventListener('click', () => sendTransaction(false));
document.querySelector('#t-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sendTransaction(true);
});

function updateOnlineState() {
  els.banner.hidden = navigator.onLine;
  if (navigator.onLine) syncPending();
}

window.addEventListener('online', updateOnlineState);
window.addEventListener('offline', updateOnlineState);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}

loadTransactions().then(updateOnlineState);
