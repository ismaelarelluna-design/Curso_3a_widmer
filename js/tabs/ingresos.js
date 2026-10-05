// ===== INGRESOS EXTRAS: eventos con monto fijo o cobro por alumno =====
// Formato guardado (NO cambia, para no romper lo ya registrado):
//   { id, type:'fijo'|'cuota', date, concept, amount, amountPer?, students:[{id, paid:true, exempt:boolean}] }
// En un evento "por alumno" solo se guardan los alumnos que pagaron o fueron eximidos; quien no aparece está pendiente.

const ingresosState = { q: '', sort: 'recent', status: 'all', group: 'all' };

function ingresosSetQuery(v) { ingresosState.q = v; renderIngresosList(); }
function ingresosSetSort(v) { ingresosState.sort = v; renderIngresosList(); }
function ingresosSetStatus(v) { ingresosState.status = v; renderIngresosList(); }
function ingresosSetGroup(v) { ingresosState.group = v; renderIngresosList(); }

function formatShortDate(iso) {
    if (!iso) return 'Fecha desconocida';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ----- Banner + lista -----

function renderIngresos() {
    const banner = document.getElementById('ingresos-banner');
    if (!banner) return;
    const events = appData.ingresos.map(i => ({ i, stats: getEventStats(i) }));
    const porAlumno = events.filter(e => e.i.type === 'cuota').length;
    const completos = events.filter(e => e.stats.complete).length;
    const pendientes = events.length - completos;
    const recaudado = appData.ingresos.reduce((s, i) => s + (i.amount || 0), 0);
    const porCobrar = events.reduce((s, e) => s + e.stats.toCollect, 0);

    banner.innerHTML = `
<div class="kpi-banner-title"><h3>🎉 Ingresos Extras</h3><span class="sub">Eventos y actividades del curso</span></div>
<div class="kpi brand"><div class="kpi-label">Eventos creados</div><div class="kpi-value">${events.length}</div><div class="kpi-foot">${porAlumno} por alumno · ${events.length - porAlumno} monto fijo</div></div>
<div class="kpi ok"><div class="kpi-label">Pago completo</div><div class="kpi-value">${completos}</div><div class="kpi-foot">sin deudores</div></div>
<div class="kpi ${pendientes > 0 ? 'bad' : 'ok'}"><div class="kpi-label">Pendientes de pago</div><div class="kpi-value">${pendientes}</div><div class="kpi-foot">${pendientes > 0 ? formatCLP(porCobrar) + ' por cobrar' : 'todo al día'}</div></div>
<div class="kpi info"><div class="kpi-label">Total recaudado</div><div class="kpi-value">${formatCLP(recaudado)}</div><div class="kpi-foot">en todos los eventos</div></div>`;
    renderIngresosList();
}

function sortIngresos(list) {
    const by = {
        recent: (a, b) => (b.i.date || '').localeCompare(a.i.date || ''),
        oldest: (a, b) => (a.i.date || '').localeCompare(b.i.date || ''),
        name: (a, b) => (a.i.concept || '').localeCompare(b.i.concept || '', 'es'),
        amount: (a, b) => (b.i.amount || 0) - (a.i.amount || 0)
    };
    return list.sort(by[ingresosState.sort] || by.recent);
}

function ingresoCardHTML(e, mode) {
    const { i, idx, stats } = e;
    const isCuota = i.type === 'cuota';
    const stateChip = stats.complete
        ? '<span class="chip ok">✔ Pago completo</span>'
        : `<span class="chip bad">${stats.pending} pendiente${stats.pending === 1 ? '' : 's'}</span>`;
    const typeChip = `<span class="chip ${isCuota ? 'brand' : 'info'}">${isCuota ? 'Por alumno' : 'Monto fijo'}</span>`;
    const amountText = isCuota ? `${formatCLP(i.amountPer || 0)} c/u · recaudado ${formatCLP(i.amount || 0)}` : `Total ${formatCLP(i.amount || 0)}`;
    const handled = stats.paid + stats.exempt;
    const pct = stats.total > 0 ? Math.round((handled / stats.total) * 100) : 100;
    const actions = `<button type="button" class="act act-brand" onclick="editIngresoByIndex(${idx})">${ico('edit')} ${isCuota ? 'Editar / Ver alumnos' : 'Editar'}</button>
<button type="button" class="act act-danger" onclick="deleteIngresoByIndex(${idx})">${ico('trash')} Eliminar</button>`;
    const detail = isCuota
        ? `<div class="ev-progress"><div class="progress-container"><div class="progress-bar" style="width:${pct}%"></div></div>
<div class="row-sub">Pagaron ${stats.paid} · Eximidos ${stats.exempt} · Pendientes ${stats.pending} (de ${stats.total})</div></div>` : '';

    if (mode === 'rows') {
        return `<div class="data-row ${stats.complete ? 'is-paid' : 'is-bad'}">
<div class="row-main"><div class="row-title">${escapeHtml(i.concept || 'Sin concepto')}</div>
<div class="row-sub">📅 ${formatShortDate(i.date)} · ${amountText}${isCuota ? ` · Pagaron ${stats.paid}/${stats.total}` : ''}</div></div>
${typeChip}${stateChip}
<div class="row-actions">${actions}</div></div>`;
    }
    return `<div class="data-card ${stats.complete ? 'is-paid' : 'is-bad'}">
<div class="data-card-head"><div class="row-main"><div class="student-name">${escapeHtml(i.concept || 'Sin concepto')}</div>
<div class="student-detail">📅 ${formatShortDate(i.date)} · ${amountText}</div></div></div>
<div class="chip-wrap">${typeChip}${stateChip}</div>
${detail}
<div class="data-card-actions">${actions}</div></div>`;
}

function renderIngresosList() {
    const container = document.getElementById('ingresos-list');
    if (!container) return;
    const mode = getViewMode('ingresos', 'cards');
    document.getElementById('ingresos-view-toggle').innerHTML = viewToggleHTML('ingresos', 'renderIngresosList', 'cards');
    document.getElementById('ingresos-group-toggle').innerHTML = segToggleHTML([{ value: 'all', label: ico('all') + ' Todos' }, { value: 'month', label: ico('calendar') + ' Por mes' }], ingresosState.group, 'ingresosSetGroup');

    if (appData.ingresos.length === 0) {
        container.className = '';
        container.innerHTML = '<div class="empty-state">Aún no hay ingresos extras. Crea el primero con “+ Nuevo Ingreso”.</div>';
        document.getElementById('ingresos-count').textContent = '';
        return;
    }

    const q = searchKey(ingresosState.q);
    let list = appData.ingresos.map((i, idx) => ({ i, idx, stats: getEventStats(i) })).filter(e => {
        if (ingresosState.status === 'complete' && !e.stats.complete) return false;
        if (ingresosState.status === 'pending' && e.stats.complete) return false;
        return !q || searchKey(`${e.i.concept || ''} ${e.i.date || ''}`).includes(q);
    });
    list = sortIngresos(list);
    document.getElementById('ingresos-count').textContent = `${list.length} de ${appData.ingresos.length} eventos`;

    if (list.length === 0) {
        container.className = '';
        container.innerHTML = '<div class="empty-state">No hay eventos que coincidan con los filtros.</div>';
        return;
    }
    const wrapClass = mode === 'cards' ? 'data-grid' : 'data-list';

    if (ingresosState.group === 'month') {
        const groups = new Map();
        list.forEach(e => {
            const key = (e.i.date || '').slice(0, 7) || 'sin-fecha';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(e);
        });
        const keys = [...groups.keys()].sort((a, b) => ingresosState.sort === 'oldest' ? a.localeCompare(b) : b.localeCompare(a));
        container.className = '';
        container.innerHTML = keys.map(key => {
            const items = groups.get(key);
            const label = key === 'sin-fecha' ? 'Sin fecha' : `${MONTH_NAMES[key.slice(5, 7)] || key} ${key.slice(0, 4)}`;
            const total = items.reduce((s, e) => s + (e.i.amount || 0), 0);
            return `<section class="month-group"><div class="month-group-head"><h4>📅 ${label}</h4><span>${items.length} evento${items.length === 1 ? '' : 's'} · ${formatCLP(total)}</span></div>
<div class="${wrapClass}">${items.map(e => ingresoCardHTML(e, mode)).join('')}</div></section>`;
        }).join('');
    } else {
        container.className = wrapClass;
        container.innerHTML = list.map(e => ingresoCardHTML(e, mode)).join('');
    }
}

// ----- Modal crear / editar -----

let ingresoStates = {};                      // id de alumno -> 'paid' | 'exempt' (sin entrada = pendiente)
const ingresoEditor = { q: '', status: 'all' };

function openIngresoModal() {
    _editIngresoIdx = null;
    ingresoStates = {};
    document.getElementById('ingreso-modal-title').textContent = 'Nuevo Ingreso';
    const typeSel = document.getElementById('ingreso-type');
    typeSel.value = 'fijo';
    typeSel.disabled = false;
    document.getElementById('ingreso-date').value = todayISO();
    document.getElementById('ingreso-concept').value = '';
    document.getElementById('ingreso-amount').value = '';
    document.getElementById('ingreso-amount-per').value = '';
    document.getElementById('ingreso-save-btn').textContent = 'Guardar';
    openIngresoEditorCommon();
}

function editIngresoByIndex(idx) {
    const i = appData.ingresos[idx];
    if (!i) return alert('Registro no encontrado.');
    _editIngresoIdx = idx;
    ingresoStates = {};
    (i.students || []).forEach(r => { ingresoStates[r.id] = r.exempt ? 'exempt' : (r.paid ? 'paid' : undefined); });
    Object.keys(ingresoStates).forEach(k => { if (!ingresoStates[k]) delete ingresoStates[k]; });
    document.getElementById('ingreso-modal-title').textContent = 'Editar Ingreso';
    const typeSel = document.getElementById('ingreso-type');
    typeSel.value = i.type || 'fijo';
    typeSel.disabled = true; // el tipo no se puede cambiar después de creado
    document.getElementById('ingreso-date').value = i.date || '';
    document.getElementById('ingreso-concept').value = i.concept || '';
    document.getElementById('ingreso-amount').value = i.type === 'fijo' ? (i.amount || '') : '';
    document.getElementById('ingreso-amount-per').value = i.type === 'cuota' ? (i.amountPer || '') : '';
    document.getElementById('ingreso-save-btn').textContent = '💾 Actualizar Ingreso';
    openIngresoEditorCommon();
}

function openIngresoEditorCommon() {
    ingresoEditor.q = '';
    ingresoEditor.status = 'all';
    document.getElementById('ingreso-students-q').value = '';
    document.getElementById('ingreso-students-status').value = 'all';
    toggleIngresoFields();
    renderIngresoStudents();
    document.querySelector('#modal-ingreso .modal-content').scrollTop = 0;
    document.getElementById('modal-ingreso').classList.add('active');
}

function toggleIngresoFields() {
    const t = document.getElementById('ingreso-type').value;
    document.getElementById('ingreso-fijo-fields').style.display = t === 'fijo' ? 'block' : 'none';
    document.getElementById('ingreso-cuota-fields').style.display = t === 'cuota' ? 'block' : 'none';
}

// Alumnos visibles en el editor: los que siguen en el curso, más cualquier retirado que ya tenga
// registro en este evento (si se ocultara, al guardar se perdería su pago y cambiaría el total histórico).
function ingresoVisibleStudents() {
    return (appData.students || []).filter(s => isActiveStudent(s) || ingresoStates[s.id]);
}

function ingresoStudentState(id) { return ingresoStates[id] || null; }

function setIngresoStudentsQuery(v) { ingresoEditor.q = v; renderIngresoStudents(); }
function setIngresoStudentsStatus(v) { ingresoEditor.status = v; renderIngresoStudents(); }

function ingresoToggle(studentId, kind) {
    if (ingresoStates[studentId] === kind) delete ingresoStates[studentId];
    else ingresoStates[studentId] = kind; // pagado y eximido se excluyen entre sí
    renderIngresoStudents();
}

function updateIngresoSummary() {
    const ap = parseFloat(document.getElementById('ingreso-amount-per').value) || 0;
    const visible = ingresoVisibleStudents();
    const paid = visible.filter(s => ingresoStates[s.id] === 'paid').length;
    const exempt = visible.filter(s => ingresoStates[s.id] === 'exempt').length;
    const pending = visible.filter(s => isPayingStudent(s) && !ingresoStates[s.id]).length;
    document.getElementById('ingreso-summary').innerHTML = `
<div class="kpi ok"><div class="kpi-label">Pagados</div><div class="kpi-value">${paid}</div></div>
<div class="kpi warn"><div class="kpi-label">Eximidos</div><div class="kpi-value">${exempt}</div></div>
<div class="kpi ${pending > 0 ? 'bad' : 'ok'}"><div class="kpi-label">Pendientes</div><div class="kpi-value">${pending}</div></div>
<div class="kpi brand"><div class="kpi-label">Recaudado</div><div class="kpi-value">${formatCLP(ap * paid)}</div></div>`;
}

function renderIngresoStudents() {
    const container = document.getElementById('ingreso-students-list');
    if (!container) return;
    const mode = getViewMode('ingreso_students', 'rows');
    document.getElementById('ingreso-students-view').innerHTML = viewToggleHTML('ingreso_students', 'renderIngresoStudents', 'rows');
    updateIngresoSummary();

    const q = searchKey(ingresoEditor.q);
    const items = ingresoVisibleStudents().filter(s => {
        const st = ingresoStudentState(s.id);
        if (ingresoEditor.status === 'paid' && st !== 'paid') return false;
        if (ingresoEditor.status === 'exempt' && st !== 'exempt') return false;
        if (ingresoEditor.status === 'pending' && (st || !isPayingStudent(s))) return false;
        return !q || searchKey(`${s.last} ${s.first} ${s.id}`).includes(q);
    });

    if (items.length === 0) {
        container.className = '';
        container.innerHTML = '<div class="empty-state">No hay alumnos que coincidan.</div>';
        return;
    }
    const render = s => {
        const st = ingresoStudentState(s.id);
        const flag = s.withdrawn ? '<span class="chip">Retirado</span>' : (s.exemptYear ? '<span class="chip warn">No participa</span>' : '');
        const stateChip = st === 'paid' ? '<span class="chip ok">✔ Pagado</span>' : (st === 'exempt' ? '<span class="chip warn">Eximido</span>' : '');
        const buttons = `<div class="pill-group">
<button type="button" class="pill pill-paid ${st === 'paid' ? 'on' : ''}" aria-pressed="${st === 'paid'}" onclick="ingresoToggle(${s.id}, 'paid')">${st === 'paid' ? '✔ ' : ''}Pagado</button>
<button type="button" class="pill pill-exempt ${st === 'exempt' ? 'on' : ''}" aria-pressed="${st === 'exempt'}" onclick="ingresoToggle(${s.id}, 'exempt')">${st === 'exempt' ? '✔ ' : ''}Eximir</button></div>`;
        const tone = st === 'paid' ? 'is-paid' : (st === 'exempt' ? 'is-no' : '');
        if (mode === 'cards') {
            return `<div class="data-card ${tone}"><div class="data-card-head"><div class="student-num">${s.id}</div><div class="row-main"><div class="student-name">${escapeHtml(studentFullName(s))}</div><div class="chip-wrap">${stateChip}${flag}</div></div></div>${buttons}</div>`;
        }
        return `<div class="data-row ${tone}"><div class="student-num">${s.id}</div><div class="row-main"><div class="row-title">${escapeHtml(studentFullName(s))}</div></div>${stateChip}${flag}${buttons}</div>`;
    };
    container.className = mode === 'cards' ? 'data-grid compact' : 'data-list';
    container.innerHTML = items.map(render).join('');
}

// Un solo botón guardar: crea o actualiza según si hay un evento en edición.
function saveIngresoForm() {
    const editing = _editIngresoIdx !== null && _editIngresoIdx !== undefined;
    const ing = editing ? appData.ingresos[_editIngresoIdx] : null;
    if (editing && !ing) return alert('Referencia perdida. Cierra y vuelve a abrir el ingreso.');
    const type = editing ? ing.type : document.getElementById('ingreso-type').value;
    const date = document.getElementById('ingreso-date').value;
    const concept = document.getElementById('ingreso-concept').value.trim();
    if (!date || !concept) return alert('Completa fecha y concepto');
    if (new Date(date).getFullYear() < 2026) return alert('Solo registros desde 2026');

    let amount = 0, amountPer = 0, students = [];
    if (type === 'fijo') {
        amount = parseFloat(document.getElementById('ingreso-amount').value);
        if (!amount) return alert('Ingresa el monto');
    } else {
        amountPer = parseFloat(document.getElementById('ingreso-amount-per').value);
        if (!amountPer) return alert('Ingresa monto por alumno');
        // Mismo formato de siempre: { id, paid:true, exempt } solo para pagados y eximidos, en orden de lista
        const ordered = (appData.students || []).map(s => s.id);
        Object.keys(ingresoStates).map(Number)
            .sort((a, b) => (ordered.indexOf(a) + 1 || 1e9) - (ordered.indexOf(b) + 1 || 1e9))
            .forEach(id => { students.push({ id, paid: true, exempt: ingresoStates[id] === 'exempt' }); });
        amount = amountPer * students.filter(s => !s.exempt).length;
    }

    if (!editing) {
        const rec = { id: 'ing_' + Date.now() + '_' + Math.floor(Math.random() * 10000), type, date, concept, students };
        if (type === 'fijo') rec.amount = amount; else { rec.amountPer = amountPer; rec.amount = amount; }
        appData.ingresos.push(rec);
        closeModal('modal-ingreso');
        if (type === 'fijo') logActivity('INGRESO_FIJO', `${concept} - ${formatCLP(amount)}`);
        else logActivity('INGRESO_POR_ALUMNO', `${concept} - ${students.filter(s => !s.exempt).length} pagando (eximidos: ${students.filter(s => s.exempt).length}) - ${formatCLP(amount)}`);
    } else {
        ing.date = date;
        ing.concept = concept;
        if (type === 'fijo') ing.amount = amount;
        else { ing.amountPer = amountPer; ing.students = students; ing.amount = amount; }
        closeModal('modal-ingreso');
        logActivity('EDITAR_INGRESO', `Editó: ${concept}`);
    }
}

function deleteIngresoByIndex(idx) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    const ing = appData.ingresos[idx];
    appData.ingresos.splice(idx, 1);
    logActivity('ELIMINAR_INGRESO', `Eliminó: ${ing?.concept}`);
}
