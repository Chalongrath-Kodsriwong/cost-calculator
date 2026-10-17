/* คำนวณต้นทุนสินค้า — vanilla JS, ไม่ต้อง build */
(() => {
  const STORE_KEY = 'cost-calc:v1';
  const $ = (s) => document.querySelector(s);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const fmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const baht = (n) => (n < 0 ? '-฿' : '฿') + fmt.format(Math.abs(n));
  const pct = (n) => fmt.format(n * 100) + '%';
  const uid = () => Math.random().toString(36).slice(2, 10);

  // คอลัมน์ของแต่ละตาราง: [หัว a, หัว b] (b = null คือมีแค่จำนวนเงิน)
  const SECTIONS = {
    materials: { a: 'จำนวน', b: 'ราคา/หน่วย', two: false },
    labor:     { a: 'ชั่วโมง', b: 'ค่าแรง/ชม.', two: false },
    extras:    { a: 'บาท/ชิ้น', b: null, two: true },
    fixed:     { a: 'บาท/เดือน', b: null, two: true },
  };

  const blankProduct = (name = 'สินค้าใหม่') => ({
    id: uid(), name, batchUnits: 1, monthlyUnits: 100,
    feePct: 0, targetMargin: 30, sellPrice: '',
    materials: [{ name: '', a: '', b: '' }],
    labor: [], extras: [], fixed: [],
  });

  const sample = () => ({
    id: uid(), name: 'ตัวอย่าง: สบู่สมุนไพร', batchUnits: 50, monthlyUnits: 400,
    feePct: 5, targetMargin: 35, sellPrice: '',
    materials: [
      { name: 'เบสสบู่ (กก.)', a: 5, b: 120 },
      { name: 'น้ำมันหอมระเหย (ขวด)', a: 2, b: 85 },
      { name: 'สมุนไพรอบแห้ง (กรัม)', a: 200, b: 0.5 },
    ],
    labor: [{ name: 'ผลิต + แพ็ค', a: 3, b: 60 }],
    extras: [{ name: 'กล่อง + สติกเกอร์', a: 4.5 }],
    fixed: [{ name: 'ค่าเช่าที่', a: 3000 }, { name: 'ค่าโฆษณา', a: 1500 }],
  });

  // ---------- Storage ----------
  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { db = null; }
    if (!db || !Array.isArray(db.products) || !db.products.length) {
      const s = sample(); db = { current: s.id, products: [s] };
    }
    if (!db.products.find(p => p.id === db.current)) db.current = db.products[0].id;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* storage ไม่พร้อมใช้ */ }
    }, 250);
  }
  const cur = () => db.products.find(p => p.id === db.current);

  // ---------- Calculation ----------
  function calc(p) {
    const batch = Math.max(1, num(p.batchUnits));
    const monthly = Math.max(1, num(p.monthlyUnits));
    const sum2 = (rows) => rows.reduce((s, r) => s + num(r.a) * num(r.b), 0);
    const sum1 = (rows) => rows.reduce((s, r) => s + num(r.a), 0);

    const matBatch = sum2(p.materials), labBatch = sum2(p.labor);
    const extUnit = sum1(p.extras), fixMonth = sum1(p.fixed);
    const mat = matBatch / batch, lab = labBatch / batch, fix = fixMonth / monthly;
    const variable = mat + lab + extUnit;
    const cost = variable + fix;

    const f = num(p.feePct) / 100, m = num(p.targetMargin) / 100;
    const suggestValid = f + m < 1;
    const suggest = suggestValid ? cost / (1 - f - m) : NaN;

    const usingSuggest = p.sellPrice === '' || p.sellPrice === null;
    const price = usingSuggest ? suggest : num(p.sellPrice);
    const fee = price * f;
    const profit = price - fee - cost;
    const contrib = price - fee - variable; // กำไรส่วนเกินต่อชิ้น
    const breakeven = contrib > 0 ? Math.ceil(fixMonth / contrib) : Infinity;

    return {
      matBatch, labBatch, extUnit, fixMonth, mat, lab, ext: extUnit, fix, variable, cost,
      suggest, suggestValid, usingSuggest, price, fee, profit,
      margin: price > 0 ? profit / price : NaN,
      markup: cost > 0 ? profit / cost : NaN,
      breakeven, monthlyProfit: contrib * monthly - fixMonth, monthly,
    };
  }

  // ---------- Rendering ----------
  const tpl = $('#rowTpl');

  function renderRows(key) {
    const p = cur(), cfg = SECTIONS[key], box = document.getElementById(key);
    box.innerHTML = '';
    if (p[key].length) {
      const head = document.createElement('div');
      head.className = 'row row-head' + (cfg.two ? ' two' : '');
      head.innerHTML = `<span>รายการ</span><span>${cfg.a}</span>${cfg.b ? `<span>${cfg.b}</span>` : ''}<span style="text-align:right">รวม</span><span></span>`;
      box.appendChild(head);
    }
    p[key].forEach((r, i) => {
      const el = tpl.content.firstElementChild.cloneNode(true);
      if (cfg.two) el.classList.add('two');
      const [n, a, b] = el.querySelectorAll('input');
      n.value = r.name ?? ''; a.value = r.a ?? ''; b.value = r.b ?? '';
      a.placeholder = cfg.a; if (cfg.b) b.placeholder = cfg.b;
      const [la, lb] = el.querySelectorAll('.cell small'); la.textContent = cfg.a; lb.textContent = cfg.b || '';
      n.oninput = () => { r.name = n.value; save(); refreshPicker(); };
      a.oninput = () => { r.a = a.value; update(); };
      b.oninput = () => { r.b = b.value; update(); };
      el.querySelector('.del').onclick = () => { p[key].splice(i, 1); renderRows(key); update(); };
      box.appendChild(el);
    });
  }

  function rowSums() {
    const p = cur();
    for (const key of Object.keys(SECTIONS)) {
      const rows = document.querySelectorAll(`#${key} .row:not(.row-head)`);
      rows.forEach((el, i) => {
        const r = p[key][i]; if (!r) return;
        const v = SECTIONS[key].two ? num(r.a) : num(r.a) * num(r.b);
        el.querySelector('.f-sum').textContent = baht(v);
      });
    }
  }

  const FIELDS = ['name', 'batchUnits', 'monthlyUnits', 'feePct', 'targetMargin', 'sellPrice'];
  function bindFields() {
    FIELDS.forEach(f => {
      const el = document.getElementById(f);
      el.oninput = () => { cur()[f] = el.value; if (f === 'name') refreshPicker(); update(); };
    });
  }
  function fillFields() {
    const p = cur();
    FIELDS.forEach(f => { document.getElementById(f).value = p[f] ?? ''; });
  }

  function refreshPicker() {
    const sel = $('#productSelect');
    sel.innerHTML = db.products.map(p =>
      `<option value="${p.id}" ${p.id === db.current ? 'selected' : ''}>${escapeHtml(p.name || '(ไม่มีชื่อ)')}</option>`).join('');
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function update() {
    const r = calc(cur());
    rowSums();
    $('#matTotal').textContent = `${baht(r.matBatch)} · ${baht(r.mat)}/ชิ้น`;
    $('#labTotal').textContent = `${baht(r.labBatch)} · ${baht(r.lab)}/ชิ้น`;
    $('#extTotal').textContent = `${baht(r.ext)}/ชิ้น`;
    $('#fixTotal').textContent = `${baht(r.fixMonth)} · ${baht(r.fix)}/ชิ้น`;

    $('#rCost').textContent = baht(r.cost);
    const parts = [
      ['วัตถุดิบ', r.mat, 'var(--c1)'], ['ค่าแรง', r.lab, 'var(--c2)'],
      ['ผันแปรอื่น', r.ext, 'var(--c3)'], ['ค่าใช้จ่ายคงที่', r.fix, 'var(--c4)'],
    ];
    $('#costBar').innerHTML = r.cost > 0
      ? parts.map(([, v, c]) => `<i style="width:${(v / r.cost) * 100}%;background:${c}"></i>`).join('') : '';
    $('#breakdown').innerHTML = parts.map(([n, v, c]) =>
      `<li><span><b style="background:${c}"></b>${n}</span><span>${baht(v)}${r.cost > 0 ? ` (${fmt.format(v / r.cost * 100)}%)` : ''}</span></li>`).join('');

    $('#rSuggest').textContent = r.suggestValid ? baht(r.suggest) : '-';
    $('#rSuggestNote').textContent = r.suggestValid
      ? `กำไร ${cur().targetMargin || 0}% หลังหักค่าธรรมเนียม ${cur().feePct || 0}%` : '';

    const ok = Number.isFinite(r.price);
    const set = (id, text, neg = false) => { const el = $(id); el.textContent = text; el.classList.toggle('neg', neg); };
    set('#rPrice', ok ? baht(r.price) + (r.usingSuggest ? ' (แนะนำ)' : '') : '-');
    set('#rFee', ok ? baht(r.fee) : '-');
    set('#rProfit', ok ? baht(r.profit) : '-', r.profit < 0);
    set('#rMargin', ok && Number.isFinite(r.margin) ? pct(r.margin) : '-', r.margin < 0);
    set('#rMarkup', ok && Number.isFinite(r.markup) ? pct(r.markup) : '-', r.markup < 0);
    set('#rBreakeven', !ok ? '-' : Number.isFinite(r.breakeven) ? `${fmt.format(r.breakeven).replace(/\.00$/, '')} ชิ้น` : 'ไม่คุ้มทุน', !Number.isFinite(r.breakeven));
    set('#rMonthly', ok ? baht(r.monthlyProfit) : '-', r.monthlyProfit < 0);

    const warns = [];
    if (!r.suggestValid) warns.push('กำไรเป้าหมาย + ค่าธรรมเนียม ต้องรวมกันไม่ถึง 100%');
    if (ok && r.profit < 0) warns.push('ราคาขายต่ำกว่าต้นทุน — ขาดทุนทุกชิ้นที่ขาย');
    else if (ok && Number.isFinite(r.breakeven) && r.breakeven > r.monthly)
      warns.push(`ยอดขาย ${r.monthly} ชิ้น/เดือน ยังไม่ถึงจุดคุ้มทุน`);
    const w = $('#warn'); w.hidden = !warns.length; w.textContent = warns.join(' · ');

    // แถบสรุปด้านล่าง (มือถือ)
    $('#mCost').textContent = baht(r.cost);
    $('#mSuggest').textContent = r.suggestValid ? baht(r.suggest) : '-';
    set('#mProfit', ok ? baht(r.profit) : '-', r.profit < 0);

    save();
  }

  function renderAll() {
    fillFields();
    Object.keys(SECTIONS).forEach(renderRows);
    refreshPicker();
    update();
  }

  // ---------- Actions ----------
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.add;
      cur()[key].push({ name: '', a: '', b: '' });
      renderRows(key); update();
      const inputs = document.querySelectorAll(`#${key} .f-name`);
      inputs[inputs.length - 1]?.focus();
    };
  });
  $('#productSelect').onchange = (e) => { db.current = e.target.value; renderAll(); };
  $('#newProduct').onclick = () => { const p = blankProduct(); db.products.push(p); db.current = p.id; renderAll(); $('#name').select(); };
  $('#dupProduct').onclick = () => {
    const p = JSON.parse(JSON.stringify(cur())); p.id = uid(); p.name += ' (สำเนา)';
    db.products.push(p); db.current = p.id; renderAll();
  };
  $('#delProduct').onclick = () => {
    if (!confirm(`ลบ "${cur().name}" ?`)) return;
    db.products = db.products.filter(p => p.id !== db.current);
    if (!db.products.length) db.products.push(blankProduct());
    db.current = db.products[0].id; renderAll();
  };

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('#exportCsv').onclick = () => {
    const head = ['สินค้า', 'วัตถุดิบ/ชิ้น', 'ค่าแรง/ชิ้น', 'ผันแปรอื่น/ชิ้น', 'คงที่/ชิ้น', 'ต้นทุน/ชิ้น',
      'ราคาแนะนำ', 'ราคาขาย', 'กำไร/ชิ้น', 'Margin %', 'จุดคุ้มทุน/เดือน', 'กำไร/เดือน'];
    const r2 = (n) => Number.isFinite(n) ? n.toFixed(2) : '';
    const lines = db.products.map(p => {
      const r = calc(p);
      return [p.name, r2(r.mat), r2(r.lab), r2(r.ext), r2(r.fix), r2(r.cost), r2(r.suggest), r2(r.price),
        r2(r.profit), r2(r.margin * 100), Number.isFinite(r.breakeven) ? r.breakeven : '', r2(r.monthlyProfit)];
    });
    const csv = [head, ...lines].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('cost-summary.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8'); // BOM ให้ Excel อ่านภาษาไทยได้
  };
  $('#exportJson').onclick = () => download(`cost-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json');
  $('#importJson').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.products)) throw new Error();
      if (!confirm(`นำเข้า ${data.products.length} สินค้า? (จะแทนที่ข้อมูลปัจจุบัน)`)) return;
      db = data; if (!db.products.find(p => p.id === db.current)) db.current = db.products[0].id;
      renderAll();
    } catch { alert('ไฟล์ไม่ถูกต้อง'); }
    e.target.value = '';
  };
  $('#printBtn').onclick = () => window.print();

  // มือถือ: แตะแถบล่างเพื่อเลื่อนไปดูสรุป และซ่อนแถบเมื่อสรุปอยู่บนจอแล้ว
  $('#mobilebar').onclick = () => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => $('#mobilebar').classList.toggle('hide', e.isIntersecting), { threshold: 0.15 })
      .observe($('#results'));
  }
  // ใช้งานออฟไลน์ได้หลังเปิดครั้งแรก
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  load(); bindFields(); renderAll();
})();
