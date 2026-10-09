// ===== RIFAS DE NÚMEROS LIBRES =====
// Segunda modalidad de rifa (la primera, "asignada", sigue igual en rifas.js).
// Hay N números (por defecto 100) con un precio fijo. La directiva anota qué números elige cada
// familia; un número pasa por tres estados:  libre → reservado → pagado.
//
// Modelo (mismo documento de la colección "rifas", campos nuevos y opcionales):
//   mode: 'libre'            (si falta, la rifa es 'asignada')
//   price: number            valor de cada número
//   reservedNumbers: [{number, buyer, studentId|null, at}]   reservados, aún sin transferir
//   soldNumbers:     [{number, buyer, studentId|null, paidAt}] PAGADOS -> son los únicos que entran al sorteo
// Así el sorteo, el PDF y los resultados existentes funcionan sin cambios.

const RL_DEFAULT_TOTAL = 100;
const RL_MIN_TOTAL = 10;
const RL_MAX_TOTAL = 500;

let rifaLibreSelected = new Set();            // números marcados en el tablero, a la espera de asignar
const rifaLibreForm = { student: '', other: '' };
let rifaLibreBusy = false;

const isRifaLibre = r => !!r && r.mode === 'libre';
const rlReserved = r => (r.reservedNumbers || []);
const rlPrice = r => Number(r.price) || 0;

// Texto corto para el listado (la rifa asignada conserva el suyo)
function rifaSoldText(r) {
    return isRifaLibre(r)
        ? `<b>${r.soldNumbers.length}</b> pagados · <b>${rlReserved(r).length}</b> reservados de ${r.totalNumbers}`
        : `<b>${r.soldNumbers.length}</b> de ${r.totalNumbers} vendidos`;
}
const rifaTipoChip = r => isRifaLibre(r) ? '<span class="chip brand">Números libres</span>' : '<span class="chip info">Asignada</span>';

// "5, 12, 30-35" -> [5, 12, 30, 31, ...]; devuelve también lo que no se pudo leer o está fuera de rango
function parseNumberList(text, max) {
    const nums = new Set(), bad = [];
    String(text || '').split(/[,;\s]+/).filter(Boolean).forEach(tok => {
        const m = tok.match(/^(\d+)-(\d+)$/);
        if (m) {
            let a = +m[1], b = +m[2];
            if (a > b) [a, b] = [b, a];
            if (a < 1 || b > max) { bad.push(tok); return; }
            for (let n = a; n <= b; n++) nums.add(n);
        } else if (/^\d+$/.test(tok)) {
            const n = +tok;
            if (n < 1 || n > max) bad.push(tok); else nums.add(n);
        } else bad.push(tok);
    });
    return { nums: [...nums].sort((x, y) => x - y), bad };
}

// ----- Elegir tipo al crear -----

function openRifaTipoModal() { document.getElementById('modal-rifa-tipo').classList.add('active'); }
function chooseRifaTipo(tipo) {
    closeModal('modal-rifa-tipo');
    if (tipo === 'libre') openRifaLibreModal(null); else openRifaEditor(null);
}

// ----- Crear / editar la rifa libre (datos generales) -----

let rifaLibreEditingId = null;
let rifaLibreEditingBase = null;

function rlAddPrizeRow(value) {
    const list = document.getElementById('rl-prize-list');
    const row = document.createElement('div');
    row.className = 'prize-edit-row';
    row.innerHTML = `<div class="prize-edit-rank"></div><input type="text" class="prize-name-input" maxlength="80" placeholder="Nombre del premio" value="${escapeHtml(value || '')}"><button type="button" class="btn btn-sm btn-danger" aria-label="Quitar premio" onclick="this.parentElement.remove(); rlRenumberPrizes()">✕</button>`;
    list.appendChild(row);
    rlRenumberPrizes();
}
function rlRenumberPrizes() {
    document.querySelectorAll('#rl-prize-list .prize-edit-row').forEach((row, i) => { row.querySelector('.prize-edit-rank').textContent = i + 1; });
}

function openRifaLibreModal(id) {
    const rifa = id ? rifas.find(r => r.id === id) : null;
    if (id && !rifa) return;
    if (rifa && rifa.drawn) return alert('Esta rifa ya fue sorteada y no se puede modificar.');
    rifaLibreEditingId = id;
    rifaLibreEditingBase = rifa ? (rifa.updatedAt || rifa.createdAt || null) : null;
    document.getElementById('rl-modal-title').textContent = rifa ? 'Editar rifa de números libres' : 'Nueva rifa de números libres';
    document.getElementById('rl-save-btn').textContent = rifa ? 'Guardar cambios' : 'Crear rifa';
    document.getElementById('rl-name').value = rifa ? rifa.name : '';
    document.getElementById('rl-date').value = rifa ? rifa.date : new Date().toLocaleDateString('sv-SE');
    document.getElementById('rl-total').value = rifa ? rifa.totalNumbers : RL_DEFAULT_TOTAL;
    document.getElementById('rl-price').value = rifa ? rlPrice(rifa) : '';
    document.getElementById('rl-prize-list').innerHTML = '';
    const prizes = rifa ? [...rifa.prizes].sort((a, b) => a.rank - b.rank).map(p => p.name) : ['', ''];
    prizes.forEach(p => rlAddPrizeRow(p));
    document.getElementById('modal-rifa-libre').classList.add('active');
}

async function saveRifaLibre() {
    if (rifaLibreBusy) return;
    const name = document.getElementById('rl-name').value.trim().slice(0, RIFA_NAME_MAX);
    const date = document.getElementById('rl-date').value;
    const total = parseInt(document.getElementById('rl-total').value, 10);
    const price = parseInt(document.getElementById('rl-price').value, 10);
    const prizeNames = Array.from(document.querySelectorAll('#rl-prize-list .prize-name-input')).map(i => i.value.trim()).filter(Boolean);
    if (!name || !date) return alert('Completa el nombre y la fecha de la rifa.');
    if (!(total >= RL_MIN_TOTAL && total <= RL_MAX_TOTAL)) return alert(`La cantidad de números debe estar entre ${RL_MIN_TOTAL} y ${RL_MAX_TOTAL}.`);
    if (!(price > 0)) return alert('Indica el valor de cada número (mayor que 0).');
    if (prizeNames.length === 0) return alert('Agrega al menos un premio.');
    if (prizeNames.length > total) return alert('No puede haber más premios que números.');
    const prizes = prizeNames.map((n, i) => ({ rank: i + 1, name: n }));
    const now = new Date().toISOString();
    const btn = document.getElementById('rl-save-btn');
    rifaLibreBusy = true; btn.disabled = true;
    try {
        if (!rifaLibreEditingId) {
            const rifa = { mode: 'libre', name, date, totalNumbers: total, price, prizes, soldNumbers: [], reservedNumbers: [], results: [], drawn: false, createdBy: currentUser, createdAt: now, updatedBy: currentUser, updatedAt: now };
            const id = generateShortId();
            await db.collection('rifas').doc(id).set(rifa);
            rifas.unshift({ id, ...rifa });
            logActivity('CREAR_RIFA', `Creó la rifa de números libres "${name}" (${total} números a ${formatCLP(price)} c/u, ${prizes.length} premio(s))`);
            closeModal('modal-rifa-libre');
            renderRifas();
            openRifaDetail(id);
        } else {
            const id = rifaLibreEditingId;
            const ref = db.collection('rifas').doc(id);
            const changes = { name, date, totalNumbers: total, price, prizes, updatedBy: currentUser, updatedAt: now };
            await db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists) throw { rifaError: 'missing' };
                const cur = snap.data();
                if (cur.drawn) throw { rifaError: 'drawn' };
                const maxUsed = Math.max(0, ...(cur.soldNumbers || []).map(s => s.number), ...(cur.reservedNumbers || []).map(s => s.number));
                if (total < maxUsed) throw { rifaError: 'small', maxUsed };
                tx.update(ref, changes);
            });
            const idx = rifas.findIndex(r => r.id === id);
            if (idx !== -1) Object.assign(rifas[idx], changes);
            logActivity('EDITAR_RIFA', `Editó la rifa de números libres "${name}"`);
            closeModal('modal-rifa-libre');
            renderRifas();
            if (currentRifaId === id && idx !== -1) renderRifaDetail(rifas[idx]);
        }
    } catch (e) {
        if (e && e.rifaError === 'small') alert(`Ya hay números asignados hasta el ${e.maxUsed}; la cantidad no puede ser menor.`);
        else if (e && e.rifaError === 'drawn') { alert('Esta rifa ya fue sorteada en otro dispositivo; no se puede modificar.'); await loadRifas(); closeModal('modal-rifa-libre'); renderRifas(); }
        else if (e && e.rifaError === 'missing') { alert('Esta rifa ya no existe.'); await loadRifas(); closeModal('modal-rifa-libre'); closeRifaDetail(); renderRifas(); }
        else { console.error(e); alert('No se pudo guardar la rifa. Revisa tu conexión e intenta de nuevo.'); }
    } finally {
        rifaLibreBusy = false; btn.disabled = false;
    }
}

// ----- Cambios sobre los números (siempre con transacción: dos directivos no pisan el mismo número) -----

async function rifaLibreMutate(apply, logCode, logText) {
    if (rifaLibreBusy) return false;
    const id = currentRifaId;
    const ref = db.collection('rifas').doc(id);
    rifaLibreBusy = true;
    try {
        let changes = null;
        await db.runTransaction(async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw { rifaError: 'missing' };
            const cur = snap.data();
            if (cur.drawn) throw { rifaError: 'drawn' };
            const sold = (cur.soldNumbers || []).map(x => ({ ...x }));
            const reserved = (cur.reservedNumbers || []).map(x => ({ ...x }));
            apply({ sold, reserved, total: cur.totalNumbers });
            sold.sort((a, b) => a.number - b.number); reserved.sort((a, b) => a.number - b.number);
            changes = { soldNumbers: sold, reservedNumbers: reserved, updatedBy: currentUser, updatedAt: new Date().toISOString() };
            tx.update(ref, changes);
        });
        const idx = rifas.findIndex(r => r.id === id);
        if (idx !== -1) Object.assign(rifas[idx], changes);
        if (logCode) logActivity(logCode, logText);
        if (idx !== -1) refreshRifaLibre(rifas[idx]);
        renderRifas();
        return true;
    } catch (e) {
        if (e && e.rifaError === 'taken') {
            alert(`${e.numbers.length === 1 ? 'El número' : 'Los números'} ${e.numbers.map(pad3).join(', ')} ya ${e.numbers.length === 1 ? 'está ocupado' : 'están ocupados'} (alguien más los tomó). Se actualizó el tablero.`);
            await loadRifas(); const r = rifas.find(x => x.id === id); if (r) refreshRifaLibre(r);
        } else if (e && e.rifaError === 'drawn') {
            alert('Esta rifa ya fue sorteada en otro dispositivo; no se puede modificar.');
            await loadRifas(); renderRifas(); const r = rifas.find(x => x.id === id); if (r) renderRifaDetail(r);
        } else if (e && e.rifaError === 'missing') {
            alert('Esta rifa ya no existe.'); await loadRifas(); closeRifaDetail(); renderRifas();
        } else { console.error(e); alert('No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.'); }
        return false;
    } finally { rifaLibreBusy = false; }
}

// Quién compra: un alumno del curso o un nombre libre
function rlBuyerFromForm() {
    const val = rifaLibreForm.student;
    if (!val) return null;
    if (val === '__other') {
        const name = cleanBuyerName(rifaLibreForm.other);
        return name ? { buyer: name, studentId: null } : null;
    }
    const s = (appData.students || []).find(x => String(x.id) === String(val));
    return s ? { buyer: studentFullName(s), studentId: s.id } : null;
}

// Marca números como reservados o pagados para el comprador elegido
async function rifaLibreAssign(numbers, status) {
    const who = rlBuyerFromForm();
    if (!who) return alert('Elige primero el alumno (o escribe el nombre del comprador).');
    if (!numbers.length) return alert('Marca en el tablero los números que eligió, o escríbelos en el campo "Números".');
    const now = new Date().toISOString();
    const ok = await rifaLibreMutate(({ sold, reserved, total }) => {
        const taken = numbers.filter(n => n > total || sold.some(s => s.number === n) || reserved.some(r => r.number === n && !(r.studentId === who.studentId && r.buyer === who.buyer)));
        if (taken.length) throw { rifaError: 'taken', numbers: taken };
        numbers.forEach(n => {
            const ri = reserved.findIndex(r => r.number === n);
            if (ri !== -1) reserved.splice(ri, 1);
            if (status === 'paid') sold.push({ number: n, buyer: who.buyer, studentId: who.studentId, paidAt: now });
            else reserved.push({ number: n, buyer: who.buyer, studentId: who.studentId, at: now });
        });
    }, status === 'paid' ? 'PAGO_NUMEROS_RIFA' : 'RESERVAR_NUMEROS_RIFA',
        `${status === 'paid' ? 'Registró pago de' : 'Reservó'} ${plural(numbers.length, 'número', 'números')} (${numbers.map(pad3).join(', ')}) a nombre de ${who.buyer}`);
    if (ok) { rifaLibreSelected.clear(); document.getElementById('rl-numbers') && (document.getElementById('rl-numbers').value = ''); refreshRifaLibre(rifas.find(r => r.id === currentRifaId)); }
}

function rifaLibreAssignFromUI(status) {
    const rifa = rifas.find(r => r.id === currentRifaId); if (!rifa) return;
    const typed = parseNumberList(document.getElementById('rl-numbers').value, rifa.totalNumbers);
    if (typed.bad.length) return alert(`No pude leer o están fuera de 1-${rifa.totalNumbers}: ${typed.bad.join(', ')}`);
    const all = [...new Set([...rifaLibreSelected, ...typed.nums])].sort((a, b) => a - b);
    rifaLibreAssign(all, status);
}

// Cambios sobre números ya ocupados
async function rifaLibreSetStatus(numbers, status) {
    const now = new Date().toISOString();
    const ok = await rifaLibreMutate(({ sold, reserved }) => {
        numbers.forEach(n => {
            if (status === 'paid') {
                const ri = reserved.findIndex(r => r.number === n);
                if (ri === -1) return;
                const [r] = reserved.splice(ri, 1);
                sold.push({ number: n, buyer: r.buyer, studentId: r.studentId ?? null, paidAt: now });
            } else if (status === 'reserved') {
                const si = sold.findIndex(s => s.number === n);
                if (si === -1) return;
                const [s] = sold.splice(si, 1);
                reserved.push({ number: n, buyer: s.buyer, studentId: s.studentId ?? null, at: now });
            } else if (status === 'free') {
                const si = sold.findIndex(s => s.number === n); if (si !== -1) sold.splice(si, 1);
                const ri = reserved.findIndex(r => r.number === n); if (ri !== -1) reserved.splice(ri, 1);
            }
        });
    }, status === 'paid' ? 'PAGO_NUMEROS_RIFA' : (status === 'free' ? 'LIBERAR_NUMEROS_RIFA' : 'RESERVAR_NUMEROS_RIFA'),
        `${status === 'paid' ? 'Confirmó el pago de' : (status === 'free' ? 'Liberó' : 'Devolvió a reservado')} ${plural(numbers.length, 'número', 'números')} (${numbers.map(pad3).join(', ')})`);
    closeModal('modal-rifa-num');
    return ok;
}

// ----- Detalle de la rifa libre -----

function rlOwnerOf(rifa, n) {
    const s = rifa.soldNumbers.find(x => x.number === n); if (s) return { ...s, status: 'paid' };
    const r = rlReserved(rifa).find(x => x.number === n); if (r) return { ...r, status: 'reserved' };
    return null;
}

function renderRifaLibreExtras(rifa) {
    // Reemplaza lo que no aplica a esta modalidad dentro del detalle genérico
    const detail = document.getElementById('rifa-detail-content');
    const summary = detail.querySelector('.numbers-summary'); if (summary) summary.style.display = 'none';
    const editBtn = detail.querySelector('button[onclick="openEditRifaModal()"]');
    if (editBtn) { editBtn.setAttribute('onclick', `openRifaLibreModal('${rifa.id}')`); editBtn.innerHTML = `${ico('edit')} Editar rifa y premios`; }
    const sold = detail.querySelector('.rifa-sold-details summary'); if (sold) sold.textContent = `🎫 Ver números pagados (${rifa.soldNumbers.length})`;

    const students = getActiveStudents().sort((a, b) => studentFullName(a).localeCompare(studentFullName(b), 'es'));
    const opts = `<option value="">— Elegir alumno —</option>${students.map(s => `<option value="${s.id}">${escapeHtml(studentFullName(s))}</option>`).join('')}<option value="__other">Otro comprador (escribir nombre)…</option>`;
    const drawCard = document.getElementById('rifa-draw-card');
    const wrap = document.createElement('div');
    wrap.id = 'rl-root';
    wrap.innerHTML = `
<div class="card">
<div class="card-head"><h3>Números libres · ${formatCLP(rlPrice(rifa))} c/u</h3></div>
<div class="kpi-banner kpi-banner-compact" id="rl-stats"></div>
${rifa.drawn ? '' : `
<div class="rl-toolbar">
<label class="tb-field grow"><span>Comprador</span><select id="rl-student" onchange="rifaLibreForm.student=this.value; rlToggleOther()">${opts}</select></label>
<label class="tb-field grow" id="rl-other-wrap" hidden><span>Nombre</span><input type="text" id="rl-other" maxlength="${RIFA_NAME_MAX}" placeholder="Nombre del comprador" oninput="rifaLibreForm.other=this.value"></label>
<label class="tb-field grow"><span>Números (opcional)</span><input type="text" id="rl-numbers" inputmode="numeric" placeholder="Ej: 5, 12, 30-35"></label>
</div>
<div class="rl-selection" id="rl-selection"></div>
<div class="rl-actions">
<button type="button" class="btn btn-sm btn-warning" onclick="rifaLibreAssignFromUI('reserved')">Reservar</button>
<button type="button" class="btn btn-sm btn-success" onclick="rifaLibreAssignFromUI('paid')">Reservar y marcar pagado</button>
<button type="button" class="btn btn-sm btn-ghost" onclick="rifaLibreClearSelection()">Limpiar selección</button>
</div>`}
<div class="rl-legend"><span><i class="rl-dot free"></i>Libre</span><span><i class="rl-dot reserved"></i>Reservado</span><span><i class="rl-dot paid"></i>Pagado</span><span><i class="rl-dot sel"></i>Seleccionado</span></div>
<div class="rl-grid" id="rl-grid"></div>
</div>
<div class="card"><div class="card-head"><h3>Por familia</h3></div><div id="rl-families"></div></div>`;
    drawCard.parentNode.insertBefore(wrap, drawCard);
    if (!rifa.drawn) {
        document.getElementById('rl-student').value = rifaLibreForm.student;
        document.getElementById('rl-other').value = rifaLibreForm.other;
        rlToggleOther();
    }
    refreshRifaLibre(rifa);
}

function rlToggleOther() { const w = document.getElementById('rl-other-wrap'); if (w) w.hidden = rifaLibreForm.student !== '__other'; }
function rifaLibreClearSelection() { rifaLibreSelected.clear(); const n = document.getElementById('rl-numbers'); if (n) n.value = ''; refreshRifaLibre(rifas.find(r => r.id === currentRifaId)); }

function rifaLibreCell(n) {
    const rifa = rifas.find(r => r.id === currentRifaId); if (!rifa) return;
    const owner = rlOwnerOf(rifa, n);
    if (owner) {
        if (rifa.drawn) return;
        const price = formatCLP(rlPrice(rifa));
        document.getElementById('rl-num-title').textContent = `Número ${pad3(n)}`;
        document.getElementById('rl-num-body').innerHTML = `<p class="rl-num-buyer">${escapeHtml(owner.buyer)}</p>
<p><span class="chip ${owner.status === 'paid' ? 'ok' : 'warn'}">${owner.status === 'paid' ? '✔ Pagado' : 'Reservado · pendiente de transferencia'}</span> <span class="muted-note" style="margin:0">${price}</span></p>
<div class="rl-num-actions">
${owner.status === 'reserved' ? `<button type="button" class="btn btn-success" onclick="rifaLibreSetStatus([${n}], 'paid')">Confirmar pago</button>` : `<button type="button" class="btn btn-warning" onclick="rifaLibreSetStatus([${n}], 'reserved')">Volver a reservado</button>`}
<button type="button" class="btn btn-danger" onclick="rifaLibreSetStatus([${n}], 'free')">Liberar número</button>
</div>`;
        document.getElementById('modal-rifa-num').classList.add('active');
        return;
    }
    if (rifa.drawn) return;
    if (rifaLibreSelected.has(n)) rifaLibreSelected.delete(n); else rifaLibreSelected.add(n);
    refreshRifaLibre(rifa);
}

function refreshRifaLibre(rifa) {
    if (!rifa || !document.getElementById('rl-grid')) return;
    const price = rlPrice(rifa);
    const paid = rifa.soldNumbers.length, reserved = rlReserved(rifa).length, free = rifa.totalNumbers - paid - reserved;
    document.getElementById('rl-stats').innerHTML = `
<div class="kpi ok"><div class="kpi-label">Pagados</div><div class="kpi-value">${paid}</div><div class="kpi-foot">${formatCLP(paid * price)} recaudado</div></div>
<div class="kpi warn"><div class="kpi-label">Reservados</div><div class="kpi-value">${reserved}</div><div class="kpi-foot">${formatCLP(reserved * price)} por cobrar</div></div>
<div class="kpi info"><div class="kpi-label">Libres</div><div class="kpi-value">${free}</div><div class="kpi-foot">de ${rifa.totalNumbers} números</div></div>
<div class="kpi brand"><div class="kpi-label">Potencial total</div><div class="kpi-value">${formatCLP(rifa.totalNumbers * price)}</div><div class="kpi-foot">si se vende todo</div></div>`;

    let cells = '';
    for (let n = 1; n <= rifa.totalNumbers; n++) {
        const o = rlOwnerOf(rifa, n);
        const cls = o ? o.status : (rifaLibreSelected.has(n) ? 'sel' : 'free');
        const label = o ? `Número ${n}: ${o.buyer} (${o.status === 'paid' ? 'pagado' : 'reservado'})` : `Número ${n}: ${rifaLibreSelected.has(n) ? 'seleccionado' : 'libre'}`;
        cells += `<button type="button" class="rl-num ${cls}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" aria-pressed="${cls === 'sel'}" onclick="rifaLibreCell(${n})"><b>${n}</b>${o ? `<small>${escapeHtml(o.buyer.split(' ')[0])}</small>` : ''}</button>`;
    }
    document.getElementById('rl-grid').innerHTML = cells;

    const selEl = document.getElementById('rl-selection');
    if (selEl) {
        const sel = [...rifaLibreSelected].sort((a, b) => a - b);
        selEl.innerHTML = sel.length ? `Seleccionados: <b>${sel.map(pad3).join(', ')}</b> · total <b>${formatCLP(sel.length * price)}</b>` : 'Marca números en el tablero o escríbelos arriba.';
    }

    // Resumen por familia
    const groups = new Map();
    const add = (o, status) => {
        const key = o.studentId != null ? 's' + o.studentId : 'n' + buyerKey(o.buyer);
        if (!groups.has(key)) groups.set(key, { buyer: o.buyer, studentId: o.studentId ?? null, paid: [], reserved: [] });
        groups.get(key)[status].push(o.number);
    };
    rifa.soldNumbers.forEach(s => add(s, 'paid'));
    rlReserved(rifa).forEach(r => add(r, 'reserved'));
    const fam = document.getElementById('rl-families');
    if (groups.size === 0) { fam.innerHTML = '<div class="empty-state">Aún no hay números asignados.</div>'; return; }
    const list = [...groups.entries()].sort((a, b) => a[1].buyer.localeCompare(b[1].buyer, 'es'));
    fam.innerHTML = `<div class="data-list">${list.map(([key, g]) => {
        const chips = [...g.paid.map(n => `<span class="chip ok">${pad3(n)}</span>`), ...g.reserved.map(n => `<span class="chip warn">${pad3(n)}</span>`)].join('');
        const owed = g.reserved.length * price;
        const actions = rifa.drawn ? '' : `<div class="row-actions">
${g.reserved.length ? `<button type="button" class="act act-solid-ok" onclick="rifaLibrePayFamily('${key}')">${ico('check')} Confirmar pago</button>
<button type="button" class="act act-info" onclick="rifaLibreCobrar('${key}')">${ico('chat')} Cobrar</button>
<button type="button" class="act act-danger" onclick="rifaLibreReleaseFamily('${key}')">${ico('undo')} Liberar reservas</button>` : ''}</div>`;
        return `<div class="data-row ${g.reserved.length ? 'is-ok-soft' : 'is-paid'}">
<div class="row-main"><div class="row-title">${escapeHtml(g.buyer)}</div><div class="chip-wrap">${chips}</div>
<div class="row-sub wrap">Pagado ${formatCLP(g.paid.length * price)}${g.reserved.length ? ` · <b>Por transferir ${formatCLP(owed)}</b>` : ''}</div></div>${actions}</div>`;
    }).join('')}</div>`;
}

function rlFamilyNumbers(key, status) {
    const rifa = rifas.find(r => r.id === currentRifaId); if (!rifa) return { rifa: null, nums: [], buyer: '', studentId: null };
    const match = o => (o.studentId != null ? 's' + o.studentId : 'n' + buyerKey(o.buyer)) === key;
    const src = status === 'paid' ? rifa.soldNumbers : rlReserved(rifa);
    const items = src.filter(match);
    return { rifa, nums: items.map(o => o.number).sort((a, b) => a - b), buyer: items[0]?.buyer || '', studentId: items[0]?.studentId ?? null };
}
function rifaLibrePayFamily(key) {
    const { nums, buyer } = rlFamilyNumbers(key, 'reserved'); if (!nums.length) return;
    if (!confirm(`¿Confirmar la transferencia de ${buyer}?\n\nSe marcarán como pagados los números ${nums.map(pad3).join(', ')}.`)) return;
    rifaLibreSetStatus(nums, 'paid');
}
function rifaLibreReleaseFamily(key) {
    const { nums, buyer } = rlFamilyNumbers(key, 'reserved'); if (!nums.length) return;
    if (!confirm(`¿Liberar las reservas de ${buyer}?\n\nLos números ${nums.map(pad3).join(', ')} quedarán disponibles para otros.`)) return;
    rifaLibreSetStatus(nums, 'free');
}
function rifaLibreCobrar(key) {
    const { rifa, nums, buyer, studentId } = rlFamilyNumbers(key, 'reserved'); if (!rifa || !nums.length) return;
    const price = rlPrice(rifa);
    const total = nums.length * price;
    let m = `*RIFA: ${rifa.name}*\n\n*Alumno/Familia:* ${buyer}\n*Números reservados:* ${nums.map(pad3).join(', ')}\n*Valor por número:* ${formatCLP(price)}\n\n*TOTAL A TRANSFERIR: ${formatCLP(total)}*\n\n`;
    m += `*Datos de pago:*\nBanco: Tenpo\nCuenta: 111113268423\nRUT: 13.268.423-5\nTitular: Angelica Lucia Mofre Retamal\n\nUna vez transferido, envía el comprobante para confirmar tus números. ¡Gracias!`;
    const student = studentId != null ? (appData.students || []).find(s => s.id === studentId) : null;
    const phone = student && student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
    window.open(phone ? `https://wa.me/56${phone}?text=${encodeURIComponent(m)}` : `https://wa.me/?text=${encodeURIComponent(m)}`, '_blank');
}
