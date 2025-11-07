// Use Vercel rewrite proxy so there's no CORS.
const API_URL = "/api"; // <- do not change

const F = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });

const els = {
  rows: document.getElementById('rows'),
  totalValue: document.getElementById('totalValue'),
  totalPL: document.getElementById('totalPL'),
  avgPct: document.getElementById('avgPct'),
  lastUpdated: document.getElementById('lastUpdated'),
  search: document.getElementById('search'),
  refresh: document.getElementById('refresh'),
  table: document.getElementById('tbl'),
};

let data = [];
let sortKey = 'profit_total';
let sortDir = 'desc';

function showError(msg) {
  let bar = document.getElementById('errbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'errbar';
    bar.style.cssText = 'background:#3a0d0d;color:#ffd2d2;padding:10px 12px;border:1px solid #5a1a1a;border-radius:8px;margin:12px 0;';
    document.querySelector('.container').prepend(bar);
  }
  bar.textContent = msg;
}

function cls(val) {
  if (val == null) return '';
  if (val > 0) return 'pos';
  if (val < 0) return 'neg';
  return '';
}

function render() {
  const q = (els.search.value || '').toLowerCase().trim();
  const filtered = data.filter(r => !q || r.item_name.toLowerCase().includes(q));

  filtered.sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return sortDir === 'asc' ? -1 : 1;
    if (bv == null) return sortDir === 'asc' ? 1 : -1;
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  els.rows.innerHTML = filtered.map(r => {
    const paid = r.paid_price ?? null;
    const curr = r.current_price ?? null;
    const ppl = r.profit_per_item ?? null;
    const ptl = r.profit_total ?? null;
    const pct = r.percent_change ?? null;
    const ts = r.timestamp_utc ? new Date(r.timestamp_utc).toLocaleString('en-CA') : '—';
    return `<tr>
      <td>${r.item_name}</td>
      <td>${r.source}</td>
      <td class="money">${paid!=null?F.format(paid):'—'}</td>
      <td class="money">${curr!=null?F.format(curr):'—'}</td>
      <td class="money ${cls(ppl)}">${ppl!=null?F.format(ppl):'—'}</td>
      <td class="${cls(pct)}">${pct!=null?(pct>0?'+':'')+pct.toFixed(2)+'%':'—'}</td>
      <td>${r.quantity}</td>
      <td class="money ${cls(ptl)}">${ptl!=null?F.format(ptl):'—'}</td>
      <td class="mono">${ts}</td>
    </tr>`;
  }).join('');

  const withCurr = filtered.filter(r => r.current_price != null);
  const totalValue = withCurr.reduce((s, r) => s + r.current_price * r.quantity, 0);
  const totalPL = filtered.reduce((s, r) => s + (r.profit_total ?? 0), 0);
  const avgPct = (() => {
    const pcs = filtered.map(r => r.percent_change).filter(x => x != null);
    if (!pcs.length) return null;
    return pcs.reduce((s, x) => s + x, 0) / pcs.length;
  })();

  els.totalValue.textContent = withCurr.length ? F.format(totalValue) : '—';
  els.totalPL.textContent = (totalPL || totalPL === 0) ? F.format(totalPL) : '—';
  els.totalPL.className = 'value ' + cls(totalPL);
  els.avgPct.textContent = (avgPct != null) ? (avgPct>0?'+':'') + avgPct.toFixed(2) + '%' : '—';

  const latest = data.map(r => r.timestamp_utc).filter(Boolean).map(t => +new Date(t)).sort((a,b)=>b-a)[0];
  els.lastUpdated.textContent = latest ? new Date(latest).toLocaleString('en-CA') : '—';
}

async function load() {
  els.refresh.disabled = true;
  try {
    const h = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!h.ok) { showError(`API /health failed: HTTP ${h.status}`); els.refresh.disabled = false; return; }

    const r = await fetch(`${API_URL}/prices`, { cache: 'no-store' });
    if (!r.ok) { showError(`API /prices failed: HTTP ${r.status}`); els.refresh.disabled = false; return; }

    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const txt = await r.text();
      showError(`API /prices returned non-JSON. First 80 chars: ${txt.slice(0,80)}`);
      els.refresh.disabled = false; return;
    }

    const json = await r.json();
    if (!Array.isArray(json)) { showError('API /prices returned non-list JSON'); els.refresh.disabled = false; return; }
    data = json;
  } catch (e) {
    showError(`Fetch error: ${e?.message || e}`);
    data = [];
  } finally {
    els.refresh.disabled = false;
    render();
  }
}

els.search.addEventListener('input', render);
els.refresh.addEventListener('click', load);

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.getAttribute('data-sort');
    if (sortKey === k) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
    else { sortKey = k; sortDir = 'desc'; }
    render();
  });
});

load();
