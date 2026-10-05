// ===== CURSO: ficha de alumnos y apoderados =====
// Estados (ver core/students.js): participa · no participa (exemptYear) · retirado (withdrawn).

const cursoState = { q: '', filter: 'active' };

function cursoSetQuery(value) { cursoState.q = value; renderCursoList(); }
function cursoSetFilter(value) { cursoState.filter = value; renderCursoList(); }

function studentStatusInfo(s) {
    if (s.withdrawn) return { key: 'retired', label: 'Retirado', chip: '' };
    if (s.exemptYear) return { key: 'no', label: 'No participa', chip: 'warn' };
    return { key: 'ok', label: 'Participa', chip: 'ok' };
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ----- Render -----

function renderCurso() {
    const banner = document.getElementById('curso-banner');
    if (!banner) return;
    const all = appData.students || [];
    const active = getActiveStudents();
    const participan = active.filter(s => !s.exemptYear).length;
    const noParticipan = active.length - participan;
    const retirados = all.length - active.length;
    const pct = active.length ? Math.round((participan / active.length) * 100) : 0;
    const pctNo = active.length ? 100 - pct : 0;

    banner.innerHTML = `
<div class="kpi-banner-title"><h3>👨‍👩‍👧 Curso 3A · Colegio Alberto Widmer</h3><span class="sub">Año 2026</span></div>
<div class="kpi brand"><div class="kpi-label">Niños en el curso</div><div class="kpi-value">${active.length}</div><div class="kpi-foot">alumnos activos</div></div>
<div class="kpi ok"><div class="kpi-label">Participan</div><div class="kpi-value">${participan}</div><div class="kpi-foot">${pct}% del curso</div></div>
<div class="kpi warn"><div class="kpi-label">No participan</div><div class="kpi-value">${noParticipan}</div><div class="kpi-foot">se bajan de las actividades</div></div>
<div class="kpi"><div class="kpi-label">Retirados</div><div class="kpi-value">${retirados}</div><div class="kpi-foot">se fueron del curso</div></div>
<div class="kpi-meter" role="img" aria-label="${participan} de ${active.length} alumnos participan"><span class="seg ok" style="width:${pct}%"></span><span class="seg warn" style="width:${pctNo}%"></span></div>`;
    renderCursoList();
}

function filterCursoStudents() {
    const q = searchKey(cursoState.q);
    return (appData.students || []).filter(s => {
        const st = studentStatusInfo(s).key;
        const okFilter = cursoState.filter === 'all'
            || (cursoState.filter === 'active' && st !== 'retired')
            || (cursoState.filter === 'participa' && st === 'ok')
            || (cursoState.filter === 'no' && st === 'no')
            || (cursoState.filter === 'retired' && st === 'retired');
        if (!okFilter) return false;
        return !q || searchKey(`${s.last} ${s.first} ${s.guard || ''} ${s.phone || ''} ${s.id}`).includes(q);
    });
}

function studentActionsHTML(s) {
    const id = s.id;
    if (s.withdrawn) {
        return `<button type="button" class="act act-info" onclick="openStudentView(${id})">${ico('eye')} Ver datos</button>
<button type="button" class="act act-ok" onclick="reinstateStudent(${id})">${ico('undo')} Reintegrar</button>`;
    }
    return `<button type="button" class="act act-info" onclick="openStudentView(${id})">${ico('eye')} Ver datos</button>
<button type="button" class="act act-brand" onclick="openEditStudentModal(${id})">${ico('edit')} Editar</button>
<button type="button" class="act ${s.exemptYear ? 'act-ok' : 'act-warn'}" onclick="toggleExemptYear(${id})">${s.exemptYear ? `${ico('check')} Vuelve a participar` : `${ico('ban')} No participa`}</button>
<button type="button" class="act act-danger" onclick="retireStudent(${id})">${ico('exit')} Retirar</button>`;
}

function renderCursoList() {
    const container = document.getElementById('students-list-curso');
    if (!container) return;
    const mode = getViewMode('curso', 'cards');
    const items = filterCursoStudents();
    const total = (appData.students || []).length;

    document.getElementById('curso-view-toggle').innerHTML = viewToggleHTML('curso', 'renderCursoList', 'cards');
    document.getElementById('curso-count').textContent = `${items.length} de ${total}`;

    if (items.length === 0) {
        container.className = '';
        container.innerHTML = '<div class="empty-state">No hay alumnos que coincidan con la búsqueda.</div>';
        return;
    }

    if (mode === 'cards') {
        container.className = 'data-grid';
        container.innerHTML = items.map(s => {
            const st = studentStatusInfo(s);
            return `<div class="data-card ${s.withdrawn ? 'is-retired' : (s.exemptYear ? 'is-out' : '')}">
<div class="data-card-head">
<div class="student-num">${s.id}</div>
<div class="row-main"><div class="student-name">${escapeHtml(studentFullName(s))}</div>
<div class="student-detail">👤 ${escapeHtml(s.guard || 'Sin apoderado')}</div>
<div class="student-detail">📞 ${escapeHtml(s.phone || 'Sin teléfono')}</div></div>
<span class="chip ${st.chip}">${st.label}</span>
</div>
<div class="data-card-actions">${studentActionsHTML(s)}</div>
</div>`;
        }).join('');
    } else {
        container.className = 'data-list';
        container.innerHTML = items.map(s => {
            const st = studentStatusInfo(s);
            return `<div class="data-row ${s.withdrawn ? 'is-retired' : (s.exemptYear ? 'is-out' : '')}">
<div class="student-num">${s.id}</div>
<div class="row-main"><div class="row-title">${escapeHtml(studentFullName(s))}</div>
<div class="row-sub">👤 ${escapeHtml(s.guard || 'Sin apoderado')} · 📞 ${escapeHtml(s.phone || 'Sin teléfono')}</div></div>
<span class="chip ${st.chip}">${st.label}</span>
<div class="row-actions">${studentActionsHTML(s)}</div>
</div>`;
        }).join('');
    }
}

// ----- Editar -----

function openEditStudentModal(id) {
    const s = appData.students.find(x => x.id === id);
    if (!s) return;
    document.getElementById('edit-student-id').value = s.id;
    document.getElementById('edit-last').value = s.last || '';
    document.getElementById('edit-first').value = s.first || '';
    document.getElementById('edit-guard').value = s.guard || '';
    document.getElementById('edit-phone').value = s.phone || '';
    document.getElementById('modal-edit-student').classList.add('active');
}

function saveStudentEdit() {
    const id = parseInt(document.getElementById('edit-student-id').value, 10);
    const s = appData.students.find(x => x.id === id);
    if (!s) return closeModal('modal-edit-student');
    const last = document.getElementById('edit-last').value.trim().toUpperCase();
    const first = document.getElementById('edit-first').value.trim().toUpperCase();
    if (!last || !first) return alert('El apellido y los nombres no pueden quedar vacíos.');
    const before = studentFullName(s);
    s.last = last;
    s.first = first;
    s.guard = document.getElementById('edit-guard').value.trim();
    s.phone = document.getElementById('edit-phone').value.trim();
    const after = studentFullName(s);
    closeModal('modal-edit-student');
    logActivity('EDITAR_ALUMNO', before === after ? `Editó datos de ${after}` : `Editó datos de ${before} (ahora ${after})`);
}

// ----- Agregar -----

function openAddStudentModal() {
    ['add-student-last', 'add-student-first', 'add-student-guard', 'add-student-phone'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('modal-add-student').classList.add('active');
}

function saveNewStudent() {
    const l = document.getElementById('add-student-last').value.trim().toUpperCase();
    const f = document.getElementById('add-student-first').value.trim().toUpperCase();
    const g = document.getElementById('add-student-guard').value.trim();
    const p = document.getElementById('add-student-phone').value.trim();
    if (!l || !f) return alert('Completa al menos apellido y nombres');
    appData.students.push({ id: appData.nextStudentId++, last: l, first: f, guard: g, phone: p, exemptYear: false, withdrawn: false });
    closeModal('modal-add-student');
    logActivity('AGREGAR_ALUMNO', `Agregó nuevo alumno: ${l} ${f}`);
    alert('Alumno agregado correctamente');
}

// ----- Participación / retiro -----

// "No participa" es el mismo campo que antes se llamaba "Eximir año": no se le cobra ni cuenta en actividades.
function toggleExemptYear(studentId) {
    const s = appData.students.find(x => x.id === studentId);
    if (!s) return;
    s.exemptYear = !s.exemptYear;
    logActivity(s.exemptYear ? 'EXIMIR_ALUMNO_AÑO' : 'QUITAR_EXENCION', `${studentFullName(s)} - ${s.exemptYear ? 'No participa de las actividades del curso' : 'Vuelve a participar'}`);
}

function retireStudent(studentId) {
    const s = appData.students.find(x => x.id === studentId);
    if (!s || s.withdrawn) return;
    const debt = isPayingStudent(s) ? getStudentDebt(studentId) : null;
    let msg = `¿Retirar a ${studentFullName(s)} del curso?\n\nDejará de aparecer en cuotas, eventos, morosidad y votaciones. Su historial de pagos se conserva y puedes reintegrarlo después.`;
    if (debt && debt.totalDebt > 0) {
        msg += `\n\n⚠️ Tiene ${debt.periods} período(s) impago(s) por ${formatCLP(debt.totalDebt)}. Al retirarlo esa deuda ya no se contará en Morosidad.`;
    }
    if (!confirm(msg)) return;
    s.withdrawn = true;
    s.withdrawnAt = todayISO();
    logActivity('RETIRAR_ALUMNO', `${studentFullName(s)} fue retirado del curso`);
}

function reinstateStudent(studentId) {
    const s = appData.students.find(x => x.id === studentId);
    if (!s || !s.withdrawn) return;
    if (!confirm(`¿Reintegrar a ${studentFullName(s)} al curso?`)) return;
    s.withdrawn = false;
    delete s.withdrawnAt;
    logActivity('REINTEGRAR_ALUMNO', `${studentFullName(s)} fue reintegrado al curso`);
}

// ----- Ver datos (ficha) -----

function openStudentView(studentId) {
    const s = appData.students.find(x => x.id === studentId);
    if (!s) return;
    const st = studentStatusInfo(s);
    const d = getStudentDebt(s.id);
    const paying = isPayingStudent(s);
    const monthChips = (list, cls) => list.length
        ? list.map(m => `<span class="chip ${cls}">${MONTH_NAMES[m]}</span>`).join(' ')
        : '<span class="row-sub">Ninguno</span>';
    const extraChips = (list, cls) => list.length
        ? list.map(e => `<span class="chip ${cls}">${escapeHtml(e.concept || 'Evento')}</span>`).join(' ')
        : '<span class="row-sub">Ninguno</span>';

    const finance = paying ? `
<div class="kpi-banner view-kpis">
<div class="kpi ${d.totalDebt > 0 ? 'bad' : 'ok'}"><div class="kpi-label">Deuda total</div><div class="kpi-value">${formatCLP(d.totalDebt)}</div><div class="kpi-foot">${d.periods} período(s) impago(s)</div></div>
<div class="kpi info"><div class="kpi-label">Cuotas al día</div><div class="kpi-value">${d.paidMonths.length}/${d.paidMonths.length + d.unpaidMonths.length}</div><div class="kpi-foot">meses hasta hoy</div></div>
<div class="kpi info"><div class="kpi-label">Eventos al día</div><div class="kpi-value">${d.paidExtras.length}/${d.paidExtras.length + d.unpaidExtras.length}</div><div class="kpi-foot">eventos por alumno</div></div>
</div>
<div class="view-block"><div class="view-label">Cuotas pendientes</div><div class="chip-wrap">${monthChips(d.unpaidMonths, 'bad')}</div></div>
<div class="view-block"><div class="view-label">Eventos pendientes</div><div class="chip-wrap">${extraChips(d.unpaidExtras, 'bad')}</div></div>
<div class="view-block"><div class="view-label">Cuotas pagadas</div><div class="chip-wrap">${monthChips(d.paidMonths, 'ok')}</div></div>`
        : `<div class="view-note">${s.withdrawn ? `Retirado del curso${s.withdrawnAt ? ' el ' + new Date(s.withdrawnAt + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}.` : 'No participa de las actividades: no se le cobra cuota ni eventos.'}
 Historial: ${d.paidMonths.length} cuota(s) y ${d.paidExtras.length} evento(s) registrados como pagados.</div>`;

    document.getElementById('student-view-body').innerHTML = `
<div class="view-head"><div class="student-num">${s.id}</div><div class="row-main"><h3 class="view-name">${escapeHtml(studentFullName(s))}</h3><span class="chip ${st.chip}">${st.label}</span></div></div>
<div class="view-grid">
<div><div class="view-label">Apoderado</div><div class="view-value">${escapeHtml(s.guard || 'Sin apoderado')}</div></div>
<div><div class="view-label">Teléfono</div><div class="view-value">${escapeHtml(s.phone || 'Sin teléfono')}</div></div>
</div>
${finance}
<div class="view-actions">
${s.withdrawn ? '' : `<button type="button" class="act act-brand" onclick="closeModal('modal-student-view'); openEditStudentModal(${s.id})">${ico('edit')} Editar</button>`}
<button type="button" class="act" onclick="closeModal('modal-student-view')">Cerrar</button>
</div>`;
    document.getElementById('modal-student-view').classList.add('active');
}
