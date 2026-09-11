// ===== RIFAS =====
// Modelo en Firestore, colección "rifas" (separada del documento grande del curso):
// { id, name, date, totalNumbers, prizes:[{rank,name}], soldNumbers:[{number,buyer}],
//   results:[{rank,name,number,buyer}] (vacío hasta sortear), drawn:boolean, createdBy, createdAt }

const RIFA_TOTAL_NUMBERS = 205; // fijo para todas las rifas del curso
let currentRifaId = null;      // rifa que se está viendo/sorteando
let rifaDrawOrder = [];        // premios en orden de sorteo (del último al N°1)
let rifaDrawIdx = 0;
let rifaUsedNumbers = new Set();
let rifaResults = [];

async function loadRifas() {
    try {
        const snap = await db.collection('rifas').orderBy('createdAt', 'desc').get();
        rifas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Error al cargar rifas:', e);
        rifas = [];
    }
}

function renderRifas() {
    const list = document.getElementById('rifas-list');
    if (!list) return;
    if (!rifas || rifas.length === 0) {
        list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-light);"><p style="font-size:1.1rem;">Aún no hay rifas creadas.</p></div>';
        return;
    }
    list.innerHTML = rifas.map(r => {
        const fecha = r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
        const badge = r.drawn ? '<span class="badge badge-paid">Sorteada</span>' : '<span class="badge badge-pending">Pendiente</span>';
        return `<div class="card" style="margin-bottom:1rem; border-left:4px solid var(--neon-magenta); cursor:pointer;" onclick="openRifaDetail('${r.id}')">
<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
<div>
<div style="font-size:0.8rem; color:var(--text-light); margin-bottom:0.2rem;">${fecha}</div>
<strong style="font-size:1.05rem;">${r.name}</strong>
</div>
${badge}
</div>
<div class="rifa-meta"><span>🎫 <b>${r.soldNumbers.length}</b> de ${r.totalNumbers} vendidos</span><span>🏆 <b>${r.prizes.length}</b> premio${r.prizes.length === 1 ? '' : 's'}</span></div>
</div>`;
    }).join('');
}

// ===== Crear rifa =====

function openCreateRifaModal() {
    document.getElementById('rifa-name').value = '';
    document.getElementById('rifa-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('range-input').value = '';
    document.getElementById('range-count').textContent = '0 números detectados';
    document.getElementById('file-drop').textContent = '📄 Toca para elegir un archivo CSV';
    document.getElementById('file-drop').classList.remove('has-file');
    document.getElementById('prize-edit-list').innerHTML = '';
    addPrizeRow(); addPrizeRow();
    switchLoadTab('range');
    csvSoldNumbers = null;
    document.getElementById('modal-rifa').classList.add('active');
}

function addPrizeRow() {
    const list = document.getElementById('prize-edit-list');
    const row = document.createElement('div');
    row.className = 'prize-edit-row';
    row.innerHTML = `<div class="prize-edit-rank"></div><input type="text" class="prize-name-input" placeholder="Nombre del premio"><button type="button" class="btn btn-sm btn-danger" onclick="removePrizeRow(this)">✕</button>`;
    list.appendChild(row);
    renumberPrizeRows();
}
function removePrizeRow(btn) {
    const list = document.getElementById('prize-edit-list');
    if (list.children.length <= 1) { alert('La rifa necesita al menos 1 premio.'); return; }
    btn.closest('.prize-edit-row').remove();
    renumberPrizeRows();
}
function renumberPrizeRows() {
    document.querySelectorAll('#prize-edit-list .prize-edit-row').forEach((row, idx) => {
        row.querySelector('.prize-edit-rank').textContent = idx + 1;
    });
}

function switchLoadTab(which) {
    document.getElementById('tab-range').classList.toggle('active', which === 'range');
    document.getElementById('tab-csv').classList.toggle('active', which === 'csv');
    document.getElementById('panel-range').classList.toggle('active', which === 'range');
    document.getElementById('panel-csv').classList.toggle('active', which === 'csv');
}

// "1-40, 45, 50-90" -> Map(numero -> comprador null). Ignora numeros fuera de 1..205 y duplicados.
function parseRangeInput(text) {
    const nums = new Map();
    text.split(',').forEach(part => {
        part = part.trim();
        if (!part) return;
        if (part.includes('-')) {
            const [a, b] = part.split('-').map(n => parseInt(n.trim(), 10));
            if (!isNaN(a) && !isNaN(b)) {
                for (let n = Math.min(a, b); n <= Math.max(a, b); n++) {
                    if (n >= 1 && n <= RIFA_TOTAL_NUMBERS) nums.set(n, null);
                }
            }
        } else {
            const n = parseInt(part, 10);
            if (!isNaN(n) && n >= 1 && n <= RIFA_TOTAL_NUMBERS) nums.set(n, null);
        }
    });
    return nums;
}
function updateRangeCount() {
    const nums = parseRangeInput(document.getElementById('range-input').value);
    document.getElementById('range-count').textContent = `${nums.size} número${nums.size === 1 ? '' : 's'} detectado${nums.size === 1 ? '' : 's'}`;
}

// Parser de CSV simple: columnas "numero" y, opcional, "comprador" (con o sin encabezado).
let csvSoldNumbers = null;
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const drop = document.getElementById('file-drop');
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            const nums = new Map();
            lines.forEach(line => {
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                const n = parseInt(cols[0], 10);
                if (!isNaN(n) && n >= 1 && n <= RIFA_TOTAL_NUMBERS) {
                    nums.set(n, cols[1] || null);
                }
            });
            csvSoldNumbers = nums;
            drop.textContent = `✅ ${file.name} — ${nums.size} número${nums.size === 1 ? '' : 's'} detectado${nums.size === 1 ? '' : 's'}`;
            drop.classList.add('has-file');
        } catch (err) {
            console.error(err);
            alert('No se pudo leer el archivo. Verifica que sea un CSV válido.');
        }
    };
    reader.readAsText(file);
}

async function saveNewRifa() {
    const name = document.getElementById('rifa-name').value.trim();
    const date = document.getElementById('rifa-date').value;
    const prizeInputs = document.querySelectorAll('#prize-edit-list .prize-name-input');
    const prizeNames = Array.from(prizeInputs).map(i => i.value.trim()).filter(v => v);
    if (!name || !date) return alert('Completa el nombre y la fecha de la rifa.');
    if (prizeNames.length === 0) return alert('Agrega al menos un premio.');

    const isCsvTab = document.getElementById('tab-csv').classList.contains('active');
    const numbersMap = isCsvTab ? (csvSoldNumbers || new Map()) : parseRangeInput(document.getElementById('range-input').value);
    if (numbersMap.size === 0) return alert('Carga al menos un número vendido (por rango de texto o CSV).');

    const soldNumbers = Array.from(numbersMap.entries()).map(([number, buyer]) => ({ number, buyer: buyer || null }));
    const prizes = prizeNames.map((n, i) => ({ rank: i + 1, name: n }));
    const rifa = { name, date, totalNumbers: RIFA_TOTAL_NUMBERS, prizes, soldNumbers, results: [], drawn: false, createdBy: currentUser, createdAt: new Date().toISOString() };

    try {
        const id = generateShortId();
        await db.collection('rifas').doc(id).set(rifa);
        rifas.unshift({ id, ...rifa });
        logActivity('CREAR_RIFA', `Creó la rifa "${name}" con ${soldNumbers.length} números vendidos y ${prizes.length} premio(s)`);
        closeModal('modal-rifa');
        renderRifas();
        alert('Rifa creada correctamente');
    } catch (e) {
        console.error(e);
        alert('No se pudo crear la rifa. Revisa tu conexión e intenta de nuevo.');
    }
}

// ===== Detalle / Sorteo =====

function openRifaDetail(id) {
    const rifa = rifas.find(r => r.id === id);
    if (!rifa) return;
    currentRifaId = id;
    document.getElementById('rifas-view-list').style.display = 'none';
    document.getElementById('rifas-view-detail').style.display = 'block';
    renderRifaDetail(rifa);
}
function closeRifaDetail() {
    document.getElementById('rifas-view-detail').style.display = 'none';
    document.getElementById('rifas-view-list').style.display = 'block';
    currentRifaId = null;
}

function renderRifaDetail(rifa) {
    const fecha = rifa.date ? new Date(rifa.date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const prizesSortedByRank = [...rifa.prizes].sort((a, b) => a.rank - b.rank);

    const prizesHTML = prizesSortedByRank.map(p => {
        const result = (rifa.results || []).find(r => r.rank === p.rank);
        const winnerText = result ? `${result.buyer ? result.buyer + ' — ' : ''}N°${String(result.number).padStart(3, '0')}` : '—';
        return `<div class="prize-row"><div class="prize-rank">${p.rank}</div><div class="prize-name">${p.name}</div><div class="prize-winner">${winnerText}</div></div>`;
    }).join('');

    const startBtnHTML = rifa.drawn
        ? ''
        : `<button class="btn btn-primary" style="width:100%;" onclick="startRifaDraw()" id="rifa-start-btn">🎉 Iniciar Sorteo</button>`;

    const actionsHTML = rifa.drawn
        ? `<div class="input-group"><label>Buscar número o comprador</label><input type="text" class="rifa-search-input" id="rifa-search" oninput="filterRifaResults()" placeholder="Ej: 143 o María"></div>
           <table class="rifa-results-table" id="rifa-results-table"><thead><tr><th>Premio</th><th>N°</th><th>Comprador</th></tr></thead><tbody id="rifa-results-body"></tbody></table>
           <div class="actions-row" style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;"><button class="btn btn-sm btn-success" onclick="exportRifaPDF()">📄 Exportar PDF</button><button class="btn btn-sm btn-info" onclick="shareRifaWhatsApp()">💬 Compartir WhatsApp</button></div>`
        : '';

    document.getElementById('rifa-detail-content').innerHTML = `
<div class="card">
<p style="font-size:0.85rem; color:var(--text-light); margin:0 0 2px;">${fecha}</p>
<p style="font-size:1.2rem; font-weight:700; margin:0 0 10px;">${rifa.name}</p>
<div class="numbers-summary">
<div class="num-stat"><div class="n">${rifa.soldNumbers.length}</div><div class="l">Vendidos</div></div>
<div class="num-stat"><div class="n">${rifa.totalNumbers}</div><div class="l">Total</div></div>
<div class="num-stat"><div class="n">${rifa.prizes.length}</div><div class="l">Premios</div></div>
</div>
<div class="prizes-list">${prizesHTML}</div>
${startBtnHTML}
${actionsHTML}
</div>
<div class="card" id="rifa-draw-card" style="display:none;">
<div class="draw-stage">
<h3 id="rifa-draw-title">Sorteando Premio</h3>
<div class="drawing-for" id="rifa-draw-for"></div>
<div class="roulette-box" id="rifa-roulette-box">
<div class="roulette-number" id="rifa-roulette-number">000</div>
<div class="winner-reveal" id="rifa-winner-reveal">
<div class="trophy">🏆</div>
<div class="grand-label">★ GRAN PREMIO ★</div>
<div class="name" id="rifa-winner-name">—</div>
<div class="sub" id="rifa-winner-sub">—</div>
</div>
</div>
<button class="btn btn-info" id="rifa-next-btn" style="display:none;" onclick="nextRifaPrize()">Siguiente Premio →</button>
</div>
</div>`;

    if (rifa.drawn) renderRifaResultsTable(rifa.results, rifa.soldNumbers.length);
}

function startRifaDraw() {
    const rifa = rifas.find(r => r.id === currentRifaId);
    if (!rifa) return;
    document.getElementById('rifa-start-btn').style.display = 'none';
    document.getElementById('rifa-draw-card').style.display = 'block';
    rifaDrawOrder = [...rifa.prizes].sort((a, b) => b.rank - a.rank); // del último premio al N°1
    rifaDrawIdx = 0;
    rifaUsedNumbers = new Set();
    rifaResults = [];
    drawRifaPrize();
}

// Aleatoriedad verificable: usa crypto.getRandomValues() del navegador, no Math.random().
function secureRandomIndex(max) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
}

function drawRifaPrize() {
    const rifa = rifas.find(r => r.id === currentRifaId);
    const prize = rifaDrawOrder[rifaDrawIdx];
    const isGrand = prize.rank === 1;
    document.getElementById('rifa-draw-title').textContent = `Sorteando Premio N°${prize.rank}`;
    document.getElementById('rifa-draw-for').textContent = `${prize.name} (Premio N°${prize.rank})`;
    const revealEl = document.getElementById('rifa-winner-reveal');
    revealEl.classList.remove('show');
    revealEl.classList.toggle('grand', isGrand);
    document.getElementById('rifa-roulette-box').classList.toggle('grand', isGrand);
    document.getElementById('rifa-next-btn').style.display = 'none';
    const numEl = document.getElementById('rifa-roulette-number');
    numEl.classList.remove('landed');

    const pool = rifa.soldNumbers.filter(s => !rifaUsedNumbers.has(s.number));
    const winnerEntry = pool[secureRandomIndex(pool.length)];
    rifaUsedNumbers.add(winnerEntry.number);

    let tick = 0;
    const totalTicks = 62;
    function step() {
        tick++;
        if (tick < totalTicks) {
            const randomShown = pool[Math.floor(Math.random() * pool.length)].number;
            numEl.textContent = String(randomShown).padStart(3, '0');
            const progress = tick / totalTicks;
            const delay = 55 + Math.pow(progress, 3) * 620;
            setTimeout(step, delay);
        } else {
            numEl.textContent = String(winnerEntry.number).padStart(3, '0');
            numEl.classList.add('landed');
            setTimeout(() => {
                const buyerLabel = winnerEntry.buyer || 'Sin nombre registrado';
                document.getElementById('rifa-winner-name').textContent = buyerLabel;
                document.getElementById('rifa-winner-sub').textContent = `Número ganador: ${String(winnerEntry.number).padStart(3, '0')}`;
                revealEl.classList.add('show');
                rifaResults.push({ rank: prize.rank, name: prize.name, number: winnerEntry.number, buyer: winnerEntry.buyer || null });
                launchRifaConfetti(isGrand);
                document.getElementById('rifa-next-btn').style.display = 'inline-flex';
                document.getElementById('rifa-next-btn').textContent = (rifaDrawIdx < rifaDrawOrder.length - 1) ? 'Siguiente Premio →' : 'Ver Resumen Final →';
            }, 900);
        }
    }
    step();
}

async function nextRifaPrize() {
    rifaDrawIdx++;
    if (rifaDrawIdx < rifaDrawOrder.length) {
        drawRifaPrize();
        return;
    }
    // Sorteo completo: guardar resultados en Firestore
    document.getElementById('rifa-draw-card').style.display = 'none';
    try {
        await db.collection('rifas').doc(currentRifaId).update({ results: rifaResults, drawn: true });
        const idx = rifas.findIndex(r => r.id === currentRifaId);
        if (idx !== -1) { rifas[idx].results = rifaResults; rifas[idx].drawn = true; }
        logActivity('SORTEAR_RIFA', `Realizó el sorteo de la rifa "${rifas[idx].name}"`);
        renderRifas();
        renderRifaDetail(rifas[idx]);
    } catch (e) {
        console.error(e);
        alert('El sorteo se realizó pero no se pudo guardar el resultado. Revisa tu conexión.');
    }
}

function renderRifaResultsTable(results, totalSold) {
    const body = document.getElementById('rifa-results-body');
    if (!body) return;
    const sorted = [...results].sort((a, b) => a.rank - b.rank);
    body.innerHTML = sorted.map(r => `<tr data-search="${(r.buyer || '').toLowerCase()} ${r.number}"><td>N°${r.rank} — ${r.name}</td><td>${String(r.number).padStart(3, '0')}</td><td>${r.buyer || '-'}</td></tr>`).join('');
}
function filterRifaResults() {
    const q = document.getElementById('rifa-search').value.trim().toLowerCase();
    document.querySelectorAll('#rifa-results-body tr').forEach(tr => {
        tr.style.display = tr.getAttribute('data-search').includes(q) ? '' : 'none';
    });
}

// ===== Exportar PDF (impresión nativa, mismo criterio que Morosidad/Transparencia) =====
function exportRifaPDF() {
    const rifa = rifas.find(r => r.id === currentRifaId);
    if (!rifa) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Tu navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para este sitio e inténtalo de nuevo.');
        return;
    }
    const fecha = rifa.date ? new Date(rifa.date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const sorted = [...(rifa.results || [])].sort((a, b) => a.rank - b.rank);
    const rows = sorted.map(r => `<tr><td>N°${r.rank} — ${r.name}</td><td>${String(r.number).padStart(3, '0')}</td><td>${r.buyer || '-'}</td></tr>`).join('');
    const cssHref = new URL('css/styles.css', window.location.href).href;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${rifa.name}</title><link rel="stylesheet" href="${cssHref}"><style>
body { margin: 0; padding: 16px; background: #fff; color: #1e293b; }
.card { border: 1px solid #ddd; box-shadow: none; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; font-size: 0.9rem; }
.print-toolbar { text-align: center; padding: 14px; background: #f1f5f9; margin-bottom: 16px; border-radius: 8px; }
.print-toolbar button { padding: 10px 18px; font-size: 1rem; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
@media print { .print-toolbar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="print-toolbar"><button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>
<div class="card" style="padding:1.3rem; border-radius:12px;">
<p style="color:#64748b; font-size:0.85rem; margin:0;">${fecha}</p>
<h2 style="margin:4px 0 12px;">${rifa.name}</h2>
<p><b>${rifa.soldNumbers.length}</b> de ${rifa.totalNumbers} números vendidos &nbsp;·&nbsp; <b>${rifa.prizes.length}</b> premio${rifa.prizes.length === 1 ? '' : 's'}</p>
<table><thead><tr><th>Premio</th><th>N° Ganador</th><th>Comprador</th></tr></thead><tbody>${rows}</tbody></table>
</div>
</body></html>`);
    printWindow.document.close();
    logActivity('EXPORTAR_RIFA_PDF', `Exportó PDF de resultados de la rifa "${rifa.name}"`);
    printWindow.onload = () => { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400); };
}

function shareRifaWhatsApp() {
    const rifa = rifas.find(r => r.id === currentRifaId);
    if (!rifa) return;
    const sorted = [...(rifa.results || [])].sort((a, b) => a.rank - b.rank);
    let text = `🎉 *Resultados de la Rifa: ${rifa.name}*\n\n`;
    sorted.forEach(r => {
        text += `🏆 Premio N°${r.rank} — ${r.name}: N°${String(r.number).padStart(3, '0')}${r.buyer ? ' — ' + r.buyer : ''}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ===== Confeti (canvas, sin librerías externas) =====
const rifaConfettiColors = ['#00e5ff', '#ff2ee6', '#39ff14', '#b026ff', '#ffb800'];
const rifaGoldColors = ['#ffd700', '#ffb800', '#fff4cc', '#ffec8b'];
let rifaParticles = [];
let rifaConfettiRunning = false;

function rifaResizeCanvas() {
    const c = document.getElementById('confetti-canvas');
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
}
window.addEventListener('resize', rifaResizeCanvas);

function spawnRifaBurst(originX, originY, count, colors, power) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.random() * Math.PI) - Math.PI / 2 - Math.PI / 2;
        const speed = (4 + Math.random() * 9) * power;
        rifaParticles.push({
            x: originX, y: originY,
            vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1) + (Math.random() - 0.5) * 6,
            vy: Math.sin(angle) * speed - 6 - Math.random() * 4 * power,
            size: 9 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * 360,
            vrot: (Math.random() - 0.5) * 22,
            life: 0, maxLife: 100 + Math.random() * 50
        });
    }
    if (!rifaConfettiRunning) { rifaConfettiRunning = true; animateRifaConfetti(); }
}

function launchRifaConfetti(isGrand) {
    rifaResizeCanvas();
    const box = document.getElementById('rifa-roulette-box');
    const rect = box.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const leftX = Math.max(originX - 90, 20);
    const rightX = Math.min(originX + 90, window.innerWidth - 20);
    const base = isGrand ? 260 : 190;
    const spacing = 800;

    const shots = [
        { x: originX, count: base, power: 1, colors: rifaConfettiColors },
        { x: leftX, count: base * 0.75, power: 0.9, colors: rifaConfettiColors },
        { x: rightX, count: base * 0.75, power: 0.9, colors: rifaConfettiColors },
        { x: originX, count: base * 0.85, power: 1.05, colors: rifaConfettiColors },
        { x: originX, count: base * 0.7, power: 0.9, colors: isGrand ? rifaGoldColors : rifaConfettiColors }
    ];
    shots.forEach((s, i) => {
        setTimeout(() => spawnRifaBurst(s.x, originY, Math.round(s.count), s.colors, s.power), i * spacing);
    });
    if (isGrand) {
        const extraStart = shots.length * spacing + 300;
        setTimeout(() => spawnRifaBurst(leftX, originY, 130, rifaGoldColors, 0.9), extraStart);
        setTimeout(() => spawnRifaBurst(rightX, originY, 130, rifaGoldColors, 0.9), extraStart);
    }
}

function animateRifaConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) { rifaConfettiRunning = false; return; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rifaParticles.forEach(p => {
        p.life++;
        p.vy += 0.22;
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
    });
    rifaParticles = rifaParticles.filter(p => p.life < p.maxLife);
    if (rifaParticles.length > 0) {
        requestAnimationFrame(animateRifaConfetti);
    } else {
        rifaConfettiRunning = false;
    }
}
