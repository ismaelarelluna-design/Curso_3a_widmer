// ===== RIFAS =====
// Modelo en Firestore, colección "rifas" (separada del documento grande del curso):
// { id, name, date, totalNumbers, prizes:[{rank,name}], soldNumbers:[{number,buyer}],
//   results:[{rank,name,number,buyer}] (vacío hasta sortear), drawn:boolean,
//   createdBy, createdAt, updatedBy, updatedAt }
// Regla de negocio: un número está VENDIDO solo si tiene el nombre del comprador.
// Si no se sabe quién lo compró, se anota "Sin identificar".

const RIFA_TOTAL_NUMBERS = 205; // fijo para todas las rifas del curso
const RIFA_UNKNOWN_BUYER = 'Sin identificar';
const RIFA_NAME_MAX = 60;

let currentRifaId = null;      // rifa que se está viendo/sorteando
let rifaDrawOrder = [];        // premios en orden de sorteo (del último al N°1)
let rifaDrawIdx = 0;
let rifaUsedNumbers = new Set();
let rifaResults = [];

// Estado del editor (crear / editar)
let rifaEditingId = null;      // null = creando una rifa nueva
let rifaEditingBase = null;    // updatedAt de la versión cargada (detecta ediciones simultáneas)
let rifaBuyers = {};           // { numero: "Nombre" } -> solo números con nombre = vendidos
let rifaGridFilter = 'all';
let rifaDraftTimer = null;
let rifaSaving = false;

// ===== Utilidades =====

const escapeRifaHtml = escapeHtml; // definido en core/utils.js
function cleanBuyerName(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, RIFA_NAME_MAX);
}
// Clave de comparación: sin mayúsculas, tildes ni espacios dobles ("maria  perez" == "María Pérez")
function buyerKey(value) {
    return cleanBuyerName(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const pad3 = n => String(n).padStart(3, '0');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function formatRifaDate(date) {
    return date ? new Date(date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
}

// ===== Carga y listado =====

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
        const badge = r.drawn ? '<span class="badge badge-paid">Sorteada</span>' : '<span class="badge badge-pending">Pendiente</span>';
        return `<div class="card" style="margin-bottom:1rem; border-left:4px solid var(--neon-magenta); cursor:pointer;" onclick="openRifaDetail('${r.id}')">
<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
<div>
<div style="font-size:0.8rem; color:var(--text-light); margin-bottom:0.2rem;">${formatRifaDate(r.date)}</div>
<strong style="font-size:1.05rem;">${escapeRifaHtml(r.name)}</strong>
</div>
${badge}
</div>
<div class="rifa-meta"><span>🎫 <b>${r.soldNumbers.length}</b> de ${r.totalNumbers} vendidos</span><span>🏆 <b>${r.prizes.length}</b> premio${r.prizes.length === 1 ? '' : 's'}</span></div>
</div>`;
    }).join('');
}

// ===== Editor de rifa (crear / editar) =====

function openCreateRifaModal() { openRifaEditor(null); }
function openEditRifaModal() { openRifaEditor(currentRifaId); }

function openRifaEditor(id) {
    const rifa = id ? rifas.find(r => r.id === id) : null;
    if (id && !rifa) return;
    if (rifa && rifa.drawn) return alert('Esta rifa ya fue sorteada y no se puede modificar.');

    rifaEditingId = id;
    rifaEditingBase = rifa ? (rifa.updatedAt || rifa.createdAt || null) : null;
    ensureRifaGrid();

    // Valores base: rifa existente o formulario vacío
    let form = { name: '', date: new Date().toLocaleDateString('sv-SE'), prizes: ['', ''], buyers: {} };
    let legacyUnnamed = 0;
    if (rifa) {
        form.name = rifa.name;
        form.date = rifa.date;
        form.prizes = [...rifa.prizes].sort((a, b) => a.rank - b.rank).map(p => p.name);
        rifa.soldNumbers.forEach(s => {
            const buyer = cleanBuyerName(s.buyer);
            if (!buyer) legacyUnnamed++;
            form.buyers[s.number] = buyer || RIFA_UNKNOWN_BUYER; // rifas antiguas sin nombre no se pierden
        });
    }

    // Borrador sin guardar (se guarda en este teléfono/computador mientras escribes)
    const draft = loadRifaDraft();
    if (draft) {
        const when = new Date(draft.savedAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const soldInDraft = Object.values(draft.buyers || {}).filter(v => cleanBuyerName(v)).length;
        if (confirm(`Hay un borrador sin guardar de ${when} (${plural(soldInDraft, 'número vendido', 'números vendidos')}).\n\nAceptar: recuperarlo\nCancelar: descartarlo`)) {
            form = { name: draft.name || '', date: draft.date || form.date, prizes: draft.prizes && draft.prizes.length ? draft.prizes : form.prizes, buyers: draft.buyers || {} };
            legacyUnnamed = 0;
        } else {
            clearRifaDraft();
        }
    }

    document.getElementById('rifa-modal-title').textContent = rifa ? 'Editar Rifa' : 'Nueva Rifa';
    document.getElementById('rifa-save-btn').textContent = rifa ? 'Guardar cambios' : 'Crear Rifa';
    document.getElementById('rifa-name').value = form.name;
    document.getElementById('rifa-date').value = form.date;
    document.getElementById('prize-edit-list').innerHTML = '';
    form.prizes.forEach(p => addPrizeRow(p));
    if (form.prizes.length === 0) addPrizeRow();

    rifaBuyers = {};
    Object.entries(form.buyers).forEach(([n, name]) => {
        const num = parseInt(n, 10);
        const clean = cleanBuyerName(name);
        if (num >= 1 && num <= RIFA_TOTAL_NUMBERS && clean) rifaBuyers[num] = clean;
    });

    document.getElementById('rifa-assign-range').value = '';
    document.getElementById('rifa-assign-name').value = '';
    document.getElementById('rifa-grid-search').value = '';
    setRifaToolMsg('');
    const note = document.getElementById('rifa-grid-note');
    note.hidden = legacyUnnamed === 0;
    note.textContent = legacyUnnamed ? `${plural(legacyUnnamed, 'número vendido no tenía', 'números vendidos no tenían')} nombre y quedaron como "${RIFA_UNKNOWN_BUYER}". Puedes completarlos.` : '';

    syncRifaGridInputs();
    setRifaGridFilter('all');
    refreshRifaBuyersDatalist();
    updateRifaSoldCount();
    document.getElementById('rifa-num-grid').scrollTop = 0;
    document.querySelector('#modal-rifa .modal-content').scrollTop = 0;
    document.getElementById('modal-rifa').classList.add('active');
}

function addPrizeRow(value) {
    const list = document.getElementById('prize-edit-list');
    const row = document.createElement('div');
    row.className = 'prize-edit-row';
    row.innerHTML = `<div class="prize-edit-rank"></div><input type="text" class="prize-name-input" placeholder="Nombre del premio" maxlength="80"><button type="button" class="btn btn-sm btn-danger" onclick="removePrizeRow(this)">✕</button>`;
    row.querySelector('input').value = typeof value === 'string' ? value : '';
    list.appendChild(row);
    renumberPrizeRows();
}
function removePrizeRow(btn) {
    const list = document.getElementById('prize-edit-list');
    if (list.children.length <= 1) { alert('La rifa necesita al menos 1 premio.'); return; }
    btn.closest('.prize-edit-row').remove();
    renumberPrizeRows();
    scheduleRifaDraft();
}
function renumberPrizeRows() {
    document.querySelectorAll('#prize-edit-list .prize-edit-row').forEach((row, idx) => {
        row.querySelector('.prize-edit-rank').textContent = idx + 1;
    });
}

// ----- Lista de 205 números -----

// Se construye una sola vez; después solo se actualizan los valores.
function ensureRifaGrid() {
    const grid = document.getElementById('rifa-num-grid');
    if (grid.dataset.ready) return;
    let html = '';
    for (let n = 1; n <= RIFA_TOTAL_NUMBERS; n++) {
        html += `<div class="rifa-num-row" data-n="${n}"><span class="rifa-num-badge">${pad3(n)}</span><input type="text" class="rifa-buyer-input" data-n="${n}" maxlength="${RIFA_NAME_MAX}" list="rifa-buyers-datalist" placeholder="Libre" autocomplete="off" aria-label="Comprador del número ${n}"></div>`;
    }
    grid.innerHTML = html;
    grid.dataset.ready = '1';

    // Mientras escribe: actualiza estado y contador
    grid.addEventListener('input', e => {
        if (!e.target.classList.contains('rifa-buyer-input')) return;
        const n = parseInt(e.target.dataset.n, 10);
        const clean = cleanBuyerName(e.target.value);
        if (clean) rifaBuyers[n] = clean; else delete rifaBuyers[n];
        e.target.parentElement.classList.toggle('sold', !!clean);
        updateRifaSoldCount();
    });
    // Al salir de la casilla: unifica el nombre con uno ya escrito ("juan perez" -> "Juan Pérez")
    grid.addEventListener('change', e => {
        if (!e.target.classList.contains('rifa-buyer-input')) return;
        const n = parseInt(e.target.dataset.n, 10);
        const clean = cleanBuyerName(e.target.value);
        if (clean) {
            const canonical = canonicalBuyer(clean, n);
            rifaBuyers[n] = canonical;
            e.target.value = canonical;
        } else {
            e.target.value = '';
        }
        refreshRifaBuyersDatalist();
    });

    // Cualquier cambio en el formulario guarda borrador
    document.getElementById('modal-rifa').addEventListener('input', scheduleRifaDraft);
}

function syncRifaGridInputs() {
    document.querySelectorAll('#rifa-num-grid .rifa-buyer-input').forEach(input => {
        const n = parseInt(input.dataset.n, 10);
        input.value = rifaBuyers[n] || '';
        input.parentElement.classList.toggle('sold', !!rifaBuyers[n]);
    });
}

// Devuelve la forma ya usada de un nombre si existe (ignora mayúsculas/tildes), si no el mismo nombre.
function canonicalBuyer(name, exceptNumber) {
    const key = buyerKey(name);
    for (const [n, existing] of Object.entries(rifaBuyers)) {
        if (Number(n) !== exceptNumber && buyerKey(existing) === key) return existing;
    }
    return name;
}

function refreshRifaBuyersDatalist() {
    const seen = new Map();
    Object.values(rifaBuyers).forEach(name => { if (!seen.has(buyerKey(name))) seen.set(buyerKey(name), name); });
    // Sugiere también los apoderados registrados en el curso
    ((typeof appData !== 'undefined' && appData.students) || []).forEach(s => {
        const guard = cleanBuyerName(s.guard);
        if (guard && !seen.has(buyerKey(guard))) seen.set(buyerKey(guard), guard);
    });
    const names = [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
    document.getElementById('rifa-buyers-datalist').innerHTML = names.map(n => `<option value="${escapeRifaHtml(n)}"></option>`).join('');
}

function updateRifaSoldCount() {
    const sold = Object.keys(rifaBuyers).length;
    const buyers = new Set(Object.values(rifaBuyers).map(buyerKey)).size;
    document.getElementById('rifa-sold-count').innerHTML =
        `🎫 <b>${sold}</b> vendidos · <b>${RIFA_TOTAL_NUMBERS - sold}</b> libres · 👤 <b>${buyers}</b> comprador${buyers === 1 ? '' : 'es'}`;
}

function setRifaGridFilter(filter) {
    rifaGridFilter = filter;
    document.querySelectorAll('#modal-rifa .rifa-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    applyRifaGridFilter();
}
function applyRifaGridFilter() {
    const q = document.getElementById('rifa-grid-search').value.trim();
    const qKey = buyerKey(q);
    const qNum = /^\d+$/.test(q) ? parseInt(q, 10) : null;
    document.querySelectorAll('#rifa-num-grid .rifa-num-row').forEach(row => {
        const n = parseInt(row.dataset.n, 10);
        const buyer = rifaBuyers[n];
        let show = rifaGridFilter === 'all' || (rifaGridFilter === 'sold' ? !!buyer : !buyer);
        if (show && q) show = qNum !== null ? n === qNum : (!!buyer && buyerKey(buyer).includes(qKey));
        row.hidden = !show;
    });
}

function setRifaToolMsg(text, isError) {
    const el = document.getElementById('rifa-tool-msg');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
}

// ----- Asignar / liberar rangos -----

// "1-40, 45; 50-90" -> Map(numero -> null). Acepta coma, punto y coma o salto de línea.
// Ignora números fuera de 1..205 y duplicados.
function parseRangeInput(text) {
    const nums = new Map();
    String(text || '').replace(/[–—]/g, '-').split(/[,;\n]+/).forEach(part => {
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

function rifaAssignRange() {
    const nums = [...parseRangeInput(document.getElementById('rifa-assign-range').value).keys()];
    const rawName = cleanBuyerName(document.getElementById('rifa-assign-name').value);
    if (nums.length === 0) return setRifaToolMsg('Escribe los números. Ej: 10-30, 45', true);
    if (!rawName) return setRifaToolMsg('Escribe el nombre del comprador.', true);
    const name = canonicalBuyer(rawName, null);

    const conflicts = nums.filter(n => rifaBuyers[n] && buyerKey(rifaBuyers[n]) !== buyerKey(name));
    if (conflicts.length) {
        const sample = conflicts.slice(0, 5).map(n => `N°${pad3(n)} (${rifaBuyers[n]})`).join(', ');
        const more = conflicts.length > 5 ? ` y ${conflicts.length - 5} más` : '';
        if (!confirm(`${plural(conflicts.length, 'número ya tiene', 'números ya tienen')} otro comprador: ${sample}${more}.\n\n¿Reemplazarlos por "${name}"?`)) return;
    }
    nums.forEach(n => { rifaBuyers[n] = name; });
    syncRifaGridInputs();
    applyRifaGridFilter();
    refreshRifaBuyersDatalist();
    updateRifaSoldCount();
    scheduleRifaDraft();
    document.getElementById('rifa-assign-range').value = '';
    document.getElementById('rifa-assign-name').value = '';
    setRifaToolMsg(`✅ ${plural(nums.length, 'número asignado', 'números asignados')} a ${name}`);
}

function rifaClearRange() {
    const nums = [...parseRangeInput(document.getElementById('rifa-assign-range').value).keys()];
    if (nums.length === 0) return setRifaToolMsg('Escribe en "Números" cuáles quieres liberar. Ej: 10-30', true);
    const sold = nums.filter(n => rifaBuyers[n]);
    if (sold.length === 0) return setRifaToolMsg('Esos números ya están libres.');
    if (!confirm(`¿Liberar ${plural(sold.length, 'número', 'números')}? Se borrará el nombre del comprador.`)) return;
    sold.forEach(n => { delete rifaBuyers[n]; });
    syncRifaGridInputs();
    applyRifaGridFilter();
    refreshRifaBuyersDatalist();
    updateRifaSoldCount();
    scheduleRifaDraft();
    document.getElementById('rifa-assign-range').value = '';
    setRifaToolMsg(`🧹 ${plural(sold.length, 'número liberado', 'números liberados')}`);
}

// ----- Importar CSV (llena la lista) -----

// Lee el archivo como UTF-8; si trae caracteres inválidos (CSV "normal" de Excel), reintenta como Windows-1252.
async function readRifaFileText(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf);
    return text.replace(/^\uFEFF/, '');
}

// Detecta el separador (Excel en español usa ";") contando fuera de comillas en las primeras líneas.
function detectCsvDelimiter(lines) {
    const counts = { ';': 0, ',': 0, '\t': 0 };
    lines.slice(0, 10).forEach(line => {
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') inQuotes = !inQuotes;
            else if (!inQuotes && ch in counts) counts[ch]++;
        }
    });
    const best = Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a));
    return counts[best] > 0 ? best : ',';
}

// Divide una línea respetando comillas ("Pérez, María" queda como una sola columna).
function splitCsvLine(line, delimiter) {
    const cols = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
            cols.push(cur); cur = '';
        } else {
            cur += ch;
        }
    }
    cols.push(cur);
    return cols.map(c => c.trim());
}

// Columnas: A = numero, B = comprador. Igual que en la lista: sin nombre = número libre (se ignora).
function parseRifaCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const delimiter = detectCsvDelimiter(lines);
    const entries = new Map();
    const result = { entries, delimiter, withoutName: 0, invalidRows: [], outOfRange: [], duplicates: 0 };
    lines.forEach((line, idx) => {
        const cols = splitCsvLine(line, delimiter);
        const rawNum = (cols[0] || '').replace(/^N[°º]?\s*/i, '');
        if (!/^\d+$/.test(rawNum)) {
            if (idx > 0) result.invalidRows.push(idx + 1); // la fila 1 no numérica es el encabezado
            return;
        }
        const n = parseInt(rawNum, 10);
        if (n < 1 || n > RIFA_TOTAL_NUMBERS) { result.outOfRange.push(n); return; }
        const buyer = cleanBuyerName(cols[1]);
        if (!buyer) { result.withoutName++; return; }
        if (entries.has(n)) result.duplicates++;
        entries.set(n, buyer);
    });
    return result;
}

async function handleFileSelect(e) {
    const input = e.target;
    const file = input.files[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    try {
        const res = parseRifaCsv(await readRifaFileText(file));
        if (res.entries.size === 0) {
            return setRifaToolMsg(`No se encontraron números con comprador en "${file.name}". Revisa que la columna A tenga el número y la B el nombre.`, true);
        }
        const currentSold = Object.keys(rifaBuyers).length;
        const replaced = [...res.entries].filter(([n, b]) => rifaBuyers[n] && buyerKey(rifaBuyers[n]) !== buyerKey(b)).length;
        if (currentSold > 0 && !confirm(`La lista ya tiene ${plural(currentSold, 'número vendido', 'números vendidos')}.\n\nEl archivo trae ${res.entries.size} y se combinará con la lista${replaced ? ` (${plural(replaced, 'número cambiará', 'números cambiarán')} de comprador)` : ''}.\n\n¿Continuar?`)) return;

        res.entries.forEach((buyer, n) => { rifaBuyers[n] = canonicalBuyer(buyer, n); });
        syncRifaGridInputs();
        applyRifaGridFilter();
        refreshRifaBuyersDatalist();
        updateRifaSoldCount();
        scheduleRifaDraft();

        const parts = [`✅ ${file.name}: ${plural(res.entries.size, 'número cargado', 'números cargados')}`];
        if (res.withoutName) parts.push(`${res.withoutName} sin nombre (quedan libres)`);
        if (res.outOfRange.length) parts.push(`${res.outOfRange.length} fuera del 1-${RIFA_TOTAL_NUMBERS} ignorados`);
        if (res.invalidRows.length) parts.push(`${res.invalidRows.length} filas no válidas (fila ${res.invalidRows.slice(0, 5).join(', ')}${res.invalidRows.length > 5 ? '…' : ''})`);
        if (res.duplicates) parts.push(`${res.duplicates} repetidos (quedó el último)`);
        setRifaToolMsg(parts.join(' · '), false);
    } catch (err) {
        console.error(err);
        setRifaToolMsg('No se pudo leer el archivo. Verifica que sea un CSV (Excel: Guardar como → CSV UTF-8).', true);
    }
}

// ----- Borrador local -----

function rifaDraftKey() { return `${APP_KEY}_rifa_draft_${rifaEditingId || 'nueva'}`; }
function collectRifaForm() {
    return {
        name: document.getElementById('rifa-name').value,
        date: document.getElementById('rifa-date').value,
        prizes: Array.from(document.querySelectorAll('#prize-edit-list .prize-name-input')).map(i => i.value),
        buyers: { ...rifaBuyers }
    };
}
function scheduleRifaDraft() {
    clearTimeout(rifaDraftTimer);
    rifaDraftTimer = setTimeout(saveRifaDraft, 600);
}
function saveRifaDraft() {
    if (!document.getElementById('modal-rifa').classList.contains('active')) return;
    try { localStorage.setItem(rifaDraftKey(), JSON.stringify({ ...collectRifaForm(), savedAt: new Date().toISOString() })); } catch (e) { /* almacenamiento no disponible */ }
}
function loadRifaDraft() {
    try {
        const raw = localStorage.getItem(rifaDraftKey());
        const draft = raw ? JSON.parse(raw) : null;
        return draft && draft.savedAt ? draft : null;
    } catch (e) { return null; }
}
function clearRifaDraft() {
    clearTimeout(rifaDraftTimer);
    try { localStorage.removeItem(rifaDraftKey()); } catch (e) { /* nada */ }
}

// ----- Guardar -----

async function saveRifa(forceOverwrite) {
    if (rifaSaving) return;
    const name = document.getElementById('rifa-name').value.trim();
    const date = document.getElementById('rifa-date').value;
    const prizeNames = Array.from(document.querySelectorAll('#prize-edit-list .prize-name-input')).map(i => i.value.trim()).filter(v => v);
    if (!name || !date) return alert('Completa el nombre y la fecha de la rifa.');
    if (prizeNames.length === 0) return alert('Agrega al menos un premio.');

    const soldNumbers = Object.keys(rifaBuyers).map(Number)
        .filter(n => n >= 1 && n <= RIFA_TOTAL_NUMBERS && cleanBuyerName(rifaBuyers[n]))
        .sort((a, b) => a - b)
        .map(n => ({ number: n, buyer: cleanBuyerName(rifaBuyers[n]) }));
    if (soldNumbers.length === 0) return alert(`Anota al menos un número vendido con el nombre del comprador.\n(Si no sabes quién lo compró, escribe "${RIFA_UNKNOWN_BUYER}").`);
    if (soldNumbers.length < prizeNames.length) return alert(`Hay ${prizeNames.length} premios y solo ${soldNumbers.length} números vendidos. Cada premio necesita un número ganador distinto.`);

    const prizes = prizeNames.map((n, i) => ({ rank: i + 1, name: n }));
    const now = new Date().toISOString();
    const btn = document.getElementById('rifa-save-btn');
    let retryForced = false;
    rifaSaving = true;
    btn.disabled = true;

    try {
        if (!rifaEditingId) {
            const rifa = { name, date, totalNumbers: RIFA_TOTAL_NUMBERS, prizes, soldNumbers, results: [], drawn: false, createdBy: currentUser, createdAt: now, updatedBy: currentUser, updatedAt: now };
            const id = generateShortId();
            await db.collection('rifas').doc(id).set(rifa);
            rifas.unshift({ id, ...rifa });
            clearRifaDraft();
            logActivity('CREAR_RIFA', `Creó la rifa "${name}" con ${soldNumbers.length} números vendidos y ${prizes.length} premio(s)`);
            closeModal('modal-rifa');
            renderRifas();
            alert('Rifa creada correctamente');
        } else {
            const id = rifaEditingId;
            const ref = db.collection('rifas').doc(id);
            const changes = { name, date, prizes, soldNumbers, updatedBy: currentUser, updatedAt: now };
            // Transacción: no permite editar una rifa ya sorteada ni pisar sin aviso cambios de otro directivo
            await db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists) throw { rifaError: 'missing' };
                const cur = snap.data();
                if (cur.drawn) throw { rifaError: 'drawn' };
                const curStamp = cur.updatedAt || cur.createdAt || null;
                if (!forceOverwrite && curStamp !== rifaEditingBase) throw { rifaError: 'conflict', by: cur.updatedBy };
                tx.update(ref, changes);
            });
            const idx = rifas.findIndex(r => r.id === id);
            if (idx !== -1) Object.assign(rifas[idx], changes);
            clearRifaDraft();
            logActivity('EDITAR_RIFA', `Editó la rifa "${name}": ${soldNumbers.length} números vendidos, ${prizes.length} premio(s)`);
            closeModal('modal-rifa');
            renderRifas();
            if (currentRifaId === id && idx !== -1) renderRifaDetail(rifas[idx]);
            alert('Cambios guardados');
        }
    } catch (e) {
        if (e && e.rifaError === 'conflict') {
            saveRifaDraft();
            retryForced = confirm(`${e.by || 'Otro miembro de la directiva'} modificó esta rifa mientras la editabas.\n\nAceptar: guardar tu versión (reemplaza la suya)\nCancelar: no guardar (tu borrador queda guardado)`);
        } else if (e && e.rifaError === 'drawn') {
            alert('Esta rifa ya fue sorteada en otro dispositivo; no se puede modificar.');
            await loadRifas();
            closeModal('modal-rifa');
            renderRifas();
        } else if (e && e.rifaError === 'missing') {
            alert('Esta rifa ya no existe.');
            await loadRifas();
            closeModal('modal-rifa');
            closeRifaDetail();
            renderRifas();
        } else {
            console.error(e);
            alert('No se pudo guardar la rifa. Revisa tu conexión e intenta de nuevo. Tu avance quedó guardado como borrador.');
            saveRifaDraft();
        }
    } finally {
        rifaSaving = false;
        btn.disabled = false;
    }
    if (retryForced) return saveRifa(true);
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
    const prizesSortedByRank = [...rifa.prizes].sort((a, b) => a.rank - b.rank);

    const prizesHTML = prizesSortedByRank.map(p => {
        const result = (rifa.results || []).find(r => r.rank === p.rank);
        const winnerText = result ? `${result.buyer ? escapeRifaHtml(result.buyer) + ' — ' : ''}N°${pad3(result.number)}` : '—';
        return `<div class="prize-row"><div class="prize-rank">${p.rank}</div><div class="prize-name">${escapeRifaHtml(p.name)}</div><div class="prize-winner">${winnerText}</div></div>`;
    }).join('');

    const startBtnHTML = rifa.drawn
        ? ''
        : `<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
<button class="btn btn-info" style="flex:1; min-width:160px;" onclick="openEditRifaModal()">✏️ Editar números y premios</button>
<button class="btn btn-primary" style="flex:1; min-width:160px;" onclick="startRifaDraw()" id="rifa-start-btn">🎉 Iniciar Sorteo</button>
</div>`;

    const actionsHTML = rifa.drawn
        ? `<div class="input-group"><label>Buscar número o comprador</label><input type="text" class="rifa-search-input" id="rifa-search" oninput="filterRifaResults()" placeholder="Ej: 143 o María"></div>
           <table class="rifa-results-table" id="rifa-results-table"><thead><tr><th>Premio</th><th>N°</th><th>Comprador</th></tr></thead><tbody id="rifa-results-body"></tbody></table>
           <div class="actions-row" style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;"><button class="btn btn-sm btn-success" onclick="exportRifaPDF()">📄 Exportar PDF</button><button class="btn btn-sm btn-info" onclick="shareRifaWhatsApp()">💬 Compartir WhatsApp</button></div>`
        : '';

    const soldSorted = [...rifa.soldNumbers].sort((a, b) => a.number - b.number);
    const soldListHTML = soldSorted.map(s =>
        `<div class="rifa-sold-item" data-search="${escapeRifaHtml(buyerKey(s.buyer || ''))} ${s.number}"><b>${pad3(s.number)}</b><span>${escapeRifaHtml(s.buyer || 'Sin nombre registrado')}</span></div>`).join('');

    document.getElementById('rifa-detail-content').innerHTML = `
<div class="card">
<p style="font-size:0.85rem; color:var(--text-light); margin:0 0 2px;">${formatRifaDate(rifa.date)}</p>
<p style="font-size:1.2rem; font-weight:700; margin:0 0 10px;">${escapeRifaHtml(rifa.name)}</p>
<div class="numbers-summary">
<div class="num-stat"><div class="n">${rifa.soldNumbers.length}</div><div class="l">Vendidos</div></div>
<div class="num-stat"><div class="n">${rifa.totalNumbers}</div><div class="l">Total</div></div>
<div class="num-stat"><div class="n">${rifa.prizes.length}</div><div class="l">Premios</div></div>
</div>
<div class="prizes-list">${prizesHTML}</div>
${startBtnHTML}
${actionsHTML}
<details class="rifa-sold-details">
<summary>🎫 Ver números vendidos (${rifa.soldNumbers.length})</summary>
<input type="search" class="rifa-search-input" id="rifa-sold-search" oninput="filterRifaSoldList()" placeholder="Buscar N° o nombre">
<div class="rifa-sold-list" id="rifa-sold-list">${soldListHTML}</div>
</details>
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

function filterRifaSoldList() {
    const q = document.getElementById('rifa-sold-search').value.trim();
    const qKey = buyerKey(q);
    const qNum = /^\d+$/.test(q) ? String(parseInt(q, 10)) : null;
    document.querySelectorAll('#rifa-sold-list .rifa-sold-item').forEach(el => {
        const [, num] = el.getAttribute('data-search').match(/(\d+)$/) || [];
        el.hidden = q ? (qNum !== null ? num !== qNum : !el.getAttribute('data-search').includes(qKey)) : false;
    });
}

async function startRifaDraw() {
    const btn = document.getElementById('rifa-start-btn');
    if (btn) btn.disabled = true;
    // Relee la rifa desde Firestore: pudo ser editada o sorteada en otro dispositivo
    try {
        const snap = await db.collection('rifas').doc(currentRifaId).get();
        if (!snap.exists) { alert('Esta rifa ya no existe.'); await loadRifas(); closeRifaDetail(); renderRifas(); return; }
        const fresh = { id: snap.id, ...snap.data() };
        const idx = rifas.findIndex(r => r.id === currentRifaId);
        if (idx !== -1) rifas[idx] = fresh; else rifas.unshift(fresh);
        if (fresh.drawn) { alert('Esta rifa ya fue sorteada en otro dispositivo.'); renderRifas(); renderRifaDetail(fresh); return; }
        if (fresh.soldNumbers.length < fresh.prizes.length) { alert('Hay más premios que números vendidos. Edita la rifa antes de sortear.'); renderRifaDetail(fresh); return; }
        renderRifaDetail(fresh);
    } catch (e) {
        console.error(e);
        if (btn) btn.disabled = false;
        return alert('No se pudo verificar la rifa. Revisa tu conexión antes de sortear.');
    }
    const rifa = rifas.find(r => r.id === currentRifaId);
    document.getElementById('rifa-start-btn').closest('div').style.display = 'none';
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
            numEl.textContent = pad3(randomShown);
            const progress = tick / totalTicks;
            const delay = 55 + Math.pow(progress, 3) * 620;
            setTimeout(step, delay);
        } else {
            numEl.textContent = pad3(winnerEntry.number);
            numEl.classList.add('landed');
            setTimeout(() => {
                const buyerLabel = winnerEntry.buyer || 'Sin nombre registrado';
                document.getElementById('rifa-winner-name').textContent = buyerLabel;
                document.getElementById('rifa-winner-sub').textContent = `Número ganador: ${pad3(winnerEntry.number)}`;
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
        await db.collection('rifas').doc(currentRifaId).update({ results: rifaResults, drawn: true, drawnBy: currentUser, drawnAt: new Date().toISOString() });
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
    body.innerHTML = sorted.map(r => `<tr data-search="${escapeRifaHtml((r.buyer || '').toLowerCase())} ${r.number}"><td>N°${r.rank} — ${escapeRifaHtml(r.name)}</td><td>${pad3(r.number)}</td><td>${escapeRifaHtml(r.buyer || '-')}</td></tr>`).join('');
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
    const sorted = [...(rifa.results || [])].sort((a, b) => a.rank - b.rank);
    const rows = sorted.map(r => `<tr><td>N°${r.rank} — ${escapeRifaHtml(r.name)}</td><td>${pad3(r.number)}</td><td>${escapeRifaHtml(r.buyer || '-')}</td></tr>`).join('');
    const soldRows = [...rifa.soldNumbers].sort((a, b) => a.number - b.number)
        .map(s => `<div class="sold-item"><b>${pad3(s.number)}</b> ${escapeRifaHtml(s.buyer || '-')}</div>`).join('');
    const cssHref = new URL('css/styles.css', window.location.href).href;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeRifaHtml(rifa.name)}</title><link rel="stylesheet" href="${cssHref}"><style>
body { margin: 0; padding: 16px; background: #fff; color: #1e293b; height: auto; overflow: visible; }
.card { border: 1px solid #ddd; box-shadow: none; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; font-size: 0.9rem; }
.sold-list { columns: 3; column-gap: 18px; font-size: 0.8rem; margin-top: 8px; }
.sold-item { break-inside: avoid; padding: 2px 0; border-bottom: 1px dotted #e2e8f0; }
.print-toolbar { text-align: center; padding: 14px; background: #f1f5f9; margin-bottom: 16px; border-radius: 8px; }
.print-toolbar button { padding: 10px 18px; font-size: 1rem; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
@media print { .print-toolbar { display: none; } body { padding: 0; } .card:hover { transform: none; box-shadow: none; } }
</style></head><body>
<div class="print-toolbar"><button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>
<div class="card" style="padding:1.3rem; border-radius:12px;">
<p style="color:#64748b; font-size:0.85rem; margin:0;">${formatRifaDate(rifa.date)}</p>
<h2 style="margin:4px 0 12px;">${escapeRifaHtml(rifa.name)}</h2>
<p><b>${rifa.soldNumbers.length}</b> de ${rifa.totalNumbers} números vendidos &nbsp;·&nbsp; <b>${rifa.prizes.length}</b> premio${rifa.prizes.length === 1 ? '' : 's'}</p>
<table><thead><tr><th>Premio</th><th>N° Ganador</th><th>Comprador</th></tr></thead><tbody>${rows}</tbody></table>
<h3 style="margin:22px 0 4px; font-size:1rem;">Números vendidos</h3>
<div class="sold-list">${soldRows}</div>
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
        text += `🏆 Premio N°${r.rank} — ${r.name}: N°${pad3(r.number)}${r.buyer ? ' — ' + r.buyer : ''}\n`;
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
