'use strict';
(() => {
  const KEY = 'etf-progress-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '');
  const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦄', '🐧', '🦉', '🐨', '🐲', '🐝', '🦁'];
  const PAL = ['#1c7ed6', '#e8590c', '#2f9e44', '#7048e8', '#d6336c', '#0b7f95'];
  const D = window.ETF;

  const NODES = [];
  D.zones.forEach((z, zi) => z.rooms.forEach((r, ri) => NODES.push(Object.assign({}, r, { zone: z, zi, ri }))));
  NODES.push({ id: 'vault', type: 'vault', icon: '🔐', title: 'The Exit Vault', short: 'Exit Vault' });
  const isChallenge = (n) => n.type !== 'door' && n.type !== 'vault';
  const N_CHAL = NODES.filter(isChallenge).length;
  const N_DOOR = NODES.filter((n) => n.type === 'door').length;
  const MAX = N_CHAL * 100 + N_DOOR * 50 + 100 + D.final.length * 50;
  const MAX_STARS = N_CHAL + 1;

  /* ---------- state ---------- */
  const fresh = () => ({ v: 1, team: '', players: [], startedAt: 0, finishedAt: 0, pos: 0, cur: 0, rooms: {}, att: {}, qf: [], screen: 'setup' });
  let S = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) { /* storage blocked */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  const score = () => Object.values(S.rooms).reduce((t, r) => t + (r.pts || 0), 0) + S.qf.filter((q) => q.ok).length * 50;
  const stars = () => Object.values(S.rooms).filter((r) => r.star).length;
  const elapsed = () => (S.startedAt ? (S.finishedAt || Date.now()) - S.startedAt : 0);
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const captainFor = (i) => S.players[NODES.slice(0, i).filter(isChallenge).length % S.players.length];
  const rank = (p) => (p >= MAX * 0.85 ? ['🥇', 'Privacy Legends'] : p >= MAX * 0.65 ? ['🥈', 'Data Defenders'] : p >= MAX * 0.45 ? ['🥉', 'Footprint Trackers'] : ['🎖️', 'Feed Escapers']);
  const zoneDone = (zi) => S.pos > zi * 4 + 3;

  /* seeded shuffle so a room always looks the same */
  function shuffle(arr, seed) {
    let h = 2166136261;
    for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const rnd = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.length > 1 && a.every((v, i) => v === arr[i])) a.push(a.shift());
    return a;
  }

  /* ---------- UI helpers ---------- */
  const app = $('#app');
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  function modal(html, actions = [{ label: 'OK', cls: 'primary' }], cls = '') {
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="modal card ${cls}" role="dialog" aria-modal="true">${html}<div class="m-actions">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${a.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      ov.remove();
      const f = actions[+b.dataset.a].fn;
      if (f) f();
    });
    setTimeout(() => { const b = ov.querySelector('.m-actions .btn'); if (b) b.focus(); }, 30);
  }
  function burst(list = ['⭐', '🎉', '🗝️', '✨']) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span');
      s.textContent = list[i % list.length];
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 0.6}s`;
      s.style.fontSize = `${18 + Math.random() * 22}px`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }
  const art = (list) => `<div class="art" aria-hidden="true">${(list || []).slice(0, 5).map((e, i) => `<span class="a${i}">${e}</span>`).join('')}</div>`;
  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  }

  /* ---------- header ---------- */
  function paintHeader() {
    const playing = S.screen !== 'setup';
    $('#hScore').hidden = !playing; $('#hTimer').hidden = !playing; $('#btnCopy').hidden = !playing; $('#btnNew').hidden = !playing;
    $('#hScore b').textContent = score();
    $('#hTimer b').textContent = fmt(elapsed());
    $('#hTimer').classList.toggle('late', elapsed() > 35 * 60000 && !S.finishedAt);
    $('#hTeam').textContent = playing ? `${S.players.map((p) => p.av).join('')} ${S.team}` : '';
  }
  setInterval(() => { if (S.startedAt) { $('#hTimer b').textContent = fmt(elapsed()); $('#hTimer').classList.toggle('late', elapsed() > 35 * 60000 && !S.finishedAt); } }, 1000);

  /* ---------- report ---------- */
  function report() {
    const L = [];
    const [rk, rn] = rank(score());
    L.push('ESCAPE THE FEED · Year 10 Online Safety', 'British School Alzira · Xàtiva · Gandia Group', '');
    L.push(`Team: ${S.team}`, `Players: ${S.players.map((p) => p.name).join(', ')}`);
    L.push(`Date: ${new Date().toLocaleDateString('en-GB')} · Time: ${fmt(elapsed())}${S.finishedAt ? '' : ' (still playing)'}`);
    L.push(`Score: ${score()} / ${MAX} · Stars: ${stars()} / ${MAX_STARS}${S.finishedAt ? ` · Rank: ${rn}` : ''}`, '');
    D.zones.forEach((z, zi) => {
      L.push(`ZONE ${zi + 1} · ${z.name.toUpperCase()} (${z.lesson})`);
      z.rooms.forEach((r) => {
        const d = S.rooms[r.id], a = S.att[r.id] || {};
        if (!d) { L.push(`  – ${r.title}: not reached yet`); return; }
        if (r.type === 'door') {
          L.push(`  ✓ ${r.title}: ${d.pts} pts · doors tried: ${(a.tries || []).map((k) => `${r.doors[k].label} ${r.doors[k].ok ? '✓' : '✗'}`).join(' → ')}`);
        } else {
          const bits = [d.star ? '⭐ first try' : `${d.wrong} wrong check${d.wrong === 1 ? '' : 's'}`];
          if (d.hints) bits.push(`${d.hints} hint${d.hints > 1 ? 's' : ''}`);
          if (d.helped) bits.push('helped through');
          L.push(`  ✓ ${r.title}: ${d.pts} pts · ${bits.join(' · ')} · captain ${d.captain}`);
          if (d.miss && d.miss.length) L.push(`      tricky: ${d.miss.join('; ')}`);
        }
      });
      L.push('');
    });
    L.push('EXIT VAULT');
    const m = S.rooms.motto;
    L.push(m ? `  ✓ Unlock the vault: ${m.pts} pts${m.star ? ' ⭐' : ''}${m.helped ? ' · helped through' : ''}` : '  – Unlock the vault: not reached yet');
    S.qf.forEach((q) => L.push(`  ${q.ok ? '✓' : '✗'} ${q.player}: ${q.q} → ${q.pick}`));
    return L.join('\n');
  }
  async function copyReport() {
    const ok = await copyText(report());
    toast(ok ? '📋 Results copied! Paste them into a message to your teacher.' : 'Copy did not work: open “See your full results” and copy the text.');
  }

  /* ---------- render ---------- */
  function render() {
    paintHeader();
    window.scrollTo(0, 0);
    if (S.screen === 'setup') return renderSetup();
    if (S.screen === 'cert') return renderCert();
    if (S.screen === 'room') {
      const n = NODES[S.cur];
      if (!n) { S.screen = 'map'; return render(); }
      if (n.type === 'vault') return renderVault();
      if (n.type === 'door') return renderDoor(n);
      return renderRoom(n);
    }
    return renderMap();
  }

  /* ---------- setup ---------- */
  const draft = { n: 2, p: [{ name: '', av: '🦊' }, { name: '', av: '🐼' }, { name: '', av: '🐸' }] };
  function renderSetup() {
    app.innerHTML = `
      <section class="setup">
        <div class="card hero">
          <div class="hero-art" aria-hidden="true"><span>📱</span><span>🌀</span><span>👣</span><span>🔐</span><span>🍪</span><span>🕵️</span></div>
          <div class="hero-txt">
            <p class="kicker">Escape room · 2–3 players · 30–35 minutes</p>
            <h2>You have been sucked into the Feed!</h2>
            <p>You scrolled for too long… and the screen swallowed you. To escape, your team must cross <b>four zones</b>, win <b>four keys</b> and open the <b>Exit Vault</b>.</p>
            <ul class="how">
              <li><span>🧩</span><span>Solve the challenge in every room. The captain changes each room, but the whole team decides.</span></li>
              <li><span>🚪</span><span>At every set of doors, choose together. Wrong doors are traps!</span></li>
              <li><span>💡</span><span>Stuck? Use a hint. Still stuck? <b>Help us through</b> always gets you to the next room, with fewer points.</span></li>
              <li><span>⭐</span><span>Right first time with no hints = 100 points and a star.</span></li>
            </ul>
          </div>
        </div>
        <form class="card team-form" id="teamForm" novalidate>
          <h3>Build your team</h3>
          <label class="fld"><span>Team name</span><input id="tName" maxlength="24" autocomplete="off" placeholder="e.g. The Firewalls" value="${esc(S.team)}"></label>
          <div class="fld"><span>How many players?</span>
            <div class="seg" id="nSeg"><button type="button" data-n="2">👥 2 players</button><button type="button" data-n="3">👥 3 players</button></div>
          </div>
          <div id="pRows"></div>
          <p class="form-msg" id="fMsg" role="alert"></p>
          <button class="btn primary big" type="submit">Enter the Feed ▶</button>
        </form>
      </section>`;
    const rows = $('#pRows');
    const paintRows = () => {
      $$('#nSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === draft.n)));
      rows.innerHTML = draft.p.slice(0, draft.n).map((p, i) => `
        <div class="prow">
          <label class="fld"><span>Player ${i + 1}</span><input data-p="${i}" maxlength="16" autocomplete="off" placeholder="First name" value="${esc(p.name)}"></label>
          <div class="avs" role="group" aria-label="Avatar for player ${i + 1}">${AVATARS.map((a) => `<button type="button" data-pi="${i}" data-av="${a}" aria-pressed="${a === p.av}">${a}</button>`).join('')}</div>
        </div>`).join('');
    };
    paintRows();
    $('#nSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; draft.n = +b.dataset.n; paintRows(); });
    rows.addEventListener('input', (e) => { if (e.target.dataset.p != null) draft.p[+e.target.dataset.p].name = e.target.value; });
    rows.addEventListener('click', (e) => {
      const b = e.target.closest('[data-av]'); if (!b) return;
      draft.p[+b.dataset.pi].av = b.dataset.av;
      $$(`[data-pi="${b.dataset.pi}"]`, rows).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    $('#teamForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const ps = draft.p.slice(0, draft.n).map((p) => ({ name: p.name.trim(), av: p.av }));
      if (ps.some((p) => !p.name)) { $('#fMsg').textContent = 'Write a name for every player.'; return; }
      const names = ps.map((p) => p.name.toLowerCase());
      if (new Set(names).size !== names.length) { $('#fMsg').textContent = 'Two players have the same name: add an initial.'; return; }
      S = fresh();
      S.team = $('#tName').value.trim() || `Team ${ps.map((p) => p.name).join(' & ')}`;
      S.players = ps; S.startedAt = Date.now(); S.screen = 'map';
      save(); render();
      const c = captainFor(0);
      modal(`<div class="m-big">🗺️</div><h3>Welcome to the Feed, ${esc(S.team)}!</h3>
        <p>This is the map. Your team starts in the <b>Threat Arcade</b>. Tap the glowing room to begin.</p>
        <p class="m-cap"><span>${c.av}</span> <b>${esc(c.name)}</b> is captain for the first room.</p>`, [{ label: 'Let’s go! ▶', cls: 'primary' }]);
    });
  }

  /* ---------- map ---------- */
  const ROW_Y = [82, 218, 354, 490], COL_X = [175, 385, 595, 805], VAULT = [500, 616];
  const nodePos = (i) => {
    if (i >= 16) return VAULT;
    const zi = Math.floor(i / 4), ri = i % 4;
    return [zi % 2 ? COL_X[3 - ri] : COL_X[ri], ROW_Y[zi]];
  };
  function renderMap() {
    const pts = NODES.map((_, i) => nodePos(i));
    const path = [];
    pts.forEach((p, i) => { if (i === 16) path.push([pts[15][0], VAULT[1]]); path.push(p); });
    const bands = D.zones.map((z, zi) => `
      <rect class="band" x="40" y="${ROW_Y[zi] - 62}" width="920" height="124" rx="24" style="fill:${z.color}"></rect>
      <text class="band-l" x="62" y="${ROW_Y[zi] - 40}" style="fill:${z.color}">${z.icon} ZONE ${zi + 1} · ${z.name.toUpperCase()}${zoneDone(zi) ? ' 🗝️' : ''}</text>`).join('');
    const nodes = NODES.map((n, i) => {
      const [x, y] = pts[i];
      const st = i < S.pos ? 'done' : i === S.pos ? 'now' : 'locked';
      const col = n.zone ? n.zone.color : '#202D4A';
      const shape = n.type === 'door'
        ? `<path class="shape" d="M${x - 30} ${y + 36}V${y - 8}a30 30 0 0 1 60 0V${y + 36}z" style="stroke:${col}"></path>`
        : `<circle class="shape" cx="${x}" cy="${y}" r="${n.type === 'vault' ? 44 : 34}" style="stroke:${col}"></circle>`;
      const fill = st === 'done' ? `style="--nc:${col}"` : '';
      return `<g class="node ${st} ${n.type}" data-i="${i}" ${fill} tabindex="${st === 'locked' ? -1 : 0}" role="button" aria-label="${esc(n.title)}: ${st === 'done' ? 'cleared' : st === 'now' ? 'next room' : 'locked'}">
        ${st === 'now' ? `<circle class="pulse" cx="${x}" cy="${y}" r="${n.type === 'vault' ? 52 : 44}" style="stroke:${col}"></circle>` : ''}
        ${shape}
        <text class="ic" x="${x}" y="${y + 2}" style="font-size:${n.type === 'vault' ? 38 : 30}px">${n.icon}</text>
        ${st === 'done' ? `<circle class="tick" cx="${x + 26}" cy="${y - 26}" r="12"></circle><text class="tick-t" x="${x + 26}" y="${y - 25}">✓</text>` : ''}
        ${st === 'locked' ? `<text class="lock" x="${x + 26}" y="${y - 24}">🔒</text>` : ''}
        <text class="lbl" x="${x}" y="${y + (n.type === 'vault' ? 64 : 54)}">${esc(n.short)}</text>
      </g>`;
    }).join('');
    let token = '';
    if (S.pos < NODES.length) {
      const [x, y] = pts[S.pos];
      token = `<g class="token" aria-hidden="true">${S.players.map((p, k) => `<text x="${x + 50 + k * 24}" y="${y - 8}">${p.av}</text>`).join('')}</g>`;
    }
    const next = NODES[S.pos];
    const cap = next && isChallenge(next) ? captainFor(S.pos) : null;
    app.innerHTML = `
      <section class="mapwrap">
        <div class="card map-card">
          <svg class="map" viewBox="0 0 1000 690" role="img" aria-label="Map of the Feed: four zones and the Exit Vault">
            ${bands}
            <polyline class="trail" points="${path.map((p) => p.join(',')).join(' ')}"></polyline>
            <polyline class="trail-done" points="${path.slice(0, Math.min(S.pos, 16) + (S.pos >= 16 ? 2 : 1)).map((p) => p.join(',')).join(' ')}"></polyline>
            ${nodes}${token}
          </svg>
        </div>
        <aside class="side">
          <div class="card next-card">
            ${next ? `
              <p class="kicker">${next.zone ? `Zone ${next.zi + 1} · ${esc(next.zone.name)}` : 'The way out'}</p>
              <h3>${next.icon} ${esc(next.title)}</h3>
              <p class="small">${next.type === 'door' ? '👥 Team decision: choose a door together.' : next.type === 'vault' ? '🗝️ Use your four keys, then face the final showdown.' : `<span class="cap-av">${cap.av}</span> Captain: <b>${esc(cap.name)}</b>`}</p>
              <button class="btn primary big" id="bGo">Enter ▶</button>`
            : `<h3>🏆 You escaped!</h3><button class="btn primary big" id="bCert">See your certificate</button>`}
          </div>
          <div class="card keys-card">
            <h4>Keys</h4>
            <div class="keys">${D.zones.map((z, zi) => `<span class="key ${zoneDone(zi) ? 'got' : ''}" style="--kc:${z.color}">${zoneDone(zi) ? `🗝️ ${z.key}` : '🔒 ?'}</span>`).join('')}</div>
          </div>
          <div class="card team-card">
            <h4>${esc(S.team)}</h4>
            <ul class="plist">${S.players.map((p) => `<li><span>${p.av}</span>${esc(p.name)}</li>`).join('')}</ul>
            <p class="small">⭐ ${stars()} star${stars() === 1 ? '' : 's'} · ${score()} points</p>
          </div>
        </aside>
      </section>`;
    const go = $('#bGo'); if (go) go.addEventListener('click', () => openNode(S.pos));
    const bc = $('#bCert'); if (bc) bc.addEventListener('click', () => { S.screen = 'cert'; save(); render(); });
    const svg = $('.map');
    const act = (g) => {
      const i = +g.dataset.i;
      if (i === S.pos) return openNode(i);
      if (i > S.pos) return toast('🔒 Locked. Clear the glowing room first.');
      const n = NODES[i], d = S.rooms[n.id];
      modal(`<div class="m-big">${n.icon}</div><h3>${esc(n.title)} ✓</h3><p class="small">${d ? `${d.pts} points${d.star ? ' ⭐' : ''}` : ''}</p><div class="learn">🧠 <b>Remember:</b> ${n.learn || ''}</div>`, [{ label: 'Close' }]);
    };
    svg.addEventListener('click', (e) => { const g = e.target.closest('.node'); if (g) act(g); });
    svg.addEventListener('keydown', (e) => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(g); } });
  }
  function openNode(i) { S.cur = i; S.screen = 'room'; save(); render(); }
  function toMap() { S.screen = 'map'; save(); render(); }

  /* ---------- challenge controllers ---------- */
  function mkMatch(room) {
    const n = room.pairs.length, order = shuffle([...Array(n).keys()], room.id);
    const sel = {}; let act = null, flag = false;
    let root;
    const paint = () => {
      $$('[data-l]', root).forEach((b) => {
        const l = +b.dataset.l, has = sel[l] != null;
        b.classList.toggle('active', act === l);
        b.classList.toggle('paired', has);
        b.classList.toggle('flag', flag && has && sel[l] !== l);
        b.style.setProperty('--p', PAL[l % PAL.length]);
        b.querySelector('.badge').textContent = has ? l + 1 : '';
      });
      $$('[data-r]', root).forEach((b) => {
        const r = +b.dataset.r, l = Object.keys(sel).find((k) => sel[k] === r);
        b.classList.toggle('paired', l != null);
        b.classList.toggle('flag', flag && l != null && +l !== r);
        b.classList.toggle('ready', act != null);
        if (l != null) b.style.setProperty('--p', PAL[l % PAL.length]);
        b.querySelector('.badge').textContent = l != null ? +l + 1 : '';
      });
    };
    return {
      html: () => `<div class="match">
        <div class="mcol"><p class="col-h">${room.left}</p>${room.pairs.map((p, i) => `<button class="mcard L" data-l="${i}"><span class="badge"></span><span class="t">${p[0]}</span></button>`).join('')}</div>
        <div class="mcol"><p class="col-h">${room.right}</p>${order.map((j) => `<button class="mcard R" data-r="${j}"><span class="badge"></span><span class="t">${room.pairs[j][1]}</span></button>`).join('')}</div>
      </div>`,
      bind(el, onChange) {
        root = el;
        el.addEventListener('click', (e) => {
          const L = e.target.closest('[data-l]'), R = e.target.closest('[data-r]');
          if (L) { const l = +L.dataset.l; act = act === l ? null : l; }
          else if (R) {
            const r = +R.dataset.r;
            for (const k in sel) if (sel[k] === r) delete sel[k];
            if (act != null) { sel[act] = r; act = null; }
          } else return;
          paint(); onChange();
        });
        paint();
      },
      check: () => (Object.keys(sel).length < n ? { incomplete: 'Match every item first, then press Check.' } : { total: n, wrong: [...Array(n).keys()].filter((i) => sel[i] !== i) }),
      label: (i) => plain(room.pairs[i][0]).replace(/^\S+\s/, ''),
      setFlag(v) { flag = v; paint(); },
      reveal() { for (let i = 0; i < n; i++) sel[i] = i; act = null; flag = false; root.classList.add('shown'); paint(); },
      lock() { root.classList.add('locked'); },
    };
  }

  function mkSort(room) {
    const items = room.items, n = items.length, sel = {};
    let root, flag = false;
    const bins = (it) => (it.opts ? it.opts.map((o, k) => ({ id: k, label: o, icon: '' })) : room.bins);
    const paint = () => {
      $$('.scard', root).forEach((c) => {
        const i = +c.dataset.i, v = sel[i];
        $$('[data-b]', c).forEach((b, k) => { const on = String(v) === b.dataset.b; b.setAttribute('aria-pressed', String(on)); b.style.setProperty('--p', PAL[k % PAL.length]); });
        c.classList.toggle('answered', v != null);
        c.classList.toggle('flag', flag && v != null && v !== items[i].ok);
      });
    };
    return {
      html: () => `<div class="sort ${room.bins ? `bins-${room.bins.length}` : 'opts'}">${items.map((it, i) => `
        <div class="scard" data-i="${i}">
          <p class="s-t"><span class="s-e">${it.e}</span><span>${it.t}</span></p>
          <div class="s-opts">${bins(it).map((b) => `<button data-b="${b.id}" aria-pressed="false">${b.icon ? `${b.icon} ` : ''}${b.label}</button>`).join('')}</div>
        </div>`).join('')}</div>`,
      bind(el, onChange) {
        root = el;
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-b]'); if (!b) return;
          const i = +b.closest('.scard').dataset.i, it = items[i];
          sel[i] = it.opts ? +b.dataset.b : b.dataset.b;
          paint(); onChange();
        });
        paint();
      },
      check: () => (Object.keys(sel).length < n ? { incomplete: 'Choose an answer for every card first, then press Check.' } : { total: n, wrong: items.map((it, i) => (sel[i] === it.ok ? -1 : i)).filter((i) => i >= 0) }),
      label: (i) => plain(items[i].t),
      setFlag(v) { flag = v; paint(); },
      reveal() { items.forEach((it, i) => { sel[i] = it.ok; }); flag = false; root.classList.add('shown'); paint(); },
      lock() { root.classList.add('locked'); },
    };
  }

  function mkPick(room) {
    const items = room.items, sel = new Set();
    let root, flag = false;
    const paint = () => $$('.pcard', root).forEach((c) => {
      const i = +c.dataset.i, on = sel.has(i);
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('flag', flag && on !== items[i].bad && on);
    });
    return {
      html: () => `<div class="feed"><div class="feed-head"><span class="fh-av">🛹</span><b>${room.profile}</b><span class="small">· ${items.length} posts</span></div>
        <div class="pick">${items.map((it, i) => `<button class="pcard" data-i="${i}" aria-pressed="false"><span class="p-e">${it.e}</span><span class="p-t">${it.t}</span><span class="p-x" aria-hidden="true">🚩</span></button>`).join('')}</div></div>`,
      bind(el, onChange) {
        root = el;
        el.addEventListener('click', (e) => {
          const c = e.target.closest('.pcard'); if (!c) return;
          const i = +c.dataset.i; if (sel.has(i)) sel.delete(i); else sel.add(i);
          paint(); onChange();
        });
        paint();
      },
      check: () => (!sel.size ? { incomplete: 'Tap the posts you think are a problem first.' } : { total: items.length, wrong: items.map((it, i) => (sel.has(i) === it.bad ? -1 : i)).filter((i) => i >= 0) }),
      label: (i) => plain(items[i].t),
      setFlag(v) { flag = v; paint(); },
      reveal() { sel.clear(); items.forEach((it, i) => it.bad && sel.add(i)); flag = false; root.classList.add('shown'); paint(); },
      lock() { root.classList.add('locked'); },
    };
  }

  function mkOrder(room) {
    const words = room.words, n = words.length, tiles = shuffle([...Array(n).keys()], room.id);
    const slots = Array(n).fill(null);
    let root, flag = false;
    const paint = () => {
      $$('.slot', root).forEach((s, k) => {
        const w = slots[k];
        s.textContent = w == null ? `${k + 1}` : `🗝️ ${words[w]}`;
        s.classList.toggle('filled', w != null);
        s.classList.toggle('flag', flag && w != null && w !== k);
      });
      $$('.tile', root).forEach((t) => { t.disabled = slots.includes(+t.dataset.w); });
    };
    return {
      html: () => `<div class="order">
        <div class="vault-door" aria-hidden="true"><span>🔐</span></div>
        <div class="slots">${words.map((_, k) => `<button class="slot" data-k="${k}" aria-label="Slot ${k + 1}"></button>`).join('')}</div>
        <div class="tiles">${tiles.map((w) => `<button class="tile" data-w="${w}">🗝️ ${words[w]}</button>`).join('')}</div>
      </div>`,
      bind(el, onChange) {
        root = el;
        el.addEventListener('click', (e) => {
          const t = e.target.closest('.tile'), s = e.target.closest('.slot');
          if (t) { const k = slots.indexOf(null); if (k >= 0) slots[k] = +t.dataset.w; }
          else if (s) slots[+s.dataset.k] = null;
          else return;
          paint(); onChange();
        });
        paint();
      },
      check: () => (slots.includes(null) ? { incomplete: 'Put all four keys in the lock first.' } : { total: n, wrong: slots.map((w, k) => (w === k ? -1 : k)).filter((k) => k >= 0) }),
      label: (k) => `slot ${k + 1}`,
      setFlag(v) { flag = v; paint(); },
      reveal() { for (let k = 0; k < n; k++) slots[k] = k; flag = false; root.classList.add('shown'); paint(); },
      lock() { root.classList.add('locked'); },
    };
  }
  const MAKERS = { match: mkMatch, sort: mkSort, pick: mkPick, order: mkOrder };

  /* ---------- challenge room ---------- */
  function roomShell(node, kicker, who, body, color) {
    return `<section class="room" style="--z:${color}">
      <div class="card room-head">
        ${art(node.art)}
        <div class="rh-txt">
          <p class="kicker">${kicker}</p>
          <h2>${node.icon} ${esc(node.title)}</h2>
          <p class="story">${node.story}</p>
          ${who}
        </div>
        <button class="btn ghost map-btn" id="bMap" title="Back to the map">🗺️ Map</button>
      </div>
      ${body}
    </section>`;
  }

  function runChallenge(node, { kicker, color, captain, onDone }) {
    const ctl = MAKERS[node.type](node);
    const att = S.att[node.id] || (S.att[node.id] = { wrong: 0, hints: 0, miss: [] });
    const who = captain ? `<p class="captain"><span class="cap-av">${captain.av}</span> <span><b>${esc(captain.name)}</b> is captain: you tap the answers, but the whole team decides.</span></p>` : '';
    app.innerHTML = roomShell(node, kicker, who, `
      <div class="card task">
        <p class="task-text">${node.task}</p>
        <div class="play" id="play">${ctl.html()}</div>
        <div class="hintbox" id="hintBox" hidden></div>
        <p class="fb" id="fb" aria-live="polite"></p>
        <div class="actions" id="acts">
          <button class="btn primary" id="bCheck">✓ Check</button>
          <button class="btn hint" id="bH1">💡 Hint 1 <small>−20</small></button>
          <button class="btn hint" id="bH2">🔦 Hint 2 <small>−20</small></button>
          <button class="btn help" id="bHelp">🆘 Help us through</button>
          <span class="worth" id="worth"></span>
        </div>
      </div>`, color);
    $('#bMap').addEventListener('click', toMap);
    const fb = $('#fb');
    const worth = () => (att.helped ? 25 : Math.max(30, (att.hints >= 2 ? 60 : att.hints >= 1 ? 80 : 100) - 10 * att.wrong));
    const paint = () => {
      $('#bH1').disabled = att.hints >= 1;
      $('#bH2').disabled = att.hints !== 1;
      $('#bHelp').disabled = !(att.hints >= 2 || att.wrong >= 3);
      $('#bHelp').title = $('#bHelp').disabled ? 'Available after both hints or three tries' : 'Show the answers and continue for 25 points';
      $('#worth').innerHTML = `Worth <b>${worth()}</b> pts${!att.wrong && !att.hints ? ' + ⭐' : ''}`;
      const hb = $('#hintBox');
      hb.hidden = !att.hints;
      hb.innerHTML = node.hints.slice(0, att.hints).map((h, k) => `<p>${k ? '🔦' : '💡'} <b>Hint ${k + 1}:</b> ${h}</p>`).join('') + (att.hints >= 2 ? '<p class="small">🔦 Wrong answers are now outlined in red.</p>' : '');
    };
    ctl.bind($('#play'), () => { fb.textContent = ''; fb.className = 'fb'; });
    ctl.setFlag(att.hints >= 2);
    paint();
    const finish = () => {
      const pts = worth();
      const star = !att.helped && !att.wrong && !att.hints;
      S.rooms[node.id] = { pts, star, wrong: att.wrong, hints: att.hints, helped: !!att.helped, captain: captain ? captain.name : 'team', miss: att.miss };
      save(); paintHeader();
      onDone(pts, star);
    };
    $('#bCheck').addEventListener('click', () => {
      const r = ctl.check();
      if (r.incomplete) { fb.textContent = r.incomplete; fb.className = 'fb warn'; return; }
      if (!r.wrong.length) { ctl.lock(); $('#acts').hidden = true; burst(['⭐', '✨', '🎉']); setTimeout(finish, 350); return; }
      att.wrong++;
      r.wrong.forEach((i) => { const l = ctl.label(i); if (!att.miss.includes(l)) att.miss.push(l); });
      save();
      const right = r.total - r.wrong.length;
      const nudge = att.wrong >= 3 && !att.helped ? '“Help us through” is now available if you need it.'
        : att.wrong >= 2 && !att.hints ? 'Stuck? Try 💡 Hint 1.'
          : 'Talk it through and try again.';
      fb.innerHTML = `<b>${right} of ${r.total} correct.</b> ${nudge}`;
      fb.className = 'fb bad';
      const t = $('.task'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
      paint();
    });
    $('#bH1').addEventListener('click', () => { att.hints = 1; save(); paint(); });
    $('#bH2').addEventListener('click', () => { att.hints = 2; save(); ctl.setFlag(true); paint(); });
    $('#bHelp').addEventListener('click', () => {
      att.helped = true; save();
      ctl.reveal(); ctl.lock();
      fb.innerHTML = '<b>Here are the correct answers.</b> Read them together, then continue.';
      fb.className = 'fb info';
      $('#acts').innerHTML = '<button class="btn primary" id="bCont">I’ve read them: continue ▶</button><span class="worth">Worth <b>25</b> pts</span>';
      $('#bCont').addEventListener('click', finish);
    });
  }

  function advance(i) { S.pos = Math.max(S.pos, i + 1); save(); paintHeader(); }
  function clearedModal(node, pts, star, extra = '') {
    const after = () => {
      if (node.ri === 3) {
        burst(['🗝️', '✨', '⭐']);
        const nz = D.zones[node.zi + 1];
        modal(`<div class="m-big">🗝️</div><h3>Key ${node.zi + 1} of 4 is yours!</h3><p class="small">${node.zone.icon} ${esc(node.zone.name)} cleared</p>
          <p class="key-word" style="--kc:${node.zone.color}">${node.zone.key}</p>
          <p>Keep it safe: you need all four keys to open the Exit Vault.</p>
          <p class="small">${nz ? `Next zone: ${nz.icon} <b>${esc(nz.name)}</b>` : 'Next stop: 🔐 <b>the Exit Vault</b>'}</p>`, [{ label: 'Back to the map 🗺️', cls: 'primary', fn: toMap }]);
      } else toMap();
    };
    modal(`<div class="m-big">🔓</div><h3>Room cleared!</h3>
      <p class="m-pts">+${pts} points ${star ? '<span class="m-star">⭐ star!</span>' : ''}</p>
      ${extra}
      <div class="learn">🧠 <b>Remember:</b> ${node.learn}</div>`, [{ label: 'Continue ▶', cls: 'primary', fn: after }]);
  }

  function renderRoom(node) {
    const i = S.cur;
    if (S.rooms[node.id]) return toMap();
    runChallenge(node, {
      kicker: `Zone ${node.zi + 1} · ${esc(node.zone.name)} · Room ${node.ri + 1} of 4`,
      color: node.zone.color,
      captain: captainFor(i),
      onDone: (pts, star) => { advance(i); clearedModal(node, pts, star); },
    });
  }

  /* ---------- doors ---------- */
  const doorSvg = (icon, k) => `<svg viewBox="0 0 120 150" class="dsvg" aria-hidden="true">
      <path class="frame" d="M10 148V58a50 50 0 0 1 100 0v90z"></path>
      <path class="leaf" d="M22 148V60a38 38 0 0 1 76 0v88z"></path>
      <circle class="knob" cx="84" cy="104" r="5"></circle>
      <text x="60" y="74" class="d-ic">${icon}</text>
      <text x="60" y="128" class="d-n">${'ABC'[k]}</text>
    </svg>`;
  function renderDoor(node) {
    const i = S.cur;
    if (S.rooms[node.id]) return toMap();
    const att = S.att[node.id] || (S.att[node.id] = { tries: [] });
    att.tries = att.tries || [];
    const bonus = [50, 25, 10][att.tries.length] || 10;
    app.innerHTML = roomShell(node, `Zone ${node.zi + 1} · ${esc(node.zone.name)} · Junction`,
      '<p class="captain"><span class="cap-av">👥</span> <span><b>Team decision:</b> everybody must agree before you open a door.</span></p>', `
      <div class="card task door-task">
        <div class="situation ${node.scene.kind}">${node.scene.html}</div>
        <div class="door-side">
          <p class="task-text">Which door do you open?</p>
          <div class="doors">${node.doors.map((d, k) => `<button class="door ${att.tries.includes(k) ? 'tried' : ''}" data-k="${k}" ${att.tries.includes(k) ? 'disabled' : ''}>${doorSvg(d.icon, k)}<span class="dl">${esc(d.label)}</span></button>`).join('')}</div>
          <p class="worth">Right door now: <b>${bonus}</b> pts</p>
        </div>
      </div>`, node.zone.color);
    $('#bMap').addEventListener('click', toMap);
    $('.doors').addEventListener('click', (e) => {
      const b = e.target.closest('.door'); if (!b || b.disabled) return;
      const k = +b.dataset.k, d = node.doors[k];
      att.tries.push(k); save();
      b.classList.add('opening');
      setTimeout(() => {
        if (d.ok) {
          S.rooms[node.id] = { pts: bonus, star: false, door: true };
          advance(i); burst(['🚪', '✨', '⭐']);
          clearedModal(node, bonus, false, `<p class="why good">${d.why}</p>`);
        } else {
          modal(`<div class="m-big trap">🪤</div><h3>It’s a trap!</h3><p class="why bad">${d.why}</p><p class="small">No points lost, but that door is now closed. Go back and choose again.</p>`,
            [{ label: '↩ Back to the doors', cls: 'primary', fn: () => renderDoor(node) }], 'trap-modal');
        }
      }, 450);
    });
  }

  /* ---------- vault ---------- */
  function renderVault() {
    if (!S.rooms.motto) {
      return runChallenge(D.motto, {
        kicker: 'The Exit Vault · Lock 1 of 2',
        color: '#202D4A',
        captain: null,
        onDone: (pts, star) => {
          burst(['🔓', '✨', '🗝️']);
          modal(`<div class="m-big">🔓</div><h3>The first lock clicks open!</h3><p class="m-pts">+${pts} points ${star ? '<span class="m-star">⭐ star!</span>' : ''}</p>
            <p class="key-word" style="--kc:#202D4A">THINK BEFORE YOU SHARE</p>
            <div class="learn">🧠 ${D.motto.learn}</div>
            <p>One lock left: the <b>Final showdown</b>. Each player answers alone. No help from the team!</p>`, [{ label: 'Face the showdown ⚡', cls: 'primary', fn: render }]);
        },
      });
    }
    renderQF();
  }
  function renderQF() {
    const q = S.qf.length;
    if (q >= D.final.length) return finishGame();
    const Q = D.final[q], p = S.players[q % S.players.length];
    const opts = shuffle(Q.a.map((_, k) => k), `qf${q}`);
    app.innerHTML = roomShell({ art: ['⚡', '🔐', '❓', '🏆', '🎯'], icon: '⚡', title: 'Final showdown', story: 'Each player answers alone, in turn. No help from the team this time! Every right answer is worth 50 points.' },
      'The Exit Vault · Lock 2 of 2', '', `
      <div class="card task qf">
        <div class="qf-turn"><span class="big-av">${p.av}</span><div><p class="kicker">Question ${q + 1} of ${D.final.length}</p><h3>${esc(p.name)}, this one is yours!</h3></div></div>
        <p class="qf-q">${Q.q}</p>
        <div class="qf-opts">${opts.map((k) => `<button class="qopt" data-k="${k}">${Q.a[k]}</button>`).join('')}</div>
        <p class="fb" id="fb" aria-live="polite"></p>
        <div class="actions"><button class="btn primary" id="bNext" hidden>${q + 1 < D.final.length ? 'Next player ▶' : 'Open the vault 🔓'}</button></div>
      </div>`, '#202D4A');
    $('#bMap').addEventListener('click', toMap);
    $('.qf-opts').addEventListener('click', (e) => {
      const b = e.target.closest('.qopt'); if (!b) return;
      const k = +b.dataset.k, ok = k === 0;
      S.qf.push({ q: Q.q, player: p.name, pick: Q.a[k], ok }); save(); paintHeader();
      $$('.qopt').forEach((x) => { x.disabled = true; if (+x.dataset.k === 0) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong'); else burst(['⭐', '⚡']);
      const fb = $('#fb');
      fb.innerHTML = `${ok ? '<b>✓ Correct! +50</b>' : `<b>✗ Not quite.</b> The answer is: <b>${Q.a[0]}</b>.`} ${Q.why}`;
      fb.className = `fb ${ok ? 'good' : 'bad'}`;
      $('#bNext').hidden = false; $('#bNext').focus();
    });
    $('#bNext').addEventListener('click', renderQF);
  }
  function finishGame() {
    S.finishedAt = S.finishedAt || Date.now();
    S.pos = NODES.length; S.screen = 'cert'; save();
    burst(['🏆', '🎉', '⭐', '🗝️']);
    render();
  }

  /* ---------- certificate ---------- */
  function renderCert() {
    const p = score(), [rk, rn] = rank(p);
    app.innerHTML = `
      <section class="cert-wrap">
        <div class="cert card" id="cert">
          <div class="cert-top">
            <img src="logo.png" alt="British School crest" class="crest">
            <div><p class="kicker">British School Alzira · Xàtiva · Gandia Group</p><h2>Certificate of Escape</h2></div>
          </div>
          <p class="cert-line">This certifies that</p>
          <p class="cert-team">${esc(S.team)}</p>
          <p class="cert-players">${S.players.map((x) => `<span>${x.av} ${esc(x.name)}</span>`).join('')}</p>
          <p class="cert-line">escaped the Feed! They know how to stay safe online, protect their online reputation and digital footprint, and defend their right to privacy.</p>
          <div class="cert-stats">
            <div><b>${p}</b><span>of ${MAX} points</span></div>
            <div><b>⭐ ${stars()}</b><span>of ${MAX_STARS} stars</span></div>
            <div><b>${fmt(elapsed())}</b><span>time taken</span></div>
            <div><b>${rk}</b><span>${rn}</span></div>
          </div>
          <p class="motto">“Think before you share.”</p>
          <p class="cert-date">Year 10 · Online Safety · ${new Date().toLocaleDateString('en-GB')}</p>
        </div>
        <div class="card cert-side">
          <h3>📨 Send your results to your teacher</h3>
          <p>Press <b>Copy our results</b>, then paste them into a message or document for your teacher.</p>
          <button class="btn primary big" id="bCopy2">📋 Copy our results</button>
          <button class="btn" id="bPrint">🖨️ Print the certificate</button>
          <button class="btn" id="bMap2">🗺️ Look at the map</button>
          <details><summary>See your full results</summary><pre class="rep">${esc(report())}</pre></details>
        </div>
      </section>`;
    $('#bCopy2').addEventListener('click', copyReport);
    $('#bPrint').addEventListener('click', () => window.print());
    $('#bMap2').addEventListener('click', toMap);
  }

  /* ---------- header buttons ---------- */
  $('#btnCopy').addEventListener('click', copyReport);
  $('#btnNew').addEventListener('click', () => modal('<div class="m-big">🔄</div><h3>Start a new game?</h3><p>This deletes your team’s progress on this device. Copy your results first if you need them.</p>',
    [{ label: 'Cancel' }, { label: 'Yes, start again', cls: 'danger', fn: () => { S = fresh(); save(); render(); } }]));
  $('#btnHelp').addEventListener('click', () => modal(`<h3>How to play</h3>
    <ul class="how">
      <li><span>🗺️</span><span>Follow the path on the map. Each zone is a lesson: being safe online, online reputation, big data and the right to privacy.</span></li>
      <li><span>🎯</span><span>The <b>captain</b> taps the answers, but the team decides together. The captain changes every room.</span></li>
      <li><span>🚪</span><span>At junctions, choose a door as a team. Traps cost no points, but the right door first time earns the most.</span></li>
      <li><span>💯</span><span>Rooms: 100 points first time (+ ⭐). −10 for each wrong check. Hint 1 → max 80, Hint 2 → max 60. <b>Help us through</b> = 25.</span></li>
      <li><span>🗝️</span><span>Each zone gives a key. Four keys open the Exit Vault, then everyone faces the Final showdown alone.</span></li>
      <li><span>📋</span><span><b>Copy results</b> copies your team’s report to send to your teacher. Progress is saved on this device.</span></li>
    </ul>
    <p class="small">Based on Oak National Academy, KS4 Computing, Online safety, lessons 1–4 (© Oak National Academy 2025, with the Raspberry Pi Foundation), Open Government Licence v3.0.</p>`, [{ label: 'Got it', cls: 'primary' }]));
  const setProj = (on) => { document.body.classList.toggle('projector', on); $('#btnProjector').setAttribute('aria-pressed', String(on)); try { localStorage.setItem('etf-projector', on ? '1' : '0'); } catch (e) { /* ignore */ } };
  try { setProj(localStorage.getItem('etf-projector') === '1'); } catch (e) { /* ignore */ }
  $('#btnProjector').addEventListener('click', () => setProj(!document.body.classList.contains('projector')));
  $('#btnFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); });

  window.ETF_DEBUG = { get S() { return S; }, NODES, MAX, render, report };
  render();
})();
