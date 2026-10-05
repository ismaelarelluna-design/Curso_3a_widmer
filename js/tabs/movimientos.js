// ===== MOVIMIENTOS: registro de actividad con filtros y paginación =====
// Los registros se guardan en appData.logs ({ts, user, action, details}); aquí solo se leen.
// deleteLog usa el índice ORIGINAL del registro, así que filtrar/paginar no cambia qué se borra.

const MOV_PAGE_SIZE = 10;
const movimientosState = { q: '', user: 'all', action: 'all', page: 1 };

const ACTION_LABELS = {
    PAGO_CUOTA: 'Pago de cuota', ELIMINAR_PAGO_CUOTA: 'Pago de cuota eliminado',
    INGRESO_FIJO: 'Ingreso extra (monto fijo)', INGRESO_POR_ALUMNO: 'Ingreso extra (por alumno)',
    EDITAR_INGRESO: 'Ingreso editado', ELIMINAR_INGRESO: 'Ingreso eliminado',
    AGREGAR_EGRESO: 'Gasto agregado', EDITAR_EGRESO: 'Gasto editado', ELIMINAR_EGRESO: 'Gasto eliminado',
    AGREGAR_ALUMNO: 'Alumno agregado', EDITAR_ALUMNO: 'Alumno editado',
    RETIRAR_ALUMNO: 'Alumno retirado', REINTEGRAR_ALUMNO: 'Alumno reintegrado',
    'EXIMIR_ALUMNO_AÑO': 'Alumno no participa', QUITAR_EXENCION: 'Alumno vuelve a participar',
    CREAR_VOTACION: 'Votación creada', EDITAR_VOTACION: 'Votación editada', ELIMINAR_VOTACION: 'Votación eliminada',
    ELIMINAR_VOTO: 'Voto eliminado', EXPORTAR_VOTACION: 'Votación exportada',
    CREAR_RIFA: 'Rifa creada', EDITAR_RIFA: 'Rifa editada', ELIMINAR_RIFA: 'Rifa eliminada',
    SORTEAR_RIFA: 'Rifa sorteada', EXPORTAR_RIFA_PDF: 'Rifa exportada (PDF)',
    WHATSAPP_MOROSIDAD: 'Aviso de morosidad (WhatsApp)', DESCARGAR_PDF_VOUCHER: 'Estado de cuenta descargado',
    EXPORTAR_PDF: 'Transparencia exportada (PDF)', ACTUALIZAR_CONFIG: 'Configuración actualizada'
};
const ACTION_TONE = (code) => /^ELIMINAR|RETIRAR/.test(code) ? 'bad' : (/^(CREAR|AGREGAR|PAGO|INGRESO|REINTEGRAR|SORTEAR)/.test(code) ? 'ok' : (/^EDITAR|ACTUALIZAR|EXIMIR|QUITAR/.test(code) ? 'warn' : 'info'));
const actionLabel = code => ACTION_LABELS[code] || String(code || '').replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

function movimientosSetQuery(v) { movimientosState.q = v; movimientosState.page = 1; renderMovimientosList(); }
function movimientosSetUser(v) { movimientosState.user = v; movimientosState.page = 1; renderMovimientosList(); }
function movimientosSetAction(v) { movimientosState.action = v; movimientosState.page = 1; renderMovimientosList(); }
function movimientosGoPage(p) { movimientosState.page = p; renderMovimientosList(); }

function fillSelectKeepingValue(id, firstLabel, options, current) {
    const el = document.getElementById(id);
    if (!el) return current;
    const wanted = options.some(o => o.value === current) ? current : 'all';
    el.innerHTML = `<option value="all">${firstLabel}</option>` + options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    el.value = wanted;
    return wanted;
}

function renderMovimientos() {
    const banner = document.getElementById('movimientos-banner');
    if (!banner) return;
    const logs = appData.logs || [];
    const today = new Date().toDateString();
    const todayCount = logs.filter(l => new Date(l.ts).toDateString() === today).length;
    const users = new Set(logs.map(l => l.user));
    const last = logs[0];
    banner.innerHTML = `
<div class="kpi-banner-title"><h3>🕘 Movimientos</h3><span class="sub">Quién hizo qué en la app</span></div>
<div class="kpi brand"><div class="kpi-label">Registros</div><div class="kpi-value">${logs.length}</div><div class="kpi-foot">acciones guardadas</div></div>
<div class="kpi ok"><div class="kpi-label">Hoy</div><div class="kpi-value">${todayCount}</div><div class="kpi-foot">acciones de hoy</div></div>
<div class="kpi info"><div class="kpi-label">Usuarios activos</div><div class="kpi-value">${users.size}</div><div class="kpi-foot">han registrado acciones</div></div>
<div class="kpi warn"><div class="kpi-label">Última acción</div><div class="kpi-value kpi-value-sm">${last ? escapeHtml(actionLabel(last.action)) : '—'}</div><div class="kpi-foot">${last ? `${escapeHtml(last.user)} · ${new Date(last.ts).toLocaleDateString('es-CL')}` : 'sin registros'}</div></div>`;

    // Los desplegables se arman con lo que realmente existe en el registro
    const userOpts = [...users].sort().map(u => ({ value: u, label: u }));
    const actionOpts = [...new Set(logs.map(l => l.action))].map(a => ({ value: a, label: actionLabel(a) })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
    movimientosState.user = fillSelectKeepingValue('movimientos-user', 'Todos', userOpts, movimientosState.user);
    movimientosState.action = fillSelectKeepingValue('movimientos-action', 'Todas', actionOpts, movimientosState.action);
    renderMovimientosList();
}

function renderMovimientosList() {
    const list = document.getElementById('movimientos-list');
    const pager = document.getElementById('movimientos-pager');
    if (!list || !pager) return;
    const mode = getViewMode('movimientos', 'rows');
    document.getElementById('movimientos-view-toggle').innerHTML = viewToggleHTML('movimientos', 'renderMovimientosList', 'rows');

    const st = movimientosState;
    const q = searchKey(st.q);
    const canDelete = currentUser === 'I.ARELLUNA';
    // se conserva el índice original de cada registro para poder borrarlo bien
    const filtered = (appData.logs || []).map((l, oi) => ({ l, oi })).filter(({ l }) => {
        if (st.user !== 'all' && l.user !== st.user) return false;
        if (st.action !== 'all' && l.action !== st.action) return false;
        return !q || searchKey(`${l.details || ''} ${actionLabel(l.action)} ${l.user}`).includes(q);
    });
    document.getElementById('movimientos-count').textContent = `${filtered.length} de ${(appData.logs || []).length}`;

    const pages = Math.max(1, Math.ceil(filtered.length / MOV_PAGE_SIZE));
    if (st.page > pages) st.page = pages;
    const start = (st.page - 1) * MOV_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + MOV_PAGE_SIZE);

    if (pageItems.length === 0) {
        list.className = '';
        list.innerHTML = '<div class="empty-state">Sin registros de actividad para estos filtros.</div>';
        pager.innerHTML = '';
        return;
    }
    const delBtn = oi => canDelete ? `<button type="button" class="act act-danger" onclick="deleteLog(${oi})">${ico('trash')} Eliminar</button>` : '';
    const stamp = l => { const d = new Date(l.ts); return `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`; };

    if (mode === 'cards') {
        list.className = 'data-grid';
        list.innerHTML = pageItems.map(({ l, oi }) => `<div class="data-card">
<div class="data-card-head"><div class="row-main"><span class="chip ${ACTION_TONE(l.action)}">${escapeHtml(actionLabel(l.action))}</span></div><span class="chip brand">${escapeHtml(l.user)}</span></div>
<div class="row-sub wrap">${escapeHtml(l.details)}</div><div class="row-sub">🕒 ${stamp(l)}</div>
${canDelete ? `<div class="data-card-actions">${delBtn(oi)}</div>` : ''}</div>`).join('');
    } else {
        list.className = 'data-list';
        list.innerHTML = pageItems.map(({ l, oi }) => `<div class="data-row">
<div class="row-main"><div class="row-title">${escapeHtml(l.details)}</div><div class="row-sub">🕒 ${stamp(l)}</div></div>
<span class="chip ${ACTION_TONE(l.action)}">${escapeHtml(actionLabel(l.action))}</span><span class="chip brand">${escapeHtml(l.user)}</span>
${canDelete ? `<div class="row-actions">${delBtn(oi)}</div>` : ''}</div>`).join('');
    }

    // Paginador: muestra primera, última y las vecinas de la actual
    const nums = [];
    for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - st.page) <= 1) nums.push(p);
    let html = `<button type="button" class="pg" ${st.page === 1 ? 'disabled' : ''} onclick="movimientosGoPage(${st.page - 1})" aria-label="Página anterior">‹</button>`;
    let prev = 0;
    nums.forEach(p => {
        if (p - prev > 1) html += '<span class="pg-gap">…</span>';
        html += `<button type="button" class="pg ${p === st.page ? 'active' : ''}" ${p === st.page ? 'aria-current="page"' : ''} onclick="movimientosGoPage(${p})">${p}</button>`;
        prev = p;
    });
    html += `<button type="button" class="pg" ${st.page === pages ? 'disabled' : ''} onclick="movimientosGoPage(${st.page + 1})" aria-label="Página siguiente">›</button>`;
    html += `<span class="pg-info">Mostrando ${start + 1}–${start + pageItems.length} de ${filtered.length}</span>`;
    pager.innerHTML = html;
}

function deleteLog(idx) {
    if (currentUser !== 'I.ARELLUNA') return alert('Solo I.ARELLUNA puede eliminar registros');
    if (!confirm('¿Eliminar este registro?')) return;
    appData.logs.splice(idx, 1);
    saveData();
}
