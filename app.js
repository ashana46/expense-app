/* ─── State & Persistence ───────────────────────── */
const STORAGE_KEY = 'moneytracker_data';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { accounts: [], creditCards: [], expenses: [], transactions: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();

/* ─── Utility ───────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(n) {
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

function categoryBadge(cat) {
  const map = {
    'Travel': 'travel',
    'Food & Dining': 'food',
    'Groceries': 'grocery',
    'Shopping': 'shopping',
    'Entertainment': 'entertain',
    'Health': 'health',
    'Utilities': 'utility',
    'Rent/Mortgage': 'rent',
    'Transportation': 'transport',
    'Other': 'other',
    'Payment': 'payment',
  };
  const cls = map[cat] || 'other';
  return `<span class="badge badge-${cls}">${cat}</span>`;
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast hidden'; }, 3000);
}

function getSourceLabel(sourceId) {
  const acc = state.accounts.find(a => a.id === sourceId);
  if (acc) return `${acc.nickname} (${acc.type})`;
  const cc = state.creditCards.find(c => c.id === sourceId);
  if (cc) return cc.nickname;
  return '—';
}

/* ─── Navigation ────────────────────────────────── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    renderPage(page);
  });
});

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  if (page === 'accounts') renderAccounts();
  if (page === 'credit-cards') renderCreditCards();
  if (page === 'expenses') renderExpenses();
  if (page === 'transactions') renderTransactions();
}

/* ─── Source Dropdowns ──────────────────────────── */
function populateSourceDropdowns(...selectIds) {
  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '<option value="">-- Select Account/Card --</option>';
    if (state.accounts.length) {
      const og = document.createElement('optgroup');
      og.label = 'Bank Accounts';
      state.accounts.forEach(a => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = `${a.nickname} (${a.type}) — ${fmt(a.balance)}`;
        og.appendChild(o);
      });
      el.appendChild(og);
    }
    if (state.creditCards.length) {
      const og = document.createElement('optgroup');
      og.label = 'Credit Cards';
      state.creditCards.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nickname} — due ${fmt(c.balance)}`;
        og.appendChild(o);
      });
      el.appendChild(og);
    }
    if (prev) el.value = prev;
  });
}

function populateAccountDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">-- Select Account --</option>';
  state.accounts.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = `${a.nickname} — ${fmt(a.balance)}`;
    el.appendChild(o);
  });
}

function populateCardDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">-- Select Credit Card --</option>';
  state.creditCards.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.nickname} — due ${fmt(c.balance)}`;
    el.appendChild(o);
  });
}

/* ─── Dashboard ─────────────────────────────────── */
function renderDashboard() {
  // Summary
  const totalBank = state.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalCC   = state.creditCards.reduce((s, c) => s + Number(c.balance), 0);
  const thisMonth = (() => {
    const now = new Date();
    return state.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, e) => s + Number(e.amount), 0);
  })();
  const netWorth = totalBank - totalCC;

  document.getElementById('summary-cards').innerHTML = `
    <div class="summary-card">
      <div class="label">Total Bank Balance</div>
      <div class="value positive">${fmt(totalBank)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total CC Owed</div>
      <div class="value negative">${fmt(totalCC)}</div>
    </div>
    <div class="summary-card">
      <div class="label">This Month's Expenses</div>
      <div class="value negative">${fmt(thisMonth)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Worth</div>
      <div class="value ${netWorth >= 0 ? 'positive' : 'negative'}">${fmt(netWorth)}</div>
    </div>
  `;

  // Populate quick-add dropdowns
  populateSourceDropdowns('qe-source');

  // Set default date
  document.getElementById('qe-date').value = today();

  // Recent activity (last 10)
  const all = [
    ...state.expenses.map(e => ({ ...e, _type: 'expense' })),
    ...state.transactions.map(t => ({ ...t, _type: 'payment' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  const actEl = document.getElementById('recent-activity');
  if (!all.length) {
    actEl.innerHTML = '<div class="empty-state">No activity yet. Add an expense or account above.</div>';
    return;
  }
  actEl.innerHTML = all.map(item => {
    if (item._type === 'expense') {
      return `
        <div class="activity-item">
          <div class="act-left">
            <span class="act-desc">${item.description} ${categoryBadge(item.category)}</span>
            <span class="act-meta">${item.date} &bull; ${getSourceLabel(item.source)}</span>
          </div>
          <span class="act-amount expense">-${fmt(item.amount)}</span>
        </div>`;
    } else {
      return `
        <div class="activity-item">
          <div class="act-left">
            <span class="act-desc">CC Payment ${categoryBadge('Payment')}</span>
            <span class="act-meta">${item.date} &bull; ${getSourceLabel(item.fromAccount)} → ${getSourceLabel(item.toCard)}</span>
          </div>
          <span class="act-amount payment">-${fmt(item.amount)}</span>
        </div>`;
    }
  }).join('');
}

/* ─── Quick Add Expense (Dashboard) ─────────────── */
document.getElementById('quick-expense-form').addEventListener('submit', e => {
  e.preventDefault();
  const desc   = document.getElementById('qe-desc').value.trim();
  const amount = parseFloat(document.getElementById('qe-amount').value);
  const cat    = document.getElementById('qe-category').value;
  const source = document.getElementById('qe-source').value;
  const date   = document.getElementById('qe-date').value;

  if (!source) { showToast('Please select an account or card.', 'error'); return; }

  addExpense({ desc, amount, cat, source, date });
  e.target.reset();
  document.getElementById('qe-date').value = today();
  populateSourceDropdowns('qe-source');
  renderDashboard();
  showToast('Expense added!');
});

/* ─── Quick Add Account (Dashboard) ─────────────── */
document.getElementById('quick-account-form').addEventListener('submit', e => {
  e.preventDefault();
  const nickname = document.getElementById('qa-nickname').value.trim();
  const type     = document.getElementById('qa-type').value;
  const balance  = parseFloat(document.getElementById('qa-balance').value);

  state.accounts.push({ id: uid(), nickname, type, balance });
  saveData();
  e.target.reset();
  renderDashboard();
  showToast('Account added!');
});

/* ─── Expense Logic ─────────────────────────────── */
function addExpense({ desc, amount, cat, source, date }) {
  // Deduct from account if bank account
  const acc = state.accounts.find(a => a.id === source);
  if (acc) {
    acc.balance = Math.max(0, Number(acc.balance) - amount);
  }
  // Increase CC balance if credit card
  const cc = state.creditCards.find(c => c.id === source);
  if (cc) {
    cc.balance = Number(cc.balance) + amount;
  }
  state.expenses.push({
    id: uid(), description: desc, amount, category: cat, source, date,
  });
  saveData();
}

/* ─── Accounts Page ─────────────────────────────── */
function renderAccounts() {
  const el = document.getElementById('accounts-list');
  if (!state.accounts.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No accounts yet. Add one above.</div>';
    return;
  }
  el.innerHTML = state.accounts.map(a => `
    <div class="account-item">
      <div class="item-actions">
        <button class="btn-icon" onclick="openEditAccount('${a.id}')">Edit</button>
        <button class="btn-icon delete" onclick="deleteAccount('${a.id}')">Del</button>
      </div>
      <div class="acc-name">${a.nickname}</div>
      <div class="acc-type">${a.type}</div>
      <div class="acc-balance">${fmt(a.balance)}</div>
    </div>
  `).join('');
}

// Add Account Modal
document.getElementById('open-add-account-modal').addEventListener('click', () => {
  document.getElementById('modal-account-title').textContent = 'Add Account';
  document.getElementById('edit-account-id').value = '';
  document.getElementById('m-acc-nickname').value = '';
  document.getElementById('m-acc-type').value = 'checking';
  document.getElementById('m-acc-balance').value = '';
  openModal('modal-account');
});

document.getElementById('modal-account-form').addEventListener('submit', e => {
  e.preventDefault();
  const id       = document.getElementById('edit-account-id').value;
  const nickname = document.getElementById('m-acc-nickname').value.trim();
  const type     = document.getElementById('m-acc-type').value;
  const balance  = parseFloat(document.getElementById('m-acc-balance').value);

  if (id) {
    const acc = state.accounts.find(a => a.id === id);
    if (acc) { acc.nickname = nickname; acc.type = type; acc.balance = balance; }
  } else {
    state.accounts.push({ id: uid(), nickname, type, balance });
  }
  saveData();
  closeModal('modal-account');
  renderAccounts();
  showToast(id ? 'Account updated!' : 'Account added!');
});

function openEditAccount(id) {
  const a = state.accounts.find(a => a.id === id);
  if (!a) return;
  document.getElementById('modal-account-title').textContent = 'Edit Account';
  document.getElementById('edit-account-id').value = a.id;
  document.getElementById('m-acc-nickname').value = a.nickname;
  document.getElementById('m-acc-type').value = a.type;
  document.getElementById('m-acc-balance').value = a.balance;
  openModal('modal-account');
}

function deleteAccount(id) {
  if (!confirm('Delete this account?')) return;
  state.accounts = state.accounts.filter(a => a.id !== id);
  saveData();
  renderAccounts();
  showToast('Account deleted.', 'error');
}

/* ─── Credit Cards Page ─────────────────────────── */
function renderCreditCards() {
  const el = document.getElementById('cards-list');
  if (!state.creditCards.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No credit cards yet.</div>';
    return;
  }
  el.innerHTML = state.creditCards.map(c => {
    const days = daysUntil(c.due);
    const overdue = days < 0;
    const dueText = overdue
      ? `Overdue by ${Math.abs(days)} day(s)`
      : days === 0
        ? 'Due Today!'
        : `Due in ${days} day(s) — ${c.due}`;
    return `
      <div class="cc-item">
        <div class="item-actions">
          <button class="btn-icon" onclick="openEditCard('${c.id}')">Edit</button>
          <button class="btn-icon delete" onclick="deleteCard('${c.id}')">Del</button>
        </div>
        <div class="cc-name">${c.nickname}</div>
        <div class="cc-due-label">Amount Due</div>
        <div class="cc-balance">${fmt(c.balance)}</div>
        <div class="cc-due-date ${overdue ? 'overdue' : ''}">${dueText}</div>
      </div>
    `;
  }).join('');
}

document.getElementById('open-add-card-modal').addEventListener('click', () => {
  document.getElementById('modal-card-title').textContent = 'Add Credit Card';
  document.getElementById('edit-card-id').value = '';
  document.getElementById('m-card-nickname').value = '';
  document.getElementById('m-card-balance').value = '';
  document.getElementById('m-card-due').value = '';
  openModal('modal-card');
});

document.getElementById('modal-card-form').addEventListener('submit', e => {
  e.preventDefault();
  const id       = document.getElementById('edit-card-id').value;
  const nickname = document.getElementById('m-card-nickname').value.trim();
  const balance  = parseFloat(document.getElementById('m-card-balance').value);
  const due      = document.getElementById('m-card-due').value;

  if (id) {
    const c = state.creditCards.find(c => c.id === id);
    if (c) { c.nickname = nickname; c.balance = balance; c.due = due; }
  } else {
    state.creditCards.push({ id: uid(), nickname, balance, due });
  }
  saveData();
  closeModal('modal-card');
  renderCreditCards();
  showToast(id ? 'Card updated!' : 'Credit card added!');
});

function openEditCard(id) {
  const c = state.creditCards.find(c => c.id === id);
  if (!c) return;
  document.getElementById('modal-card-title').textContent = 'Edit Credit Card';
  document.getElementById('edit-card-id').value = c.id;
  document.getElementById('m-card-nickname').value = c.nickname;
  document.getElementById('m-card-balance').value = c.balance;
  document.getElementById('m-card-due').value = c.due;
  openModal('modal-card');
}

function deleteCard(id) {
  if (!confirm('Delete this credit card?')) return;
  state.creditCards = state.creditCards.filter(c => c.id !== id);
  saveData();
  renderCreditCards();
  showToast('Card deleted.', 'error');
}

/* ─── Expenses Page ─────────────────────────────── */
function renderExpenses() {
  populateSourceDropdowns('m-exp-source');
  document.getElementById('m-exp-date').value = today();

  const filterCat = document.getElementById('filter-category').value;
  let list = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filterCat) list = list.filter(e => e.category === filterCat);

  const tbody = document.getElementById('expenses-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No expenses yet.</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.description}</td>
      <td>${categoryBadge(e.category)}</td>
      <td>${getSourceLabel(e.source)}</td>
      <td class="amount-cell">-${fmt(e.amount)}</td>
      <td><button class="btn-icon delete" onclick="deleteExpense('${e.id}')">Del</button></td>
    </tr>
  `).join('');
}

document.getElementById('filter-category').addEventListener('change', renderExpenses);

document.getElementById('open-add-expense-modal').addEventListener('click', () => {
  populateSourceDropdowns('m-exp-source');
  document.getElementById('m-exp-date').value = today();
  document.getElementById('modal-expense-form').reset();
  document.getElementById('m-exp-date').value = today();
  openModal('modal-expense');
});

document.getElementById('modal-expense-form').addEventListener('submit', e => {
  e.preventDefault();
  const desc   = document.getElementById('m-exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('m-exp-amount').value);
  const date   = document.getElementById('m-exp-date').value;
  const cat    = document.getElementById('m-exp-category').value;
  const source = document.getElementById('m-exp-source').value;

  if (!source) { showToast('Please select an account or card.', 'error'); return; }

  addExpense({ desc, amount, cat, source, date });
  closeModal('modal-expense');
  renderExpenses();
  showToast('Expense added!');
});

function deleteExpense(id) {
  if (!confirm('Delete this expense? Note: account/card balances will NOT be reversed.')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveData();
  renderExpenses();
  showToast('Expense deleted.', 'error');
}

/* ─── Transactions / CC Payments ────────────────── */
function renderTransactions() {
  populateAccountDropdown('m-pay-account');
  populateCardDropdown('m-pay-card');
  document.getElementById('m-pay-date').value = today();

  const list = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('transactions-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No transactions yet. Make a credit card payment above.</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${categoryBadge('Payment')}</td>
      <td>CC Payment</td>
      <td>${getSourceLabel(t.fromAccount)}</td>
      <td>${getSourceLabel(t.toCard)}</td>
      <td class="payment-cell">-${fmt(t.amount)}</td>
      <td><button class="btn-icon delete" onclick="deleteTransaction('${t.id}')">Del</button></td>
    </tr>
  `).join('');
}

document.getElementById('open-add-payment-modal').addEventListener('click', () => {
  populateAccountDropdown('m-pay-account');
  populateCardDropdown('m-pay-card');
  document.getElementById('m-pay-date').value = today();
  document.getElementById('m-pay-amount').value = '';
  openModal('modal-payment');
});

document.getElementById('modal-payment-form').addEventListener('submit', e => {
  e.preventDefault();
  const fromId = document.getElementById('m-pay-account').value;
  const toId   = document.getElementById('m-pay-card').value;
  const amount = parseFloat(document.getElementById('m-pay-amount').value);
  const date   = document.getElementById('m-pay-date').value;

  if (!fromId) { showToast('Please select an account.', 'error'); return; }
  if (!toId)   { showToast('Please select a credit card.', 'error'); return; }

  const acc = state.accounts.find(a => a.id === fromId);
  const cc  = state.creditCards.find(c => c.id === toId);

  if (!acc || !cc) { showToast('Invalid selection.', 'error'); return; }
  if (amount > Number(acc.balance)) {
    showToast('Insufficient account balance!', 'error'); return;
  }

  // Apply payment
  acc.balance = Number(acc.balance) - amount;
  cc.balance  = Math.max(0, Number(cc.balance) - amount);

  state.transactions.push({ id: uid(), fromAccount: fromId, toCard: toId, amount, date });
  saveData();
  closeModal('modal-payment');
  renderTransactions();
  showToast('Payment recorded!');
});

function deleteTransaction(id) {
  if (!confirm('Delete this transaction? Note: balances will NOT be reversed.')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData();
  renderTransactions();
  showToast('Transaction deleted.', 'error');
}

/* ─── Modal Helpers ─────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close buttons
document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.modal;
    if (id) closeModal(id);
  });
});

// Click backdrop to close
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Expose edit/delete functions to global scope (called from inline onclick)
window.openEditAccount  = openEditAccount;
window.deleteAccount    = deleteAccount;
window.openEditCard     = openEditCard;
window.deleteCard       = deleteCard;
window.deleteExpense    = deleteExpense;
window.deleteTransaction = deleteTransaction;

/* ─── Init ──────────────────────────────────────── */
renderDashboard();
