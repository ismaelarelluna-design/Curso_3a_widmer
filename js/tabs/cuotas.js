// ===== CUOTAS: pago mensual por alumno (depende del mes elegido arriba) =====

const cuotasState = { q: '', status: 'all' };

function cuotasSetQuery(value) { cuotasState.q = value; renderCuotasList(); }
function cuotasSetStatus(value) { cuotasState.status = value; renderCuotasList(); }

function currentCuota() {
    return appData.cuotas.find(x => x.month === `2026-${currentMonth}`);
}

function renderCuotas() {
    const banner = document.getElementById('cuotas-banner');
    if (!banner) return;
    const cu = currentCuota();
    const monthLabel = `${MONTH_NAMES[currentMonth]} 2026`;
    if (!cu) {
        banner.innerHTML = '';
        document.getElementById('cuotas-list').className = '';
        document.getElementById('cuotas-list').innerHTML = '<div class="empty-state">No hay cuota registrada para este mes.</div>';
        return;
    }
    const cuotaMensual = appData.config.cuotaAmount || 5000;
    const payers = getPayingStudents();
    const paid = countPaidAmongPaying(cu.paidStudents);
    const pending = Math.max(payers.length - paid, 0);
    const goal = payers.length * cuotaMensual;
    const pct = goal > 0 ? Math.min(Math.round((cu.total / goal) * 100), 100) : 0;

    banner.innerHTML = `
<div class="kpi-banner-title"><h3>💳 Cuotas de <span id="cuota-month-label">${monthLabel}</span></h3><span class="sub">Cuota mensual: ${formatCLP(cuotaMensual)} por alumno</span></div>
<div class="kpi brand"><div class="kpi-label">Recaudado en ${MONTH_NAMES[currentMonth]}</div><div class="kpi-value">${formatCLP(cu.total)}</div><div class="kpi-foot">meta del mes: ${formatCLP(goal)}</div></div>
<div class="kpi ok"><div class="kpi-label">Pagaron</div><div class="kpi-value">${paid}</div><div class="kpi-foot">de ${payers.length} alumnos</div></div>
<div class="kpi ${pending > 0 ? 'bad' : 'ok'}"><div class="kpi-label">Pendientes</div><div class="kpi-value">${pending}</div><div class="kpi-foot">${pending > 0 ? formatCLP(pending * cuotaMensual) + ' por cobrar' : 'todos al día'}</div></div>
<div class="kpi info"><div class="kpi-label">Avance</div><div class="kpi-value">${pct}%</div><div class="kpi-foot">de la meta mensual</div></div>
<div class="kpi-meter" role="img" aria-label="${pct}% de la meta mensual recaudada"><span class="seg ok" style="width:${pct}%"></span></div>`;
    renderCuotasList();
}

function cuotaRowState(cu, s) {
    if (s.exemptYear) return 'no';
    return cu.paidStudents.includes(s.id) ? 'paid' : 'pending';
}

function renderCuotasList() {
    const container = document.getElementById('cuotas-list');
    if (!container) return;
    const cu = currentCuota();
    if (!cu) return;
    const mode = getViewMode('cuotas', 'cards');
    document.getElementById('cuotas-view-toggle').innerHTML = viewToggleHTML('cuotas', 'renderCuotasList', 'cards');

    const q = searchKey(cuotasState.q);
    const items = getActiveStudents().filter(s => {
        const st = cuotaRowState(cu, s);
        if (cuotasState.status !== 'all' && st !== cuotasState.status) return false;
        return !q || searchKey(`${s.last} ${s.first} ${s.guard || ''} ${s.id}`).includes(q);
    });
    document.getElementById('cuotas-count').textContent = `${items.length} alumnos`;

    if (items.length === 0) {
        container.className = '';
        container.innerHTML = '<div class="empty-state">No hay alumnos que coincidan con la búsqueda.</div>';
        return;
    }

    const chipFor = st => st === 'paid' ? '<span class="chip ok">✔ Pagado</span>' : (st === 'no' ? '<span class="chip warn">No participa</span>' : '<span class="chip bad">Pendiente</span>');
    const actionsFor = (s, st) => {
        const main = st === 'no' ? '' : (st === 'paid'
            ? `<button type="button" class="act act-danger" onclick="deleteCuotaPayment('${cu.month}', ${s.id})">Eliminar pago</button>`
            : `<button type="button" class="act act-solid-ok" onclick="addCuotaPayment('${cu.month}', ${s.id})">${ico('dollar')} Pagar</button>`);
        const part = `<button type="button" class="act ${s.exemptYear ? 'act-ok' : 'act-warn'}" onclick="toggleExemptYear(${s.id})">${s.exemptYear ? `${ico('check')} Vuelve a participar` : `${ico('ban')} No participa`}</button>`;
        return main + part;
    };

    if (mode === 'cards') {
        container.className = 'data-grid';
        container.innerHTML = items.map(s => {
            const st = cuotaRowState(cu, s);
            return `<div class="data-card ${st === 'paid' ? 'is-paid' : (st === 'no' ? 'is-out' : 'is-ok-soft')}">
<div class="data-card-head"><div class="student-num">${s.id}</div><div class="row-main"><div class="student-name">${escapeHtml(studentFullName(s))}</div></div>${chipFor(st)}</div>
<div class="data-card-actions">${actionsFor(s, st)}</div></div>`;
        }).join('');
    } else {
        container.className = 'data-list';
        container.innerHTML = items.map(s => {
            const st = cuotaRowState(cu, s);
            return `<div class="data-row ${st === 'paid' ? 'is-paid' : (st === 'no' ? 'is-out' : 'is-ok-soft')}">
<div class="student-num">${s.id}</div><div class="row-main"><div class="row-title">${escapeHtml(studentFullName(s))}</div></div>${chipFor(st)}
<div class="row-actions">${actionsFor(s, st)}</div></div>`;
        }).join('');
    }
}

function addCuotaPayment(m, sid) {
    const cu = appData.cuotas.find(c => c.month === m);
    if (!cu) return;
    if (!cu.paidStudents.includes(sid)) {
        cu.paidStudents.push(sid);
        const ap = cu.amountPer || appData.config.cuotaAmount || 5000;
        cu.amountPer = ap;
        cu.total = ap * cu.paidStudents.length;
        const st = appData.students.find(s => s.id === sid);
        logActivity('PAGO_CUOTA', `${st.last} ${st.first} pagó cuota ${MONTH_NAMES[m.split('-')[1]]}`);
    }
}

function deleteCuotaPayment(m, sid) {
    if (!confirm('¿Eliminar pago?')) return;
    const cu = appData.cuotas.find(c => c.month === m);
    if (!cu) return;
    cu.paidStudents = cu.paidStudents.filter(id => id !== sid);
    const ap = cu.amountPer || appData.config.cuotaAmount || 5000;
    cu.amountPer = ap;
    cu.total = ap * cu.paidStudents.length;
    const st = appData.students.find(s => s.id === sid);
    logActivity('ELIMINAR_PAGO_CUOTA', `Eliminó pago de ${st.last} ${st.first} cuota ${MONTH_NAMES[m.split('-')[1]]}`);
}
