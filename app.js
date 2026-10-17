/* คุ้มครัว — คำนวณต้นทุนร้านอาหาร/เครื่องดื่ม (vanilla JS, ไม่ต้อง build) */
(() => {
  'use strict';
  const { UNITS, BASE_UNIT, CATS, BASE_INGS, DEFAULT_PLATFORMS } = window.KC_DATA;
  const KEY = 'khumkrua:v1';

  // ================= utils =================
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const nf2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
  const nfq = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
  const baht = (n, dp = 2) => (n < 0 ? '-฿' : '฿') + (dp ? nf2 : nf0).format(Math.abs(n || 0));
  const pct = (r, dp = 1) => (Number.isFinite(r) ? (r * 100).toFixed(dp) : '0') + '%';
  const today = () => new Date().toISOString().slice(0, 10);
  const thDate = (iso) => { try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return iso; } };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const catOf = (id) => CATS.find(c => c.id === id) || CATS[CATS.length - 1];

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ================= store =================
  const defaults = () => ({
    v: 1,
    settings: { shopName: 'ร้านของฉัน', vat: 7, fc: 35, magic: true, gasPrice: 420, gasHours: 15, platforms: clone(DEFAULT_PLATFORMS) },
    ings: [], menus: [], tx: [],
    be: { labor: 0, rent: 0, utility: 0, other: 0, ads: 0, days: 30, profitOn: true, profit: 15, fcManual: '' },
    sample: false,
  });

  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db || !Array.isArray(db.ings)) { db = defaults(); seedSample(); }
    const d = defaults();
    db.settings = Object.assign(d.settings, db.settings || {});
    db.be = Object.assign(d.be, db.be || {});
    if (!Array.isArray(db.tx)) db.tx = [];
  }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch { toast('⚠️ พื้นที่เก็บข้อมูลเต็ม ลองลบรูปเมนูบางรูป หรือสำรองข้อมูลไว้'); }
    }, 150);
  }

  function seedSample() {
    const mk = (name, cat, unit, buyQty, buyPrice, yieldPct = 100, oldPrice) => {
      const ing = { id: uid(), name, cat, unit, buyQty, buyPrice, yield: yieldPct, history: [], updatedAt: today() };
      if (oldPrice) ing.history.push({ d: daysAgo(30), p: oldPrice / buyQty });
      ing.history.push({ d: today(), p: buyPrice / buyQty });
      db.ings.push(ing); return ing.id;
    };
    const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const beef = mk('เนื้อวัวสไลซ์', 'meat', 'กก.', 1, 380, 90, 350);
    const pork = mk('หมูสับ', 'meat', 'กก.', 1, 140, 100, 150);
    const egg = mk('ไข่ไก่', 'dairy', 'ฟอง', 30, 135);
    const rice = mk('ข้าวหอมมะลิ', 'grain', 'กก.', 5, 210);
    const sauce = mk('ซอสผัด (สูตรร้าน)', 'sauce', 'ลิตร', 1, 95);
    const garlic = mk('กระเทียม', 'veg', 'กก.', 1, 90);
    const basil = mk('ใบกะเพรา', 'veg', 'กก.', 1, 80, 70);
    const chili = mk('พริกขี้หนู', 'veg', 'กก.', 1, 120);
    const oil = mk('น้ำมันพืช', 'sauce', 'ลิตร', 1, 52);
    const tea = mk('ผงชาไทย', 'drink', 'กก.', 0.4, 120);
    const milk = mk('นมข้นหวาน', 'dairy', 'กระป๋อง', 1, 28);
    const evap = mk('นมข้นจืด', 'dairy', 'กระป๋อง', 1, 25);
    const ice = mk('น้ำแข็ง', 'drink', 'กก.', 20, 40);
    const size = (label, items, extra = {}) => Object.assign({ id: uid(), label, servings: 1, items, pack: 0, cookMin: 0, labor: 0, other: 0, fc: '', price: '' }, extra);
    const it = (ingId, qty, unit) => ({ ingId, qty, unit });
    db.menus.push({
      id: uid(), name: 'ข้าวผัดเนื้อ', type: 'food', photo: '', createdAt: today(), updatedAt: today(),
      steps: 'ตั้งกระทะไฟแรง ใส่น้ำมันและกระเทียม ผัดจนหอม\nใส่เนื้อ ผัดพอสุก แล้วตอกไข่ลงไป\nใส่ข้าว ผัดให้เข้ากัน ปรุงด้วยซอสผัด\nตักใส่จาน โรยต้นหอม',
      sizes: [
        size('ธรรมดา', [it(beef, 80, 'กรัม'), it(egg, 1, 'ฟอง'), it(rice, 200, 'กรัม'), it(sauce, 3, 'ช้อนชา'), it(garlic, 10, 'กรัม'), it(oil, 1, 'ช้อนโต๊ะ')], { pack: 7.3, cookMin: 5 }),
        size('พิเศษ', [it(beef, 130, 'กรัม'), it(egg, 1, 'ฟอง'), it(rice, 250, 'กรัม'), it(sauce, 4, 'ช้อนชา'), it(garlic, 12, 'กรัม'), it(oil, 1, 'ช้อนโต๊ะ')], { pack: 7.3, cookMin: 6 }),
      ],
    });
    db.menus.push({
      id: uid(), name: 'กะเพราหมูสับไข่ดาว', type: 'food', photo: '', createdAt: today(), updatedAt: today(),
      steps: 'ทอดไข่ดาวพักไว้\nโขลกพริกกับกระเทียม ผัดกับน้ำมันจนหอม\nใส่หมูสับ ผัดจนสุก ปรุงด้วยซอสผัด\nใส่ใบกะเพรา ผัดพอสลด ตักราดข้าว วางไข่ดาว',
      sizes: [size('ธรรมดา', [it(pork, 100, 'กรัม'), it(egg, 1, 'ฟอง'), it(rice, 200, 'กรัม'), it(basil, 15, 'กรัม'), it(chili, 8, 'กรัม'), it(garlic, 10, 'กรัม'), it(sauce, 3, 'ช้อนชา'), it(oil, 2, 'ช้อนโต๊ะ')], { pack: 7.3, cookMin: 6 })],
    });
    db.menus.push({
      id: uid(), name: 'ชาไทยเย็น', type: 'drink', photo: '', createdAt: today(), updatedAt: today(),
      steps: 'ชงชาไทยกับน้ำร้อน 90°C แช่ 5 นาที แล้วกรอง\nผสมนมข้นหวานและนมข้นจืด คนให้เข้ากัน\nใส่น้ำแข็งเต็มแก้ว ราดชา',
      sizes: [
        size('M', [it(tea, 15, 'กรัม'), it(milk, 0.15, 'กระป๋อง'), it(evap, 0.1, 'กระป๋อง'), it(ice, 250, 'กรัม')], { pack: 4.5, fc: 25 }),
        size('L', [it(tea, 20, 'กรัม'), it(milk, 0.2, 'กระป๋อง'), it(evap, 0.15, 'กระป๋อง'), it(ice, 350, 'กรัม')], { pack: 5.5, fc: 25 }),
      ],
    });
    db.be = Object.assign(db.be, { labor: 20000, rent: 1500, utility: 3000, other: 10000, ads: 0 });
    db.sample = true;
  }

  const getIng = (id) => db.ings.find(i => i.id === id);
  const getMenu = (id) => db.menus.find(m => m.id === id);

  // ================= calculations =================
  const unitInfo = (u) => UNITS[u] || UNITS['ชิ้น'];
  const unitsOfDim = (dim) => Object.keys(UNITS).filter(u => UNITS[u].dim === dim);
  // ราคาต่อหน่วยที่ซื้อ (หลังหักส่วนสูญเสีย)
  function pricePerBuyUnit(ing) {
    const q = num(ing.buyQty); if (!q) return 0;
    const y = Math.min(100, Math.max(1, num(ing.yield) || 100)) / 100;
    return num(ing.buyPrice) / q / y;
  }
  const pricePerBase = (ing) => pricePerBuyUnit(ing) / unitInfo(ing.unit).f;
  function itemCost(it) {
    const ing = getIng(it.ingId); if (!ing) return 0;
    const iu = unitInfo(ing.unit), u = UNITS[it.unit] || iu;
    if (u.dim !== iu.dim) return 0;
    return pricePerBase(ing) * num(it.qty) * u.f;
  }
  const gasPerMin = () => num(db.settings.gasPrice) / Math.max(1, num(db.settings.gasHours) * 60);
  function magic(x) {
    if (!(x > 0)) return 0;
    let n = Math.ceil(x - 1e-9);
    while (![0, 5, 9].includes(n % 10)) n++;
    return n;
  }
  const roundPrice = (x) => db.settings.magic ? magic(x) : Math.round(x * 100) / 100;
  const gpRate = (gp) => (num(gp) / 100) * (1 + num(db.settings.vat) / 100);

  function calcSize(size) {
    const serv = Math.max(1, num(size.servings) || 1);
    const mat = size.items.reduce((s, it) => s + itemCost(it), 0) / serv;
    const pack = num(size.pack);
    const gas = (num(size.cookMin) * gasPerMin()) / serv;
    const labor = num(size.labor), other = num(size.other);
    const total = mat + pack + gas + labor + other;
    const fcT = (num(size.fc) || num(db.settings.fc) || 35) / 100;
    const suggested = mat > 0 ? roundPrice(mat / fcT) : 0;
    const manual = num(size.price) > 0;
    const price = manual ? num(size.price) : suggested;
    const profit = price - total;
    const delivery = db.settings.platforms.map(p => {
      const r = gpRate(p.gp);
      const dp = r < 1 && price > 0 ? roundPrice(price / (1 - r)) : 0;
      const fee = dp * r;
      return { ...p, price: dp, fee, profit: dp - fee - total };
    });
    return {
      serv, mat, pack, gas, labor, other, total, fcT, suggested, manual, price, profit,
      margin: price > 0 ? profit / price : 0,
      fc: price > 0 ? mat / price : 0,
      variable: price > 0 ? (mat + pack + gas + other) / price : 0,
      delivery,
    };
  }
  const allSizes = () => db.menus.flatMap(m => m.sizes.map(s => ({ m, s, c: calcSize(s) })));
  function shopStats() {
    const rows = allSizes().filter(r => r.c.price > 0 && r.c.mat > 0);
    const avg = (f) => rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0;
    return {
      n: rows.length,
      fc: avg(r => r.c.fc), variable: avg(r => r.c.variable),
      cost: avg(r => r.c.total), price: avg(r => r.c.price), margin: avg(r => r.c.margin),
    };
  }
  function fcRating(r) {
    if (!(r > 0)) return { t: '-', cls: '' };
    if (r <= 0.35) return { t: 'ดีมาก', cls: 'good', ic: '✅' };
    if (r <= 0.40) return { t: 'พอใช้', cls: 'warn', ic: '⚠️' };
    return { t: 'สูงไป ควรปรับ', cls: 'bad', ic: '🔺' };
  }
  const meterCls = (r) => r <= 0.35 ? '' : r <= 0.40 ? 'warn' : 'bad';
  const menusUsing = (ingId) => db.menus.filter(m => m.sizes.some(s => s.items.some(i => i.ingId === ingId)));
  const fmtQty = (q, u) => `${nfq.format(num(q))} ${u}`;
  function trend(ing) {
    const h = ing.history || []; if (h.length < 2) return null;
    const a = h[h.length - 2].p, b = h[h.length - 1].p;
    if (!a || a === b) return null;
    return { up: b > a, ch: (b - a) / a };
  }

  // ================= router & views =================
  let route = 'home';
  const ui = { month: '', menuType: 'all', menuQ: '', ingTab: 'mine', ingCat: 'all', ingQ: '' };

  function go(r) { route = r; location.hash = r; render(); window.scrollTo(0, 0); }
  function render() {
    $('#shopName').textContent = db.settings.shopName || 'คุ้มครัว';
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === route));
    const v = $('#view');
    const fn = { home: vHome, menus: vMenus, ings: vIngs, breakeven: vBreakeven, settings: vSettings, money: vMoney }[route] || vHome;
    v.innerHTML = fn();
    const fab = { menus: '<button class="btn fab" data-act="newMenu">＋ เมนูใหม่</button>', ings: '<button class="btn fab" data-act="newIng">＋ เพิ่มเอง</button>', money: '<button class="btn fab" data-act="newTx">＋ บันทึก</button>' }[route];
    if (fab) v.insertAdjacentHTML('beforeend', fab);
  }

  // ---------- home ----------
  function vHome() {
    const st = shopStats(), rate = fcRating(st.fc);
    const changed = db.ings.filter(i => trend(i)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
    const risky = allSizes().filter(r => r.c.price > 0 && (r.c.profit < 0 || r.c.fc > 0.40)).slice(0, 5);
    return `
      ${db.sample ? `<div class="hint">👋 นี่คือข้อมูลตัวอย่างให้ลองเล่น เริ่มใส่ข้อมูลร้านจริงได้เลย หรือ <button class="link" data-act="clearSample">ล้างข้อมูลตัวอย่าง</button></div>` : ''}
      <div class="card hero">
        <div class="label">Food Cost เฉลี่ยของร้าน</div>
        <div class="big num ${rate.cls}">${pct(st.fc)}</div>
        <div class="meter ${meterCls(st.fc)}"><i style="width:${Math.min(100, st.fc * 100 / 0.6)}%"></i></div>
        <div class="small ${rate.cls}">${st.n ? `${rate.ic || ''} ${rate.t} · เป้าหมายทั่วไป 25–35%` : 'ยังไม่มีเมนูที่ตั้งราคา'}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="ic">🍽️</div><div class="v num">${db.menus.length}</div><div class="k">เมนูทั้งหมด</div></div>
        <div class="stat"><div class="ic">📦</div><div class="v num">${db.ings.length}</div><div class="k">วัตถุดิบในคลัง</div></div>
        <div class="stat"><div class="ic">💰</div><div class="v num">${baht(st.cost, 0)}</div><div class="k">ต้นทุนเฉลี่ย/จาน</div></div>
        <div class="stat"><div class="ic">📈</div><div class="v num ${st.margin < 0 ? 'bad' : ''}">${pct(st.margin)}</div><div class="k">กำไรขั้นต้นเฉลี่ย</div></div>
      </div>
      ${homeMoneyCard()}
      <div class="grid2" style="margin-bottom:12px">
        <button class="btn" data-act="newMenu">＋ เพิ่มเมนู</button>
        <button class="btn soft" data-go="breakeven">🎯 จุดคุ้มทุน</button>
      </div>
      ${risky.length ? `<div class="card"><h2>⚠️ เมนูที่ควรดูราคาใหม่</h2><div class="sub">Food Cost เกิน 40% หรือขายขาดทุน</div>
        ${risky.map(r => `<div class="plat" data-act="openMenu" data-id="${r.m.id}" style="cursor:pointer"><span>${esc(r.m.name)}${r.m.sizes.length > 1 ? ` · ${esc(r.s.label)}` : ''}</span><b class="${r.c.profit < 0 ? 'bad' : 'warn'}">${r.c.profit < 0 ? 'ขาดทุน ' + baht(r.c.profit) : 'FC ' + pct(r.c.fc)}</b></div>`).join('')}</div>` : ''}
      <div class="card"><h2>📊 ราคาวัตถุดิบที่เปลี่ยนล่าสุด</h2>
        ${changed.length ? changed.map(i => { const t = trend(i), n = menusUsing(i.id).length; return `<div class="plat" data-act="editIng" data-id="${i.id}" style="cursor:pointer"><span>${esc(i.name)} <span class="tag ${t.up ? 'up' : 'down'}">${t.up ? '▲' : '▼'} ${pct(Math.abs(t.ch))}</span><br><small class="muted">กระทบ ${n} เมนู · ${thDate(i.updatedAt)}</small></span><b class="num">${baht(pricePerBuyUnit(i))}/${esc(i.unit)}</b></div>`; }).join('')
          : '<div class="muted small">เมื่อแก้ราคาวัตถุดิบ ระบบจะเก็บประวัติและคำนวณต้นทุนทุกเมนูที่ใช้วัตถุดิบนั้นใหม่ให้อัตโนมัติ</div>'}
      </div>`;
  }

  // ---------- menus ----------
  function vMenus() {
    const q = ui.menuQ.trim().toLowerCase();
    const list = db.menus.filter(m => (ui.menuType === 'all' || m.type === ui.menuType) && (!q || m.name.toLowerCase().includes(q)));
    const count = (t) => db.menus.filter(m => t === 'all' || m.type === t).length;
    return `
      <div class="page-title"><h1>เมนู</h1></div>
      <div class="search"><input type="search" placeholder="ค้นหาเมนู" value="${esc(ui.menuQ)}" data-ui="menuQ"></div>
      <div class="chips">
        ${[['all', 'ทั้งหมด'], ['food', '🍛 อาหาร'], ['drink', '🧋 เครื่องดื่ม']].map(([k, l]) => `<button class="chip ${ui.menuType === k ? 'on' : ''}" data-act="menuType" data-v="${k}">${l} (${count(k)})</button>`).join('')}
      </div>
      <div class="list">
        ${list.length ? list.map(menuItem).join('') : `<div class="empty"><div class="e">🍳</div>${db.menus.length ? 'ไม่พบเมนู' : 'ยังไม่มีเมนู กด “＋ เมนูใหม่” เพื่อเริ่ม'}</div>`}
      </div>`;
  }
  function menuItem(m) {
    const cs = m.sizes.map(calcSize), c = cs[0] || calcSize({ items: [] });
    const r = fcRating(c.fc);
    return `<button class="item" data-act="openMenu" data-id="${m.id}">
      <div class="thumb">${m.photo ? `<img src="${m.photo}" alt="">` : (m.type === 'drink' ? '🧋' : '🍛')}</div>
      <div class="grow"><div class="t">${esc(m.name)}</div>
        <div class="s">${m.sizes.length > 1 ? m.sizes.map(s => esc(s.label)).join(' / ') + ' · ' : ''}ทุน ${baht(c.total)}</div>
        <div class="s ${r.cls}">FC ${pct(c.fc)} · กำไร ${baht(c.profit)}</div></div>
      <div class="r"><b>${baht(c.price, 0)}</b><span class="s muted">หน้าร้าน</span></div>
    </button>`;
  }

  // ---------- ingredients ----------
  function vIngs() {
    const q = ui.ingQ.trim().toLowerCase();
    const mine = ui.ingTab === 'mine';
    const have = new Set(db.ings.map(i => i.name));
    const src = mine ? db.ings : BASE_INGS;
    const list = src.filter(i => (ui.ingCat === 'all' || i.cat === ui.ingCat) && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => mine ? a.name.localeCompare(b.name, 'th') : 0);
    return `
      <div class="page-title"><h1>คลังวัตถุดิบ</h1></div>
      <div class="seg">
        <button class="${mine ? 'on' : ''}" data-act="ingTab" data-v="mine">📋 ของฉัน (${db.ings.length})</button>
        <button class="${!mine ? 'on' : ''}" data-act="ingTab" data-v="base">📦 พื้นฐาน (${BASE_INGS.length})</button>
      </div>
      <div class="search"><input type="search" placeholder="ค้นหาวัตถุดิบ" value="${esc(ui.ingQ)}" data-ui="ingQ"></div>
      <div class="chips">
        <button class="chip ${ui.ingCat === 'all' ? 'on' : ''}" data-act="ingCat" data-v="all">ทั้งหมด</button>
        ${CATS.map(c => `<button class="chip ${ui.ingCat === c.id ? 'on' : ''}" data-act="ingCat" data-v="${c.id}">${c.icon} ${c.name}</button>`).join('')}
      </div>
      ${!mine ? `<div class="hint">กรอกจำนวนที่ซื้อและราคารวมจากใบเสร็จ แล้วกด ＋ ระบบจะคิดราคาต่อหน่วยให้</div>` : ''}
      <div class="list">
        ${list.length ? list.map(i => mine ? ingItem(i) : baseItem(i, have.has(i.name))).join('')
          : `<div class="empty"><div class="e">🥬</div>${mine && !db.ings.length ? 'ยังไม่มีวัตถุดิบ เลือกจากแท็บ “พื้นฐาน” หรือกด “＋ เพิ่มเอง”' : 'ไม่พบวัตถุดิบ'}</div>`}
      </div>`;
  }
  function ingItem(i) {
    const t = trend(i), n = menusUsing(i.id).length;
    return `<button class="item" data-act="editIng" data-id="${i.id}">
      <div class="thumb">${catOf(i.cat).icon}</div>
      <div class="grow"><div class="t">${esc(i.name)}</div>
        <div class="s">ใช้ใน ${n} เมนู${num(i.yield) && num(i.yield) < 100 ? ` · ใช้ได้จริง ${num(i.yield)}%` : ''}</div></div>
      <div class="r"><b>${baht(pricePerBuyUnit(i))}</b><span class="s muted">/${esc(i.unit)}</span>
        ${t ? `<div><span class="tag ${t.up ? 'up' : 'down'}">${t.up ? '▲' : '▼'} ${pct(Math.abs(t.ch), 0)}</span></div>` : ''}</div>
    </button>`;
  }
  function baseItem(b, inLib) {
    return `<div class="card" style="margin:0">
      <div class="row between"><div><b>${esc(b.name)}</b><div class="small muted">/${esc(b.unit)}</div></div>
        ${inLib ? '<span class="good small">✓ ในคลัง</span>' : ''}</div>
      ${inLib ? '' : `<div class="add-line" data-base="${esc(b.name)}">
        <input type="number" inputmode="decimal" placeholder="จำนวน (${esc(b.unit)}) เช่น 1" class="bq">
        <input type="number" inputmode="decimal" placeholder="ราคารวม ฿" class="bp">
        <button class="btn" data-act="addBase" aria-label="เพิ่มเข้าคลัง">＋</button></div>`}
    </div>`;
  }

  // ---------- break-even ----------
  function vBreakeven() {
    const b = db.be, st = shopStats();
    const fixed = ['labor', 'rent', 'utility', 'other', 'ads'].reduce((s, k) => s + num(b[k]), 0);
    const autoV = st.variable;
    const v = b.fcManual !== '' && b.fcManual != null ? num(b.fcManual) / 100 : autoV;
    const p = b.profitOn ? num(b.profit) / 100 : 0;
    const days = Math.max(1, num(b.days) || 30);
    const denom = 1 - v - p;
    const need = denom > 0 ? fixed / denom : Infinity;
    const dishes = st.price > 0 && Number.isFinite(need) ? Math.ceil(need / days / st.price) : 0;
    const field = (k, label, hint) => `<label class="f">${label}${hint ? `<span class="small" style="font-weight:400">${hint}</span>` : ''}<input type="number" inputmode="decimal" data-be="${k}" value="${esc(b[k])}" placeholder="0"></label>`;
    return `
      <div class="page-title"><h1>🎯 จุดคุ้มทุน</h1></div>
      <div class="card"><h2>ค่าใช้จ่ายประจำเดือน</h2>
        ${field('labor', 'ค่าแรง', 'เงินเดือนพนักงาน, เงินเดือนตัวเอง')}
        ${field('rent', 'ค่าเช่า')}
        ${field('utility', 'ค่าน้ำ ค่าไฟ', 'ไม่รวมแก๊สที่คิดในต้นทุนเมนูแล้ว')}
        ${field('other', 'ค่าดำเนินการอื่นๆ', 'ค่า POS/ระบบร้าน, ค่าเสื่อม/ซ่อมบำรุง, ค่าเดินทาง/ขนส่ง')}
        ${field('ads', 'ค่าโฆษณา', 'ค่ายิงแอด, ค่าทำสื่อ, โปรโมชัน')}
        <div class="costrow total"><span>รวมค่าใช้จ่ายประจำเดือน</span><b data-out="fixed">${baht(fixed, 0)}</b></div>
      </div>
      <div class="card"><h2>ต้นทุนผันแปรต่อยอดขาย</h2>
        <div class="sub">วัตถุดิบ + บรรจุภัณฑ์ + แก๊ส เทียบกับราคาขาย</div>
        ${b.fcManual === '' || b.fcManual == null
          ? `<div class="row between"><div><div class="small muted">คำนวณอัตโนมัติจากเมนูที่บันทึกไว้</div><div class="small muted">เฉลี่ยจาก ${st.n} รายการ</div></div><b class="num" style="font-size:1.6rem;color:var(--brand)">${pct(autoV)}</b></div>
             <button class="link" data-act="fcManual">กรอกเองแทน</button>`
          : `<label class="f">% ต้นทุนผันแปร<input type="number" inputmode="decimal" data-be="fcManual" value="${esc(b.fcManual)}"></label>
             <button class="link" data-act="fcAuto">ใช้ค่าอัตโนมัติ (${pct(autoV)})</button>`}
      </div>
      <div class="card">
        <div class="toggle"><h2 style="margin:0">📈 ตั้งเป้ากำไรสุทธิ</h2><input type="checkbox" data-be="profitOn" ${b.profitOn ? 'checked' : ''}></div>
        ${b.profitOn ? `<div class="row between"><span class="muted">กำไรสุทธิ</span><b data-out="profitPct" style="color:var(--brand)">${num(b.profit)}%</b></div>
          <input type="range" min="0" max="40" step="1" data-be="profit" value="${num(b.profit)}">` : ''}
        <label class="f" style="margin-top:8px">จำนวนวันเปิดร้าน/เดือน<input type="number" inputmode="numeric" data-be="days" value="${esc(b.days)}"></label>
      </div>
      <div class="card hero" data-out="beResult">${beResult(need, days, dishes, p)}</div>`;
  }
  function beResult(need, days, dishes, p) {
    if (!Number.isFinite(need)) return `<div class="bad">ต้นทุนผันแปร + กำไรเป้าหมาย รวมกันเกิน 100% — ลดต้นทุนหรือลดเป้ากำไร</div>`;
    return `<div class="label">ต้องขายให้ได้เดือนละ ${p ? `(มีกำไร ${Math.round(p * 100)}%)` : '(เท่าทุน)'}</div>
      <div class="big num">${baht(need, 0)}</div>
      <div class="small muted">${p ? 'คุ้มค่าใช้จ่ายประจำเดือน และได้กำไรตามเป้า' : 'จุดที่ไม่ขาดทุน ไม่กำไร'}</div>
      <div class="costrow total" style="margin-top:12px"><span>ตกวันละประมาณ (${days} วัน)</span><b>${baht(need / days, 0)}</b></div>
      ${dishes ? `<div class="costrow"><span>≈ จาน/แก้วต่อวัน (ราคาเฉลี่ย ${baht(shopStats().price, 0)})</span><b>${nf0.format(dishes)}</b></div>` : ''}`;
  }

  // ---------- settings ----------
  function vSettings() {
    const s = db.settings;
    return `
      <div class="page-title"><h1>⚙️ ตั้งค่า</h1></div>
      <div class="card"><h2>ร้าน</h2>
        <label class="f">ชื่อร้าน<input type="text" data-set="shopName" value="${esc(s.shopName)}"></label>
        <label class="f">Food Cost เป้าหมายเริ่มต้น (%)<input type="number" inputmode="decimal" data-set="fc" value="${esc(s.fc)}"></label>
        <div class="toggle"><span><b>ปัดราคาเลขสวย</b><br><span class="small muted">ปัดขึ้นให้ลงท้าย 0, 5 หรือ 9 เช่น 47 → 49</span></span><input type="checkbox" data-set="magic" ${s.magic ? 'checked' : ''}></div>
      </div>
      <div class="card"><h2>🛵 แพลตฟอร์มเดลิเวอรี่</h2><div class="sub">ค่า GP คิด VAT เพิ่มอีก ${num(s.vat)}% ตามที่แพลตฟอร์มเรียกเก็บ</div>
        ${s.platforms.map((p, i) => `<div class="grid2" style="grid-template-columns:1fr 90px 36px;align-items:center;margin-bottom:8px">
          <input type="text" data-plat="${i}" data-k="name" value="${esc(p.name)}"><input type="number" inputmode="decimal" data-plat="${i}" data-k="gp" value="${esc(p.gp)}" aria-label="GP %">
          <button class="link" data-act="delPlat" data-i="${i}" aria-label="ลบ">✕</button></div>`).join('')}
        <div class="small muted" style="margin:-4px 0 8px">ช่องขวาคือ GP %</div>
        <div class="row"><button class="btn sm soft" data-act="addPlat">＋ เพิ่มแพลตฟอร์ม</button>
          <label class="row small" style="margin-left:auto">VAT %<input type="number" inputmode="decimal" data-set="vat" value="${esc(s.vat)}" style="width:70px"></label></div>
      </div>
      <div class="card"><h2>🔥 แก๊สหุงต้ม</h2><div class="sub">ใช้คิดค่าแก๊สต่อจากเวลาที่ใช้เตา</div>
        <div class="grid2">
          <label class="f">ราคาถัง (฿)<input type="number" inputmode="decimal" data-set="gasPrice" value="${esc(s.gasPrice)}"></label>
          <label class="f">ใช้ได้กี่ชั่วโมง/ถัง<input type="number" inputmode="decimal" data-set="gasHours" value="${esc(s.gasHours)}"></label>
        </div>
        <div class="small muted" data-out="gasRate">= ${baht(gasPerMin())} ต่อนาที</div>
      </div>
      <div class="card"><h2>💾 ข้อมูล</h2><div class="sub">ข้อมูลเก็บในเครื่องนี้ สำรองไว้เป็นไฟล์เพื่อย้ายเครื่องหรือกันหาย</div>
        <div class="grid2">
          <button class="btn ghost" data-act="exportJson">⬇ สำรองข้อมูล</button>
          <label class="btn ghost">⬆ นำเข้า<input type="file" accept="application/json" data-act-change="importJson" hidden></label>
          <button class="btn ghost" data-act="exportCsv">⬇ ตารางเมนู (CSV)</button>
          <button class="btn danger" data-act="resetAll">ล้างข้อมูลทั้งหมด</button>
        </div>
      </div>
      <p class="center small muted">คุ้มครัว · ใช้งานฟรี ข้อมูลไม่ถูกส่งออกจากเครื่อง</p>`;
  }

  // ================= บัญชีรายรับรายจ่าย =================
  const EXP_CATS = [
    { id: 'ing', name: 'วัตถุดิบ', ic: '🥩' }, { id: 'pack', name: 'บรรจุภัณฑ์', ic: '🛍️' },
    { id: 'gas', name: 'แก๊ส', ic: '🔥' }, { id: 'labor', name: 'ค่าแรง', ic: '👤' },
    { id: 'rent', name: 'ค่าเช่า', ic: '🏠' }, { id: 'utility', name: 'ค่าน้ำ ค่าไฟ', ic: '💡' },
    { id: 'ads', name: 'โฆษณา', ic: '📣' }, { id: 'repair', name: 'ซ่อม/อุปกรณ์', ic: '🛠️' },
    { id: 'ex_other', name: 'อื่นๆ', ic: '📦' },
  ];
  const incCats = () => [
    { id: 'store', name: 'ขายหน้าร้าน', ic: '🏪', gp: 0 },
    ...db.settings.platforms.map(p => ({ id: 'p_' + p.id, name: p.name, ic: '🛵', gp: num(p.gp) })),
    { id: 'in_other', name: 'รายรับอื่นๆ', ic: '💰', gp: 0 },
  ];
  const txCat = (t) => (t.type === 'in' ? incCats() : EXP_CATS).find(c => c.id === t.cat) || { id: t.cat, name: t.catName || 'อื่นๆ', ic: t.type === 'in' ? '💰' : '📦' };
  const ymNow = () => today().slice(0, 7);
  const ymLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); };
  const ymShift = (ym, d) => { const [y, m] = ym.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const monthTx = (ym) => db.tx.filter(t => (t.date || '').startsWith(ym));

  function beCalc() {
    const b = db.be, st = shopStats();
    const fixed = ['labor', 'rent', 'utility', 'other', 'ads'].reduce((s, k) => s + num(b[k]), 0);
    const v = b.fcManual !== '' && b.fcManual != null ? num(b.fcManual) / 100 : st.variable;
    const p = b.profitOn ? num(b.profit) / 100 : 0;
    const den = 1 - v - p;
    return { fixed, need: den > 0 ? fixed / den : Infinity, breakEven: (1 - v) > 0 ? fixed / (1 - v) : Infinity };
  }

  function monthSummary(ym) {
    const list = monthTx(ym);
    const sum = (f) => list.filter(f).reduce((s, t) => s + num(t.amount), 0);
    const inc = sum(t => t.type === 'in'), exp = sum(t => t.type === 'out');
    const by = (type) => {
      const m = {};
      list.filter(t => t.type === type).forEach(t => { const c = txCat(t); (m[c.id] ||= { ...c, v: 0 }).v += num(t.amount); });
      return Object.values(m).sort((a, b) => b.v - a.v);
    };
    const cogs = list.filter(t => t.type === 'in').reduce((s, t) => s + num(t.cogs), 0);
    const salesNet = list.filter(t => t.type === 'in' && t.items).reduce((s, t) => s + num(t.amount), 0);
    return { list, inc, exp, net: inc - exp, inBy: by('in'), outBy: by('out'), cogs, salesNet };
  }

  function homeMoneyCard() {
    const ym = ymNow(), s = monthSummary(ym);
    if (!db.tx.length) return `<div class="card"><div class="row between"><div><b>💵 บัญชีรายรับรายจ่าย</b><div class="small muted">บันทึกยอดขายและค่าใช้จ่าย ดูกำไรจริงรายเดือน</div></div><button class="btn sm" data-go="money">เริ่ม</button></div></div>`;
    return `<div class="card" data-go="money" style="cursor:pointer"><div class="row between"><b>💵 เดือนนี้ (${ymLabel(ym)})</b><span class="small muted">ดูบัญชี ›</span></div>
      <div class="grid2" style="margin-top:8px"><div><div class="small muted">รายรับ</div><b class="in num">${baht(s.inc, 0)}</b></div><div><div class="small muted">รายจ่าย</div><b class="out num">${baht(s.exp, 0)}</b></div></div>
      <div class="costrow total"><span>${s.net >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</span><b class="${s.net >= 0 ? 'good' : 'bad'}">${baht(s.net, 0)}</b></div></div>`;
  }

  function dailyBars(ym, list) {
    const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate();
    const inD = Array(n).fill(0), outD = Array(n).fill(0);
    list.forEach(t => { const d = num(t.date.slice(8, 10)) - 1; if (d >= 0 && d < n) (t.type === 'in' ? inD : outD)[d] += num(t.amount); });
    const mx = Math.max(1, ...inD, ...outD), W = 320, H = 110, bw = W / n;
    const bars = inD.map((v, i) => {
      const hi = v / mx * (H - 16), ho = outD[i] / mx * (H - 16), x = i * bw;
      return `${v ? `<rect x="${x + bw * .12}" y="${H - 12 - hi}" width="${bw * .36}" height="${hi}" rx="1.5" fill="#14b8a6"/>` : ''}${outD[i] ? `<rect x="${x + bw * .52}" y="${H - 12 - ho}" width="${bw * .36}" height="${ho}" rx="1.5" fill="#f97316"/>` : ''}`;
    }).join('');
    const ticks = [1, 10, 20, n].map(d => `<text x="${(d - .5) * bw}" y="${H - 1}" font-size="8" text-anchor="middle" fill="currentColor" opacity=".55">${d}</text>`).join('');
    return `<svg class="bars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="กราฟรายรับรายจ่ายรายวัน">${bars}${ticks}</svg>
      <div class="row small muted" style="gap:14px;justify-content:center"><span><b style="color:#14b8a6">■</b> รายรับ</span><span><b style="color:#f97316">■</b> รายจ่าย</span></div>`;
  }

  function vMoney() {
    const ym = ui.month || ymNow(), s = monthSummary(ym), be = beCalc();
    const days = {};
    [...s.list].sort((a, b) => (b.date + (b.ts || '')).localeCompare(a.date + (a.ts || ''))).forEach(t => (days[t.date] ||= []).push(t));
    const catBlock = (rows, total, cls) => rows.map(c => `<div class="catrow"><div class="row between"><span>${c.ic} ${esc(c.name)}</span><b class="num">${baht(c.v, 0)} <small class="muted">${pct(total ? c.v / total : 0, 0)}</small></b></div><div class="meter ${cls}"><i style="width:${total ? c.v / total * 100 : 0}%"></i></div></div>`).join('');
    const target = Number.isFinite(be.need) && be.need > 0 ? be.need : 0;
    return `
      <div class="page-title"><h1>💵 บัญชี</h1><button class="btn sm ghost" data-act="exportTxCsv">⬇ CSV</button></div>
      <div class="monthbar"><button class="iconbtn" data-act="monthPrev" aria-label="เดือนก่อน">‹</button><b>${ymLabel(ym)}</b><button class="iconbtn" data-act="monthNext" aria-label="เดือนถัดไป" ${ym >= ymNow() ? 'disabled style="opacity:.35"' : ''}>›</button></div>
      <div class="pl">
        <div class="stat"><div class="k">รายรับ</div><div class="v in num">${baht(s.inc, 0)}</div></div>
        <div class="stat"><div class="k">รายจ่าย</div><div class="v out num">${baht(s.exp, 0)}</div></div>
      </div>
      <div class="net ${s.net < 0 ? 'neg' : ''}"><div class="small muted">${s.net >= 0 ? 'กำไรสุทธิเดือนนี้' : 'ขาดทุนสุทธิเดือนนี้'}</div><div class="v num ${s.net >= 0 ? 'good' : 'bad'}">${baht(s.net, 0)}</div>
        ${s.inc ? `<div class="small muted">อัตรากำไรสุทธิ ${pct(s.net / s.inc)}</div>` : ''}</div>
      <div class="grid2" style="margin:12px 0">
        <button class="btn" data-act="newSale">🧾 บันทึกยอดขาย</button>
        <button class="btn accent" data-act="newTx" data-v="out">－ บันทึกรายจ่าย</button>
      </div>
      ${target ? `<div class="card"><div class="row between"><b>🎯 ยอดขายเทียบเป้า</b><span class="small muted">เป้า ${baht(target, 0)}</span></div>
        <div class="meter ${s.inc >= target ? '' : s.inc >= be.breakEven ? 'warn' : 'bad'}"><i style="width:${Math.min(100, s.inc / target * 100)}%"></i></div>
        <div class="small ${s.inc >= target ? 'good' : 'muted'}">${s.inc >= target ? '✅ ถึงเป้าแล้ว!' : `ขาดอีก ${baht(target - s.inc, 0)}${ym === ymNow() ? ` · ${s.inc >= be.breakEven ? 'ผ่านจุดคุ้มทุนแล้ว' : `จุดคุ้มทุน ${baht(be.breakEven, 0)}`}` : ''}`}</div></div>` : ''}
      ${s.list.length ? `
        <div class="card"><h2>รายวัน</h2>${dailyBars(ym, s.list)}</div>
        ${s.inBy.length ? `<div class="card"><h2>รายรับตามช่องทาง</h2>${catBlock(s.inBy, s.inc, '')}
          ${s.cogs ? `<div class="hint">ขายจากเมนู ${baht(s.salesNet, 0)} · ต้นทุนวัตถุดิบตามสูตรประมาณ ${baht(s.cogs, 0)} (${pct(s.salesNet ? s.cogs / s.salesNet : 0)})</div>` : ''}</div>` : ''}
        ${s.outBy.length ? `<div class="card"><h2>รายจ่ายตามหมวด</h2>${catBlock(s.outBy, s.exp, 'bad')}</div>` : ''}
        <h2 style="font-size:1.02rem;margin:16px 0 0">รายการ</h2>
        ${Object.entries(days).map(([d, ts]) => {
          const di = ts.filter(t => t.type === 'in').reduce((a, t) => a + num(t.amount), 0), dout = ts.filter(t => t.type === 'out').reduce((a, t) => a + num(t.amount), 0);
          return `<div class="daygrp"><span>${thDate(d)}</span><span>${di ? `<span class="in">+${nf0.format(di)}</span>` : ''} ${dout ? `<span class="out">−${nf0.format(dout)}</span>` : ''}</span></div>` +
            ts.map(t => { const c = txCat(t); return `<button class="tx" data-act="editTx" data-id="${t.id}"><div class="ic">${c.ic}</div><div class="grow"><div class="t">${esc(c.name)}</div>${t.note ? `<div class="s">${esc(t.note)}</div>` : ''}</div><div class="a ${t.type === 'in' ? 'in' : 'out'}">${t.type === 'in' ? '+' : '−'}${baht(t.amount, num(t.amount) % 1 ? 2 : 0)}</div></button>`; }).join('');
        }).join('')}
        <div style="text-align:center;margin-top:12px"><button class="btn sm soft" data-act="newTx" data-v="in">＋ รายรับอื่นๆ</button></div>`
      : `<div class="empty"><div class="e">🧾</div>ยังไม่มีรายการใน${ymLabel(ym)}<br><span class="small">กด “บันทึกยอดขาย” เพื่อลงยอดจากเมนู หรือ “บันทึกรายจ่าย” เมื่อซื้อของ</span></div>`}`;
  }

  // ---------- รายรับ/รายจ่ายทั่วไป ----------
  function txSheet(type = 'out', id = null) {
    const ex = id ? db.tx.find(t => t.id === id) : null;
    if (ex && ex.items) { saleSheet(id); return; }
    const d = ex ? clone(ex) : { id: uid(), type, date: ui.month && ui.month !== ymNow() ? ui.month + '-01' : today(), amount: '', cat: type === 'in' ? 'store' : 'ing', note: '' };
    const draw = () => {
      const cats = d.type === 'in' ? incCats() : EXP_CATS;
      const isIng = d.type === 'out' && d.cat === 'ing';
      const ing = d.ingId ? getIng(d.ingId) : null;
      $('#txBody').innerHTML = `
        ${ex ? '' : `<div class="seg"><button class="${d.type === 'in' ? 'on' : ''}" data-tx="type" data-v="in">＋ รายรับ</button><button class="${d.type === 'out' ? 'on' : ''}" data-tx="type" data-v="out">－ รายจ่าย</button></div>`}
        <label class="f">จำนวนเงิน (฿)<input type="number" inputmode="decimal" id="txAmt" value="${esc(d.amount)}" placeholder="0" style="font-size:1.6rem;font-weight:700;color:${d.type === 'in' ? 'var(--good)' : 'var(--bad)'}"></label>
        <div class="small muted" style="margin-bottom:6px">หมวด</div>
        <div class="chips" style="flex-wrap:wrap">${cats.map(c => `<button class="chip ${c.id === d.cat ? 'on' : ''}" data-tx="cat" data-v="${c.id}">${c.ic} ${esc(c.name)}</button>`).join('')}</div>
        ${isIng ? `<div class="card" style="background:var(--soft);box-shadow:none"><b>🥩 ซื้อวัตถุดิบอะไร (ไม่บังคับ)</b>
          <div class="small muted" style="margin-bottom:8px">ใส่แล้วระบบอัปเดตราคาในคลังวัตถุดิบ ต้นทุนเมนูจะคำนวณใหม่ให้</div>
          <select id="txIng"><option value="">— ไม่ระบุ —</option>${[...db.ings].sort((a, b) => a.name.localeCompare(b.name, 'th')).map(i => `<option value="${i.id}" ${i.id === d.ingId ? 'selected' : ''}>${esc(i.name)} (ตอนนี้ ${baht(num(i.buyQty) ? num(i.buyPrice) / num(i.buyQty) : 0)}/${esc(i.unit)})</option>`).join('')}</select>
          ${ing ? `<label class="f" style="margin-top:8px">จำนวนที่ซื้อ (${esc(ing.unit)})<input type="number" inputmode="decimal" id="txIngQty" value="${esc(d.ingQty ?? '')}" placeholder="เช่น 2"></label>
            <div class="small muted" id="txIngOut"></div>
            <label class="toggle"><span>อัปเดตราคาในคลังด้วย</span><input type="checkbox" id="txIngUpd" ${d.ingUpd === false ? '' : 'checked'}></label>` : ''}
        </div>` : ''}
        <div class="grid2">
          <label class="f">วันที่<input type="date" id="txDate" value="${esc(d.date)}" max="${today()}"></label>
          <label class="f">โน้ต<input type="text" id="txNote" value="${esc(d.note)}" placeholder="${d.type === 'in' ? 'เช่น จัดเลี้ยง' : 'เช่น ตลาดเช้า'}"></label>
        </div>
        ${ex ? `<button class="btn danger block" data-act="delTx" data-id="${ex.id}">ลบรายการนี้</button>` : ''}`;
      const amt = $('#txAmt'), q = $('#txIngQty');
      const out = () => { const o = $('#txIngOut'); if (o && ing) { const qq = num(q.value), a = num(amt.value); o.textContent = qq && a ? `= ${baht(a / qq)}/${ing.unit}` : ''; } };
      amt.oninput = () => { d.amount = amt.value; out(); };
      if (q) { q.oninput = () => { d.ingQty = q.value; out(); }; out(); }
      $('#txDate').oninput = (e) => { d.date = e.target.value; };
      $('#txNote').oninput = (e) => { d.note = e.target.value; };
      const sel = $('#txIng'); if (sel) sel.onchange = () => { d.ingId = sel.value || undefined; draw(); };
      const upd = $('#txIngUpd'); if (upd) upd.onchange = () => { d.ingUpd = upd.checked; };
    };
    const sh = openSheet({ title: ex ? 'แก้ไขรายการ' : 'บันทึกรายการ', id: 'tx', body: '<div id="txBody"></div>',
      foot: '<button class="btn ghost" data-act="closeSheet">ยกเลิก</button><button class="btn" id="txSave">💾 บันทึก</button>' });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tx]'); if (!b) return;
      if (b.dataset.tx === 'type') { d.type = b.dataset.v; d.cat = d.type === 'in' ? 'store' : 'ing'; }
      if (b.dataset.tx === 'cat') d.cat = b.dataset.v;
      draw();
    });
    draw();
    setTimeout(() => $('#txAmt')?.focus(), 250);
    $('#txSave').onclick = () => {
      if (!(num(d.amount) > 0)) { toast('ใส่จำนวนเงินก่อนนะ'); return; }
      if (!d.date) d.date = today();
      d.amount = num(d.amount); d.ts = d.ts || new Date().toISOString();
      const ingNow = d.type === 'out' && d.cat === 'ing' && d.ingId ? getIng(d.ingId) : null;
      if (!ingNow) { delete d.ingId; delete d.ingQty; }
      else if (!d.note) d.note = `${ingNow.name}${num(d.ingQty) > 0 ? ` ${nfq.format(num(d.ingQty))} ${ingNow.unit}` : ''}`;
      const i = db.tx.findIndex(t => t.id === d.id);
      if (i >= 0) db.tx[i] = d; else db.tx.push(d);
      let msg = 'บันทึกแล้ว';
      if (ingNow && num(d.ingQty) > 0 && d.ingUpd !== false) {
        const newP = d.amount / num(d.ingQty), last = (ingNow.history || []).slice(-1)[0];
        ingNow.buyQty = num(d.ingQty); ingNow.buyPrice = d.amount;
        if (!last || Math.abs(last.p - newP) > 1e-9) {
          ingNow.history = ingNow.history || [];
          if (last && last.d === d.date) ingNow.history[ingNow.history.length - 1] = { d: d.date, p: newP };
          else ingNow.history.push({ d: d.date, p: newP });
          ingNow.updatedAt = d.date;
          const ch = last && last.p ? (newP - last.p) / last.p : 0;
          msg = `บันทึกแล้ว · ${ingNow.name} ${ch ? (ch > 0 ? '▲ ' : '▼ ') + pct(Math.abs(ch), 0) : ''} ต้นทุนเมนูอัปเดตแล้ว`;
        }
      }
      save(); closeSheet(); ui.month = d.date.slice(0, 7); render(); toast(msg);
    };
  }

  // ---------- บันทึกยอดขายจากเมนู ----------
  function saleSheet(id = null) {
    const ex = id ? db.tx.find(t => t.id === id) : null;
    const d = ex ? clone(ex) : { id: uid(), type: 'in', date: ui.month && ui.month !== ymNow() ? ui.month + '-01' : today(), cat: 'store', items: [], note: '' };
    const qty = {}; (d.items || []).forEach(it => { qty[it.menuId + '|' + it.sizeId] = num(it.qty); });
    let q = '';
    const priceFor = (m, s) => {
      const c = calcSize(s);
      if (d.cat === 'store') return { gross: c.price, fee: 0, cogs: c.mat + c.pack };
      const dl = c.delivery.find(x => 'p_' + x.id === d.cat);
      return dl ? { gross: dl.price, fee: dl.fee, cogs: c.mat + c.pack } : { gross: c.price, fee: 0, cogs: c.mat + c.pack };
    };
    const totals = () => {
      let gross = 0, fee = 0, cogs = 0, n = 0;
      db.menus.forEach(m => m.sizes.forEach(s => { const k = m.id + '|' + s.id, n_ = qty[k] || 0; if (!n_) return; const p = priceFor(m, s); gross += p.gross * n_; fee += p.fee * n_; cogs += p.cogs * n_; n += n_; }));
      return { gross, fee, net: gross - fee, cogs, n };
    };
    const sumHtml = () => { const t = totals(); return `
      <div class="costrow"><span>ยอดขาย ${t.n} รายการ</span><b>${baht(t.gross)}</b></div>
      ${t.fee ? `<div class="costrow"><span>หัก GP + VAT</span><b class="bad">−${baht(t.fee)}</b></div>` : ''}
      <div class="costrow total"><span>รับเงินจริง</span><b class="good" style="font-size:1.2rem">${baht(t.net)}</b></div>
      <div class="small muted">ต้นทุนวัตถุดิบ+บรรจุภัณฑ์ตามสูตร ≈ ${baht(t.cogs)}</div>`; };
    const lines = () => {
      const ql = q.trim().toLowerCase();
      const rows = db.menus.filter(m => !ql || m.name.toLowerCase().includes(ql)).flatMap(m => m.sizes.map(s => ({ m, s })));
      return rows.length ? rows.map(({ m, s }) => { const k = m.id + '|' + s.id, p = priceFor(m, s); return `<div class="sale-line"><div class="nm">${esc(m.name)}${m.sizes.length > 1 ? ` · ${esc(s.label)}` : ''}<small>${baht(p.gross, p.gross % 1 ? 2 : 0)}</small></div>
        <div class="stepper"><button data-sl="dec" data-k="${k}" aria-label="ลด">−</button><input type="number" inputmode="numeric" data-sq="${k}" value="${qty[k] || ''}" placeholder="0"><button data-sl="inc" data-k="${k}" aria-label="เพิ่ม">＋</button></div><span></span></div>`; }).join('')
        : `<div class="empty">${db.menus.length ? 'ไม่พบเมนู' : 'ยังไม่มีเมนู เพิ่มเมนูก่อน หรือใช้ “รายรับอื่นๆ”'}</div>`;
    };
    const body = `
      <div class="grid2"><label class="f">วันที่<input type="date" id="slDate" value="${esc(d.date)}" max="${today()}"></label>
        <label class="f">ช่องทาง<select id="slCh">${incCats().filter(c => c.id !== 'in_other').map(c => `<option value="${c.id}" ${c.id === d.cat ? 'selected' : ''}>${c.ic} ${esc(c.name)}${c.gp ? ` (GP ${c.gp}%)` : ''}</option>`).join('')}</select></label></div>
      <div class="search"><input type="search" id="slQ" placeholder="ค้นหาเมนู"></div>
      <div id="slLines">${lines()}</div>
      <div class="card" id="slSum" style="margin-top:12px">${sumHtml()}</div>
      <label class="f">โน้ต<input type="text" id="slNote" value="${esc(d.note)}" placeholder="เช่น ยอดปิดร้าน"></label>
      ${ex ? `<button class="btn danger block" data-act="delTx" data-id="${ex.id}">ลบรายการนี้</button>` : ''}`;
    const sh = openSheet({ title: '🧾 บันทึกยอดขาย', id: 'sale', full: true, body,
      foot: '<button class="btn ghost" data-act="closeSheet">ยกเลิก</button><button class="btn" id="slSave">💾 บันทึกยอดขาย</button>' });
    const refresh = () => { $('#slSum').innerHTML = sumHtml(); };
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sl]'); if (!b) return;
      const k = b.dataset.k; qty[k] = Math.max(0, (qty[k] || 0) + (b.dataset.sl === 'inc' ? 1 : -1));
      const inp = sh.el.querySelector(`[data-sq="${k}"]`); if (inp) inp.value = qty[k] || '';
      refresh();
    });
    sh.el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.sq) { qty[t.dataset.sq] = Math.max(0, Math.floor(num(t.value))); refresh(); }
      if (t.id === 'slQ') { q = t.value; $('#slLines').innerHTML = lines(); }
      if (t.id === 'slDate') d.date = t.value;
      if (t.id === 'slNote') d.note = t.value;
    });
    $('#slCh').onchange = (e) => { d.cat = e.target.value; $('#slLines').innerHTML = lines(); refresh(); };
    $('#slSave').onclick = () => {
      const t = totals();
      if (!t.n) { toast('เลือกจำนวนเมนูที่ขายก่อน'); return; }
      d.items = Object.entries(qty).filter(([, n]) => n > 0).map(([k, n]) => { const [menuId, sizeId] = k.split('|'); return { menuId, sizeId, qty: n }; });
      d.amount = Math.round(t.net * 100) / 100; d.gross = Math.round(t.gross * 100) / 100; d.fee = Math.round(t.fee * 100) / 100; d.cogs = Math.round(t.cogs * 100) / 100;
      if (!d.note) d.note = d.items.map(it => { const m = getMenu(it.menuId), s = m && m.sizes.find(z => z.id === it.sizeId); return m ? `${m.name}${m.sizes.length > 1 && s ? ' ' + s.label : ''} ×${it.qty}` : ''; }).filter(Boolean).join(', ');
      if (!d.date) d.date = today();
      d.ts = d.ts || new Date().toISOString();
      const i = db.tx.findIndex(x => x.id === d.id);
      if (i >= 0) db.tx[i] = d; else db.tx.push(d);
      save(); closeSheet(); ui.month = d.date.slice(0, 7); render(); toast(`บันทึกยอดขาย ${baht(d.amount, 0)} แล้ว`);
    };
  }

  function exportTxCsv() {
    const ym = ui.month || ymNow(), list = [...monthTx(ym)].sort((a, b) => a.date.localeCompare(b.date));
    const head = ['วันที่', 'ประเภท', 'หมวด/ช่องทาง', 'จำนวนเงิน', 'ยอดขายก่อนหัก GP', 'GP', 'ต้นทุนตามสูตร', 'โน้ต'];
    const rows = list.map(t => [t.date, t.type === 'in' ? 'รายรับ' : 'รายจ่าย', txCat(t).name, num(t.amount).toFixed(2), t.gross != null ? num(t.gross).toFixed(2) : '', t.fee != null ? num(t.fee).toFixed(2) : '', t.cogs != null ? num(t.cogs).toFixed(2) : '', t.note || '']);
    const csv = [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(`บัญชี-${ym}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  }

  // ================= sheets =================
  const stack = [];
  function openSheet({ title, body, foot = '', full = false, onClose, id }) {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet ${full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${title}</h2><button class="x" data-act="closeSheet" aria-label="ปิด">✕</button></div>
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
    $('#sheetRoot').appendChild(bg);
    document.body.style.overflow = 'hidden';
    const s = { el: bg, onClose, id };
    stack.push(s);
    return s;
  }
  function closeSheet() {
    const s = stack.pop(); if (!s) return;
    s.el.remove(); s.onClose && s.onClose();
    if (!stack.length) document.body.style.overflow = '';
  }
  const topSheet = () => stack[stack.length - 1];

  // ---------- menu actions (tap a menu) ----------
  function menuActions(id, sizeIdx = 0) {
    const m = getMenu(id); if (!m) return;
    const sIdx = Math.min(sizeIdx, m.sizes.length - 1), c = calcSize(m.sizes[sIdx]);
    const body = `
      ${m.sizes.length > 1 ? `<div class="small muted" style="margin-bottom:6px">เลือกไซซ์</div><div class="sizes">${m.sizes.map((s, i) => `<button class="size ${i === sIdx ? 'on' : ''}" data-act="menuActSize" data-id="${m.id}" data-i="${i}"><b>${esc(s.label)}</b><small>${baht(calcSize(s).price, 0)}</small></button>`).join('')}</div>` : ''}
      <div class="card">
        <div class="costrow"><span>ต้นทุนวัตถุดิบ</span><b>${baht(c.mat)}</b></div>
        <div class="costrow"><span>ต้นทุนรวม/จาน</span><b>${baht(c.total)}</b></div>
        <div class="costrow"><span>ราคาหน้าร้าน</span><b>${baht(c.price)}</b></div>
        ${c.delivery[0] ? `<div class="costrow"><span>ราคา ${esc(c.delivery[0].name)}</span><b>${baht(c.delivery[0].price)}</b></div>` : ''}
        <div class="costrow total"><span>กำไร/จาน (หน้าร้าน)</span><b class="${c.profit < 0 ? 'bad' : 'good'}">${baht(c.profit)}</b></div>
      </div>
      <div class="list">
        <button class="item" data-act="sop" data-id="${m.id}" data-i="${sIdx}"><div class="thumb">📄</div><div class="grow"><div class="t">ดู SOP</div><div class="s">สูตรมาตรฐาน / บันทึกรูปแชร์ได้</div></div></button>
        <button class="item" data-act="editMenu" data-id="${m.id}" data-i="${sIdx}"><div class="thumb">✏️</div><div class="grow"><div class="t">แก้ไขเมนู</div><div class="s">แก้วัตถุดิบ ราคา หรือขั้นตอน</div></div></button>
        <button class="item" data-act="editMenu" data-id="${m.id}" data-i="${sIdx}" data-newsize="1" style="background:var(--accent-soft)"><div class="thumb">📏</div><div class="grow"><div class="t">เพิ่มไซซ์ใหม่</div><div class="s">เช่น S/M/L — คัดลอกสูตรนี้ไปปรับต่อ</div></div></button>
        <button class="item" data-act="dupMenu" data-id="${m.id}"><div class="thumb">⧉</div><div class="grow"><div class="t">ทำสำเนาเมนู</div></div></button>
        <button class="item" data-act="delMenu" data-id="${m.id}"><div class="thumb">🗑️</div><div class="grow"><div class="t bad">ลบเมนู</div></div></button>
      </div>`;
    if (topSheet()?.id === 'menuAct') closeSheet();
    openSheet({ title: esc(m.name), body, id: 'menuAct' });
  }

  // ---------- menu editor ----------
  let draft = null, dSize = 0;
  function editMenu(id, sizeIdx = 0, addSize = false) {
    draft = id ? clone(getMenu(id)) : {
      id: uid(), name: '', type: 'food', photo: '', steps: '', createdAt: today(),
      sizes: [{ id: uid(), label: 'ธรรมดา', servings: 1, items: [], pack: '', cookMin: '', labor: '', other: '', fc: '', price: '' }],
    };
    draft._new = !id;
    dSize = Math.min(sizeIdx, draft.sizes.length - 1);
    if (addSize) newSize();
    while (topSheet()) closeSheet();
    openSheet({
      title: id ? 'แก้ไขเมนู' : 'เมนูใหม่', full: true, id: 'editor',
      body: '<div id="ed"></div>',
      foot: '<button class="btn ghost" data-act="closeSheet">ยกเลิก</button><button class="btn" data-act="saveMenu">💾 บันทึกเมนู</button>',
    });
    renderEditor();
  }
  function newSize() {
    const src = draft.sizes[dSize];
    const labels = ['S', 'M', 'L', 'XL'];
    const used = new Set(draft.sizes.map(s => s.label));
    const label = labels.find(l => !used.has(l)) || `ไซซ์ ${draft.sizes.length + 1}`;
    draft.sizes.push({ ...clone(src), id: uid(), label, price: '' });
    dSize = draft.sizes.length - 1;
  }
  function renderEditor() {
    const el = $('#ed'); if (!el) return;
    const s = draft.sizes[dSize];
    el.innerHTML = `
      <div class="photo ${draft.photo ? 'has' : ''}" data-act="pickPhoto" style="${draft.photo ? `background-image:url(${draft.photo})` : ''}">${draft.photo ? '' : '📷 เพิ่มรูปเมนู (ไม่บังคับ)'}</div>
      <input type="file" accept="image/*" id="photoIn" hidden>
      ${draft.photo ? '<div style="text-align:right;margin:-6px 0 8px"><button class="link" data-act="rmPhoto">ลบรูป</button></div>' : ''}
      <label class="f">ชื่อเมนู<input type="text" data-d="name" value="${esc(draft.name)}" placeholder="เช่น ข้าวผัดเนื้อ"></label>
      <div class="seg">${[['food', '🍛 อาหาร'], ['drink', '🧋 เครื่องดื่ม']].map(([k, l]) => `<button class="${draft.type === k ? 'on' : ''}" data-act="dType" data-v="${k}">${l}</button>`).join('')}</div>

      <div class="row between"><b>ไซซ์</b>${draft.sizes.length > 1 ? `<button class="link" data-act="delSize">ลบไซซ์ “${esc(s.label)}”</button>` : ''}</div>
      <div class="sizes" style="margin-top:6px">
        ${draft.sizes.map((z, i) => `<button class="size ${i === dSize ? 'on' : ''}" data-act="pickSize" data-i="${i}"><b>${esc(z.label)}</b><small data-out="sp${i}">${baht(calcSize(z).price, 0)}</small></button>`).join('')}
        <button class="size add" data-act="addSize"><b>＋</b><small>เพิ่มไซซ์</small></button>
      </div>

      <div class="card">
        <div class="grid2">
          <label class="f">ชื่อไซซ์<input type="text" data-s="label" value="${esc(s.label)}"></label>
          <label class="f">สูตรนี้ได้กี่${draft.type === 'drink' ? 'แก้ว' : 'จาน'}<input type="number" inputmode="numeric" data-s="servings" value="${esc(s.servings)}" min="1"></label>
        </div>
        <h2 style="margin-top:4px">🥩 วัตถุดิบ</h2>
        <div id="edItems">${edItems()}</div>
        <button class="btn soft block" data-act="pickIng" style="margin-top:10px">＋ เพิ่มวัตถุดิบ</button>
      </div>

      <div class="card"><h2>ต้นทุนอื่นต่อ${draft.type === 'drink' ? 'แก้ว' : 'จาน'}</h2>
        <div class="grid2">
          <label class="f">🛍️ บรรจุภัณฑ์ (฿)<input type="number" inputmode="decimal" data-s="pack" value="${esc(s.pack)}" placeholder="0"></label>
          <label class="f">🔥 เวลาใช้เตา (นาที)<input type="number" inputmode="decimal" data-s="cookMin" value="${esc(s.cookMin)}" placeholder="0"></label>
          <label class="f">👤 ค่าแรง (฿)<input type="number" inputmode="decimal" data-s="labor" value="${esc(s.labor)}" placeholder="0"></label>
          <label class="f">📦 อื่นๆ (฿)<input type="number" inputmode="decimal" data-s="other" value="${esc(s.other)}" placeholder="0"></label>
        </div>
        <div class="small muted">ค่าแก๊สคิดจาก ${baht(gasPerMin())}/นาที (แก้ได้ในตั้งค่า) · ถ้าค่าแรงจ่ายเป็นเงินเดือน ให้ใส่ในหน้าจุดคุ้มทุนแทน</div>
      </div>

      <div class="card" id="edSum">${edSummary()}</div>

      <div class="card"><h2>📄 ขั้นตอน (SOP)</h2><div class="sub">หนึ่งบรรทัดต่อหนึ่งขั้นตอน</div>
        <textarea data-d="steps" placeholder="ตั้งกระทะไฟแรง ใส่น้ำมัน...">${esc(draft.steps)}</textarea></div>`;
  }
  function edItems() {
    const s = draft.sizes[dSize];
    if (!s.items.length) return '<div class="muted small">ยังไม่มีวัตถุดิบ</div>';
    return s.items.map((it, i) => {
      const ing = getIng(it.ingId);
      if (!ing) return '';
      const dim = unitInfo(ing.unit).dim;
      return `<div class="ing-line">
        <div class="nm">${esc(ing.name)}<small data-out="ic${i}">${baht(itemCost(it))}</small></div>
        <input type="number" inputmode="decimal" data-it="${i}" data-k="qty" value="${esc(it.qty)}" placeholder="0">
        <select data-it="${i}" data-k="unit">${unitsOfDim(dim).map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <button class="del" data-act="rmItem" data-i="${i}" aria-label="ลบ">×</button></div>`;
    }).join('');
  }
  function edSummary() {
    const s = draft.sizes[dSize], c = calcSize(s), unit = draft.type === 'drink' ? 'แก้ว' : 'จาน';
    const fcPct = Math.round(c.fcT * 100);
    const r = fcRating(c.fc);
    return `
      <div class="center"><div class="small muted">ต้นทุน / ${unit}</div><div class="num" style="font-size:2.3rem;font-weight:700;line-height:1.2">${baht(c.total)}</div>
        <div class="small muted">${c.serv} ${unit} · รวม ${baht(c.total * c.serv)}</div></div>
      <div style="margin:10px 0">
        <div class="costrow"><span>🥩 วัตถุดิบ</span><b>${baht(c.mat)}/${unit}</b></div>
        <div class="costrow"><span>🔥 แก๊ส</span><b>${baht(c.gas)}/${unit}</b></div>
        <div class="costrow"><span>👤 ค่าแรง</span><b>${baht(c.labor)}/${unit}</b></div>
        <div class="costrow"><span>📦 อื่นๆ</span><b>${baht(c.other)}/${unit}</b></div>
        <div class="costrow"><span>🛍️ บรรจุภัณฑ์</span><b>${baht(c.pack)}/${unit}</b></div>
      </div>
      <div class="row between"><b>Food Cost เป้าหมาย</b><b style="color:var(--brand)">${fcPct}%</b></div>
      <input type="range" min="10" max="60" step="1" data-s="fc" value="${fcPct}" aria-label="Food Cost เป้าหมาย">
      <div class="small muted">(วัตถุดิบ ÷ ราคาขาย) · ลากเพื่อดูราคาแนะนำ ร้านอาหารทั่วไปอยู่ที่ 25–35%</div>
      <div class="price-cards">
        <div class="pc"><div class="h">🏪 หน้าร้าน</div><div class="p num">${baht(c.price, c.price % 1 ? 2 : 0)}</div><div class="s">กำไร ${baht(c.profit)}</div></div>
        ${c.delivery[0] ? `<div class="pc"><div class="h">🛵 เดลิเวอรี่</div><div class="p num">${baht(c.delivery[0].price, 0)}</div><div class="s">${esc(c.delivery[0].name)} GP ${num(c.delivery[0].gp)}% · VAT ${num(db.settings.vat)}%</div></div>` : ''}
      </div>
      ${c.delivery.length ? `<div style="margin-top:10px">${c.delivery.map(d => `<div class="plat"><span>${esc(d.name)} <small class="muted">GP ${num(d.gp)}%</small></span><span class="num"><b>${baht(d.price, 0)}</b> <small class="${d.profit < 0 ? 'bad' : 'muted'}">กำไร ${baht(d.profit)}</small></span></div>`).join('')}</div>` : ''}
      <label class="f" style="margin-top:12px">ราคาขายหน้าร้านจริง (ถ้าตั้งเอง)
        <input type="number" inputmode="decimal" data-s="price" value="${esc(s.price)}" placeholder="ใช้ราคาแนะนำ ${baht(c.suggested, 0)}"></label>
      <div class="row between small"><span class="muted">Food Cost จริง</span><b class="${r.cls}">${pct(c.fc)} ${r.t !== '-' ? '· ' + r.t : ''}</b></div>
      <div class="row between small"><span class="muted">อัตรากำไรขั้นต้น</span><b class="${c.margin < 0 ? 'bad' : ''}">${pct(c.margin)}</b></div>
      <div class="meter ${c.margin < 0.5 ? 'warn' : ''}"><i style="width:${Math.max(0, Math.min(100, c.margin * 100))}%"></i></div>`;
  }
  function refreshEditorNumbers() {
    const s = draft.sizes[dSize];
    s.items.forEach((it, i) => { const o = $(`[data-out="ic${i}"]`); if (o) o.textContent = baht(itemCost(it)); });
    draft.sizes.forEach((z, i) => { const o = $(`[data-out="sp${i}"]`); if (o) o.textContent = baht(calcSize(z).price, 0); });
    const sum = $('#edSum');
    if (sum) {
      const a = document.activeElement, key = a && a.dataset && a.dataset.s;
      sum.innerHTML = edSummary();
      if (key) { const n = sum.querySelector(`[data-s="${key}"]`); if (n) { n.focus(); if (n.type !== 'range') { try { n.setSelectionRange(n.value.length, n.value.length); } catch { } } } }
    }
  }
  function saveMenu() {
    if (!draft.name.trim()) { toast('ใส่ชื่อเมนูก่อนนะ'); $('[data-d="name"]')?.focus(); return; }
    const isNew = draft._new; delete draft._new;
    draft.updatedAt = today();
    draft.sizes.forEach(s => { s.items = s.items.filter(i => getIng(i.ingId)); });
    const i = db.menus.findIndex(m => m.id === draft.id);
    if (i >= 0) db.menus[i] = draft; else db.menus.unshift(draft);
    db.sample = db.sample && !isNew ? db.sample : db.sample;
    save(); draft = null;
    while (topSheet()) closeSheet();
    if (route !== 'menus') route = 'menus';
    render(); toast(isNew ? 'เพิ่มเมนูแล้ว' : 'บันทึกแล้ว');
  }

  // ---------- ingredient picker (inside menu editor) ----------
  function pickIng() {
    openSheet({ title: 'เลือกวัตถุดิบ', id: 'picker', body: `
      <div class="search"><input type="search" id="pkQ" placeholder="ค้นหาในคลังของฉัน หรือพื้นฐาน"></div>
      <div id="pkList"></div>` });
    const draw = () => {
      const q = ($('#pkQ').value || '').trim().toLowerCase();
      const used = new Set(draft.sizes[dSize].items.map(i => i.ingId));
      const mine = db.ings.filter(i => !q || i.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'th'));
      const names = new Set(db.ings.map(i => i.name));
      const base = q ? BASE_INGS.filter(b => !names.has(b.name) && b.name.toLowerCase().includes(q)).slice(0, 15) : [];
      $('#pkList').innerHTML = `
        <button class="btn ghost block" data-act="pkNew" style="margin-bottom:10px">＋ สร้างวัตถุดิบใหม่${q ? ` “${esc(q)}”` : ''}</button>
        <div class="list">${mine.map(i => `<button class="item" data-act="pkPick" data-id="${i.id}"><div class="thumb">${catOf(i.cat).icon}</div><div class="grow"><div class="t">${esc(i.name)}</div><div class="s">${baht(pricePerBuyUnit(i))}/${esc(i.unit)}</div></div><div class="r">${used.has(i.id) ? '<span class="good small">✓ ใส่แล้ว</span>' : '＋'}</div></button>`).join('')}</div>
        ${base.length ? `<div class="small muted" style="margin:14px 0 6px">จากคลังพื้นฐาน (ต้องใส่ราคาก่อน)</div><div class="list">${base.map(b => `<button class="item" data-act="pkBase" data-name="${esc(b.name)}"><div class="thumb">${catOf(b.cat).icon}</div><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">/${esc(b.unit)}</div></div><div class="r">＋</div></button>`).join('')}</div>` : ''}
        ${!mine.length && !base.length ? '<div class="empty">ไม่พบ ลองสร้างใหม่</div>' : ''}`;
    };
    $('#pkQ').addEventListener('input', draw);
    draw();
    setTimeout(() => $('#pkQ')?.focus(), 250);
  }
  function addItemToDraft(ingId) {
    const ing = getIng(ingId); if (!ing) return;
    const s = draft.sizes[dSize];
    if (s.items.some(i => i.ingId === ingId)) { toast('มีวัตถุดิบนี้แล้ว'); return; }
    const dim = unitInfo(ing.unit).dim;
    s.items.push({ ingId, qty: '', unit: dim === 'count' ? ing.unit : BASE_UNIT[dim] });
    $('#edItems').innerHTML = edItems();
    refreshEditorNumbers();
    setTimeout(() => { const q = $$('#edItems [data-k="qty"]').pop(); q && q.focus(); }, 300);
  }

  // ---------- ingredient editor ----------
  function editIng(id, preset = {}, onSaved) {
    const ing = id ? getIng(id) : null;
    const d = ing ? clone(ing) : { id: uid(), name: '', cat: 'other', unit: 'กก.', buyQty: 1, buyPrice: '', yield: 100, history: [], ...preset };
    const used = ing ? menusUsing(ing.id) : [];
    const units = Object.keys(UNITS);
    const body = `
      <label class="f">ชื่อวัตถุดิบ<input type="text" id="iName" value="${esc(d.name)}" placeholder="เช่น หมูสับ"></label>
      <label class="f">หมวด<select id="iCat">${CATS.map(c => `<option value="${c.id}" ${c.id === d.cat ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select></label>
      <div class="card" style="background:var(--soft);box-shadow:none"><h2>🧾 ราคาที่ซื้อ</h2>
        <div class="grid2">
          <label class="f">จำนวนที่ซื้อ<input type="number" inputmode="decimal" id="iQty" value="${esc(d.buyQty)}"></label>
          <label class="f">หน่วย<select id="iUnit">${units.map(u => `<option ${u === d.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <label class="f">ราคารวม (฿)<input type="number" inputmode="decimal" id="iPrice" value="${esc(d.buyPrice)}" placeholder="0"></label>
        <label class="f">ส่วนที่ใช้ได้จริง (%)<span class="small" style="font-weight:400">หลังตัดแต่ง ล้าง หรือสูญเสีย เช่น เนื้อติดมันเหลือใช้ได้ 85%</span><input type="number" inputmode="decimal" id="iYield" value="${esc(d.yield)}"></label>
        <div class="costrow total"><span>ต้นทุนจริง</span><b id="iOut"></b></div>
      </div>
      ${ing && (ing.history || []).length ? `<div class="card"><h2>📈 ประวัติราคา</h2>${sparkline(ing)}
        <div class="hist">${[...ing.history].reverse().slice(0, 8).map((h, i, a) => { const prev = a[i + 1]; const ch = prev && prev.p ? (h.p - prev.p) / prev.p : 0; return `<div class="row between"><span class="muted">${thDate(h.d)}</span><span><b class="num">${baht(h.p)}/${esc(ing.unit)}</b> ${ch ? `<span class="tag ${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'}${pct(Math.abs(ch), 0)}</span>` : ''}</span></div>`; }).join('')}</div></div>` : ''}
      ${used.length ? `<div class="card"><h2>ใช้ในเมนู (${used.length})</h2><div class="small muted">แก้ราคาตรงนี้ ต้นทุนทุกเมนูด้านล่างอัปเดตอัตโนมัติ</div>${used.map(m => `<div class="plat"><span>${esc(m.name)}</span><b>${baht(calcSize(m.sizes[0]).total)}</b></div>`).join('')}</div>` : ''}
      ${ing ? '<button class="btn danger block" data-act="delIng" data-id="' + ing.id + '">ลบวัตถุดิบนี้</button>' : ''}`;
    const sh = openSheet({ title: ing ? 'แก้ไขวัตถุดิบ' : 'วัตถุดิบใหม่', body, id: 'ingEd',
      foot: '<button class="btn ghost" data-act="closeSheet">ยกเลิก</button><button class="btn" id="iSave">💾 บันทึก</button>' });
    const read = () => ({ name: $('#iName').value.trim(), cat: $('#iCat').value, unit: $('#iUnit').value, buyQty: $('#iQty').value, buyPrice: $('#iPrice').value, yield: $('#iYield').value || 100 });
    const out = () => {
      const r = read(), t = { ...d, ...r };
      const ppu = pricePerBuyUnit(t), base = BASE_UNIT[unitInfo(r.unit).dim];
      $('#iOut').textContent = `${baht(ppu)}/${r.unit}${unitInfo(r.unit).f !== 1 ? ` (${baht(ppu / unitInfo(r.unit).f, 4)}/${base})` : ''}`;
    };
    $$('#iQty,#iUnit,#iPrice,#iYield', sh.el).forEach(e => e.addEventListener('input', out));
    out();
    if (!d.name) setTimeout(() => $('#iName')?.focus(), 250);
    $('#iSave').addEventListener('click', () => {
      const r = read();
      if (!r.name) { toast('ใส่ชื่อวัตถุดิบก่อนนะ'); return; }
      if (!(num(r.buyQty) > 0)) { toast('ใส่จำนวนที่ซื้อ'); return; }
      if (ing && unitInfo(r.unit).dim !== unitInfo(ing.unit).dim && used.length) { toast('เปลี่ยนชนิดหน่วยไม่ได้ เพราะมีเมนูใช้อยู่'); return; }
      const nd = { ...d, ...r, buyQty: num(r.buyQty), buyPrice: num(r.buyPrice), yield: num(r.yield) || 100 };
      const newP = nd.buyQty ? nd.buyPrice / nd.buyQty : 0;
      const last = (nd.history || []).slice(-1)[0];
      if (!last || Math.abs(last.p - newP) > 1e-9 || (ing && ing.unit !== nd.unit)) {
        if (last && last.d === today()) nd.history[nd.history.length - 1] = { d: today(), p: newP };
        else nd.history = [...(nd.history || []), { d: today(), p: newP }];
        nd.updatedAt = today();
      }
      if (ing) Object.assign(ing, nd); else db.ings.push(nd);
      save(); closeSheet();
      if (onSaved) onSaved(nd.id); else { render(); }
      toast(ing ? 'อัปเดตราคาแล้ว ต้นทุนเมนูคำนวณใหม่ให้แล้ว' : 'เพิ่มเข้าคลังแล้ว');
    });
  }
  function sparkline(ing) {
    const h = ing.history; if (h.length < 2) return '';
    const W = 320, H = 100, P = 10, ps = h.map(x => x.p), mn = Math.min(...ps), mx = Math.max(...ps), rg = mx - mn || 1;
    const pts = h.map((x, i) => [P + i * (W - 2 * P) / (h.length - 1), H - P - (x.p - mn) / rg * (H - 2 * P)]);
    const up = ps[ps.length - 1] >= ps[0];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="กราฟราคาย้อนหลัง">
      <polyline fill="none" stroke="${up ? '#ef4444' : '#16a34a'}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p.join(',')).join(' ')}"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? '#14b8a6' : (up ? '#ef4444' : '#16a34a')}"/>`).join('')}</svg>`;
  }

  // ---------- SOP ----------
  function sop(id, sIdx = 0) {
    const m = getMenu(id); if (!m) return;
    const s = m.sizes[sIdx] || m.sizes[0];
    const steps = (m.steps || '').split('\n').map(x => x.trim()).filter(Boolean);
    const body = `
      ${m.sizes.length > 1 ? `<div class="sizes noprint">${m.sizes.map((z, i) => `<button class="size ${z === s ? 'on' : ''}" data-act="sop" data-id="${m.id}" data-i="${i}"><b>${esc(z.label)}</b></button>`).join('')}</div>` : ''}
      <div class="sop" id="sopCard">
        ${m.photo ? `<img class="ph" src="${m.photo}" alt="">` : ''}
        <div class="in">
          <h3>${esc(m.name)}${m.sizes.length > 1 ? ` <small style="font-size:.9rem;color:#64737a">(${esc(s.label)})</small>` : ''}</h3>
          <div style="color:#64737a;font-size:.9rem">${num(s.servings) || 1} ${m.type === 'drink' ? 'แก้ว' : 'จาน'} · ${thDate(m.updatedAt || today())}</div>
          <div class="sec">🥩 วัตถุดิบ</div>
          <table>${s.items.map(it => { const ing = getIng(it.ingId); return ing ? `<tr><td>${esc(ing.name)}</td><td>${fmtQty(it.qty, it.unit)}</td></tr>` : ''; }).join('') || '<tr><td>-</td><td></td></tr>'}</table>
          ${steps.length ? `<div class="sec">👩‍🍳 ขั้นตอน</div><ol>${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        </div>
        <div class="foot">${esc(db.settings.shopName)} · SOP สูตรมาตรฐาน</div>
      </div>`;
    if (topSheet()?.id === 'sop') closeSheet();
    openSheet({ title: '📄 SOP สูตรมาตรฐาน', body, id: 'sop', full: true,
      foot: `<button class="btn ghost" data-act="printSop">🖨 พิมพ์</button><button class="btn" data-act="shareSop" data-name="${esc(m.name)}">📤 บันทึกรูป / แชร์</button>` });
  }
  function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  async function shareSop(name) {
    toast('กำลังสร้างรูป...');
    try {
      if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      const canvas = await window.html2canvas($('#sopCard'), { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], `SOP-${name}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `SOP ${name}` }).catch(() => { });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('บันทึกรูปแล้ว');
      }
    } catch { toast('สร้างรูปไม่สำเร็จ ลองใช้ปุ่มพิมพ์ หรือแคปหน้าจอแทน'); }
  }

  // ---------- photo ----------
  function readPhoto(file) {
    return new Promise((ok, no) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = no; img.src = url;
    });
  }

  // ---------- backup ----------
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function exportCsv() {
    const head = ['เมนู', 'ประเภท', 'ไซซ์', 'วัตถุดิบ/จาน', 'บรรจุภัณฑ์', 'แก๊ส', 'ค่าแรง', 'อื่นๆ', 'ต้นทุนรวม', 'ราคาหน้าร้าน', 'Food Cost %', 'กำไร/จาน', ...db.settings.platforms.map(p => `ราคา ${p.name}`)];
    const f = (n) => (Math.round(n * 100) / 100).toFixed(2);
    const rows = allSizes().map(({ m, s, c }) => [m.name, m.type === 'drink' ? 'เครื่องดื่ม' : 'อาหาร', s.label, f(c.mat), f(c.pack), f(c.gas), f(c.labor), f(c.other), f(c.total), f(c.price), (c.fc * 100).toFixed(1), f(c.profit), ...c.delivery.map(d => f(d.price))]);
    const csv = [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('menu-costs.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  }

  // ================= events =================
  document.addEventListener('click', async (e) => {
    const go_ = e.target.closest('[data-go]');
    if (go_) { while (topSheet()) closeSheet(); go(go_.dataset.go); return; }
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act, id = t.dataset.id, i = num(t.dataset.i);
    switch (a) {
      case 'closeSheet': closeSheet(); break;
      case 'clearSample':
        if (confirm('ล้างข้อมูลตัวอย่างทั้งหมด แล้วเริ่มใส่ข้อมูลร้านจริง?')) { const s = db.settings; db = defaults(); db.settings = s; save(); render(); }
        break;
      case 'menuType': ui.menuType = t.dataset.v; render(); break;
      case 'ingTab': ui.ingTab = t.dataset.v; render(); break;
      case 'ingCat': ui.ingCat = t.dataset.v; render(); break;
      case 'newMenu': editMenu(null); break;
      case 'openMenu': menuActions(id); break;
      case 'menuActSize': menuActions(id, i); break;
      case 'editMenu': editMenu(id, i, !!t.dataset.newsize); break;
      case 'dupMenu': { const m = clone(getMenu(id)); m.id = uid(); m.name += ' (สำเนา)'; m.sizes.forEach(s => s.id = uid()); db.menus.unshift(m); save(); closeSheet(); render(); toast('ทำสำเนาแล้ว'); break; }
      case 'delMenu': if (confirm('ลบเมนูนี้?')) { db.menus = db.menus.filter(m => m.id !== id); save(); closeSheet(); render(); } break;
      case 'sop': sop(id, i); break;
      case 'printSop': window.print(); break;
      case 'shareSop': shareSop(t.dataset.name); break;
      // editor
      case 'dType': draft.type = t.dataset.v; renderEditor(); break;
      case 'pickSize': dSize = i; renderEditor(); break;
      case 'addSize': newSize(); renderEditor(); toast(`เพิ่มไซซ์ ${draft.sizes[dSize].label} (คัดลอกสูตรมาแล้ว ปรับปริมาณได้เลย)`); break;
      case 'delSize': if (draft.sizes.length > 1 && confirm(`ลบไซซ์ “${draft.sizes[dSize].label}”?`)) { draft.sizes.splice(dSize, 1); dSize = 0; renderEditor(); } break;
      case 'rmItem': draft.sizes[dSize].items.splice(i, 1); $('#edItems').innerHTML = edItems(); refreshEditorNumbers(); break;
      case 'pickIng': pickIng(); break;
      case 'pkPick': closeSheet(); addItemToDraft(id); break;
      case 'pkNew': { const q = $('#pkQ')?.value.trim() || ''; closeSheet(); editIng(null, { name: q }, (nid) => addItemToDraft(nid)); break; }
      case 'pkBase': { const b = BASE_INGS.find(x => x.name === t.dataset.name); closeSheet(); editIng(null, { name: b.name, cat: b.cat, unit: b.unit }, (nid) => addItemToDraft(nid)); break; }
      case 'pickPhoto': $('#photoIn').click(); break;
      case 'rmPhoto': draft.photo = ''; renderEditor(); break;
      case 'saveMenu': saveMenu(); break;
      // ingredients
      case 'newIng': editIng(null, ui.ingCat !== 'all' ? { cat: ui.ingCat } : {}); break;
      case 'editIng': editIng(id); break;
      case 'delIng': {
        const n = menusUsing(id).length;
        if (!confirm(n ? `วัตถุดิบนี้ใช้อยู่ใน ${n} เมนู ถ้าลบจะถูกเอาออกจากสูตรด้วย ลบเลยไหม?` : 'ลบวัตถุดิบนี้?')) break;
        db.ings = db.ings.filter(x => x.id !== id);
        db.menus.forEach(m => m.sizes.forEach(s => { s.items = s.items.filter(x => x.ingId !== id); }));
        save(); closeSheet(); render(); break;
      }
      case 'addBase': {
        const line = t.closest('.add-line'), b = BASE_INGS.find(x => x.name === line.dataset.base);
        const q = num($('.bq', line).value), p = num($('.bp', line).value);
        if (!(q > 0) || !(p > 0)) { toast('ใส่จำนวนและราคารวมก่อน'); return; }
        db.ings.push({ id: uid(), name: b.name, cat: b.cat, unit: b.unit, buyQty: q, buyPrice: p, yield: 100, history: [{ d: today(), p: p / q }], updatedAt: today() });
        save(); render(); toast(`เพิ่ม ${b.name} เข้าคลังแล้ว`); break;
      }
      // break-even
      case 'fcManual': db.be.fcManual = (shopStats().variable * 100).toFixed(1); save(); render(); break;
      case 'fcAuto': db.be.fcManual = ''; save(); render(); break;
      // settings
      case 'addPlat': db.settings.platforms.push({ id: uid(), name: 'แพลตฟอร์มใหม่', gp: 30 }); save(); render(); break;
      case 'delPlat': db.settings.platforms.splice(i, 1); save(); render(); break;
      case 'exportJson': download(`khumkrua-backup-${today()}.json`, JSON.stringify(db), 'application/json'); break;
      case 'exportCsv': exportCsv(); break;
      // ledger
      case 'monthPrev': ui.month = ymShift(ui.month || ymNow(), -1); render(); break;
      case 'monthNext': ui.month = ymShift(ui.month || ymNow(), 1); render(); break;
      case 'newTx': txSheet(t.dataset.v || 'out'); break;
      case 'newSale': saleSheet(); break;
      case 'editTx': txSheet('out', id); break;
      case 'delTx': if (confirm('ลบรายการนี้?')) { db.tx = db.tx.filter(x => x.id !== id); save(); closeSheet(); render(); } break;
      case 'exportTxCsv': exportTxCsv(); break;
      case 'resetAll': if (confirm('ล้างข้อมูลทั้งหมด? (กู้คืนไม่ได้ ถ้าไม่ได้สำรองไว้)')) { db = defaults(); save(); go('home'); } break;
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target, d = t.dataset;
    if (d.ui) { ui[d.ui] = t.value; const pos = t.selectionStart; render(); const n = $(`[data-ui="${d.ui}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { } } return; }
    if (draft && d.d) { draft[d.d] = t.value; return; }
    if (draft && d.s) {
      const s = draft.sizes[dSize];
      s[d.s] = t.value;
      if (d.s === 'label') { const o = $$('.size b')[dSize]; if (o) o.textContent = t.value || '-'; return; }
      refreshEditorNumbers(); return;
    }
    if (draft && d.it != null) { draft.sizes[dSize].items[num(d.it)][d.k] = t.value; refreshEditorNumbers(); return; }
    if (d.be) {
      db.be[d.be] = t.type === 'checkbox' ? t.checked : t.value; save();
      if (t.type === 'checkbox') { render(); return; }
      if (d.be === 'profit') { const o = $('[data-out="profitPct"]'); if (o) o.textContent = t.value + '%'; }
      const st = shopStats(), b = db.be;
      const fixed = ['labor', 'rent', 'utility', 'other', 'ads'].reduce((s, k) => s + num(b[k]), 0);
      const v = b.fcManual !== '' && b.fcManual != null ? num(b.fcManual) / 100 : st.variable;
      const p = b.profitOn ? num(b.profit) / 100 : 0, days = Math.max(1, num(b.days) || 30), den = 1 - v - p;
      const need = den > 0 ? fixed / den : Infinity;
      const dishes = st.price > 0 && Number.isFinite(need) ? Math.ceil(need / days / st.price) : 0;
      $('[data-out="fixed"]').textContent = baht(fixed, 0);
      $('[data-out="beResult"]').innerHTML = beResult(need, days, dishes, p);
      return;
    }
    if (d.set) {
      db.settings[d.set] = t.type === 'checkbox' ? t.checked : t.value; save();
      if (d.set === 'shopName') $('#shopName').textContent = t.value || 'คุ้มครัว';
      const g = $('[data-out="gasRate"]'); if (g) g.textContent = `= ${baht(gasPerMin())} ต่อนาที`;
      return;
    }
    if (d.plat != null) { db.settings.platforms[num(d.plat)][d.k] = d.k === 'gp' ? t.value : t.value; save(); return; }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'photoIn' && t.files[0]) {
      try { draft.photo = await readPhoto(t.files[0]); renderEditor(); } catch { toast('อ่านรูปไม่ได้'); }
      return;
    }
    if (t.dataset.actChange === 'importJson' && t.files[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        if (!Array.isArray(data.ings) || !Array.isArray(data.menus)) throw 0;
        if (!confirm(`นำเข้า ${data.menus.length} เมนู ${data.ings.length} วัตถุดิบ? (แทนที่ข้อมูลปัจจุบัน)`)) return;
        db = data; load.call && Object.assign(db, { settings: Object.assign(defaults().settings, db.settings), be: Object.assign(defaults().be, db.be) });
        save(); go('home'); toast('นำเข้าแล้ว');
      } catch { toast('ไฟล์ไม่ถูกต้อง'); }
      t.value = '';
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && topSheet()) closeSheet(); });
  window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== route) { while (topSheet()) closeSheet(); route = r; render(); } });

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

  // ================= boot =================
  load(); save();
  route = location.hash.slice(1) || 'home';
  render();

  // สำหรับทดสอบ
  window.__kc = { calcSize, magic, shopStats, get db() { return db; } };
})();
