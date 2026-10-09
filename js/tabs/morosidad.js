const morosidadState = { q: '', sort: 'high', scope: 'today' };
function morosidadSetQuery(v) { morosidadState.q = v; renderMorosidadList(); }
function morosidadSetSort(v) { morosidadState.sort = v; renderMorosidadList(); }
function morosidadSetScope(v) { morosidadState.scope = v; renderMorosidad(); }

// Dos formas de medir la deuda de un alumno:
//   today : lo vencido hasta el mes actual + eventos impagos  ("ponerse al día")
//   year  : lo anterior + los meses que faltan hasta diciembre ("pago completo del año")
const debtOf = (d, scope) => scope === 'year' ? d.yearDebt : d.totalDebt;
const periodsOf = (d, scope) => scope === 'year' ? d.yearPeriods : d.periods;

// Alumnos que deben pagar y tienen deuda en el criterio elegido (retirados y no participan no se cobran).
function getMorosos(scope) {
    scope = scope || morosidadState.scope;
    return getPayingStudents().map(s => ({ s, d: getStudentDebt(s.id) })).filter(x => periodsOf(x.d, scope) > 0);
}

function renderMorosidad() {
    const banner = document.getElementById('morosidad-banner');
    if (!banner) return;
    const scope = morosidadState.scope;
    const today = getMorosos('today');
    const year = getMorosos('year');
    const payers = getPayingStudents().length;
    const totalToday = today.reduce((a, x) => a + x.d.totalDebt, 0);
    const totalYear = year.reduce((a, x) => a + x.d.yearDebt, 0);
    const cuotasDebt = today.reduce((a, x) => a + x.d.unpaidMonths.length * x.d.cuotaMensual, 0);
    const eventosDebt = totalToday - cuotasDebt;
    const futureTotal = totalYear - totalToday;
    const sel = k => scope === k ? ' kpi-selected' : '';
    const lastMonth = MONTH_NAMES[ALL_MONTHS[ALL_MONTHS.length - 1]].toLowerCase();

    banner.innerHTML = `
<div class="kpi-banner-title"><h3>📋 Morosidad</h3><span class="sub">Deuda de mensualidades y eventos pendientes</span></div>
<div class="kpi ${totalToday > 0 ? 'bad' : 'ok'}${sel('today')}"><div class="kpi-label">Para ponerse al día</div><div class="kpi-value">${formatCLP(totalToday)}</div><div class="kpi-foot">cuotas ${formatCLP(cuotasDebt)} · eventos ${formatCLP(eventosDebt)}</div></div>
<div class="kpi brand${sel('year')}"><div class="kpi-label">Pago completo a ${lastMonth}</div><div class="kpi-value">${formatCLP(totalYear)}</div><div class="kpi-foot">incluye ${formatCLP(futureTotal)} de meses por vencer</div></div>
<div class="kpi warn"><div class="kpi-label">Alumnos atrasados</div><div class="kpi-value">${today.length}</div><div class="kpi-foot">de ${payers} que deben pagar</div></div>
<div class="kpi info"><div class="kpi-label">Con saldo del año</div><div class="kpi-value">${year.length}</div><div class="kpi-foot">alumnos con algo por pagar hasta ${lastMonth}</div></div>`;
    renderMorosidadList();
}

function renderMorosidadList() {
    const list = document.getElementById('morosidad-list');
    if (!list) return;
    const mode = getViewMode('morosidad', 'cards');
    const scope = morosidadState.scope;
    const lastMonth = MONTH_NAMES[ALL_MONTHS[ALL_MONTHS.length - 1]].toLowerCase();
    document.getElementById('morosidad-view-toggle').innerHTML = viewToggleHTML('morosidad', 'renderMorosidadList', 'cards');
    const scopeEl = document.getElementById('morosidad-scope-toggle');
    if (scopeEl) scopeEl.innerHTML = segToggleHTML([{ value: 'today', label: 'Ponerse al día' }, { value: 'year', label: `Pago completo a ${lastMonth}` }], scope, 'morosidadSetScope');

    const all = getMorosos(scope);
    if (all.length === 0) {
        list.className = '';
        list.innerHTML = `<div class="empty-state"><p style="font-size:1.1rem;">${scope === 'year' ? `¡Excelente! No queda nada por pagar hasta ${lastMonth}.` : '¡Excelente! No hay morosidad en el curso.'}</p></div>`;
        document.getElementById('morosidad-count').textContent = '';
        return;
    }
    const q = searchKey(morosidadState.q);
    const items = all.filter(x => !q || searchKey(`${x.s.last} ${x.s.first} ${x.s.guard || ''} ${x.s.id}`).includes(q));
    const by = {
        high: (a, b) => debtOf(b.d, scope) - debtOf(a.d, scope),
        low: (a, b) => debtOf(a.d, scope) - debtOf(b.d, scope),
        name: (a, b) => studentFullName(a.s).localeCompare(studentFullName(b.s), 'es')
    };
    items.sort(by[morosidadState.sort] || by.high);
    document.getElementById('morosidad-count').textContent = `${items.length} de ${all.length} alumnos`;

    if (items.length === 0) {
        list.className = '';
        list.innerHTML = '<div class="empty-state">No hay alumnos que coincidan con la búsqueda.</div>';
        return;
    }
    const actions = x => `<button type="button" class="act act-solid-ok" onclick="shareWhatsApp(${x.s.id}, ${debtOf(x.d, scope)}, '${scope}')">${ico('chat')} WhatsApp</button>
<button type="button" class="act act-info" onclick="showDebtVoucher(${x.s.id}, '${scope}')">${ico('file')} Ver estado de cuenta</button>`;
    // Línea de apoyo: muestra la otra cara de la deuda para comparar de un vistazo
    const subline = x => scope === 'year'
        ? (x.d.totalDebt > 0 ? `Para ponerse al día: <b>${formatCLP(x.d.totalDebt)}</b>` : 'Al día · solo meses por vencer')
        : `Pago completo a ${lastMonth}: <b>${formatCLP(x.d.yearDebt)}</b>`;
    const chipFor = x => scope === 'year'
        ? `<span class="chip ${x.d.totalDebt > 0 ? 'bad' : 'ok'}">${x.d.totalDebt > 0 ? 'Atrasado' : 'Al día'}</span><span class="chip brand">${x.d.futureMonths.length} mes${x.d.futureMonths.length === 1 ? '' : 'es'} por vencer</span>`
        : `<span class="chip bad">${x.d.periods} período${x.d.periods === 1 ? '' : 's'} impago${x.d.periods === 1 ? '' : 's'}</span>`;
    const label = scope === 'year' ? `pago completo a ${lastMonth}` : 'deuda para ponerse al día';
    const tone = x => scope === 'year' && x.d.totalDebt === 0 ? 'is-ok-soft' : 'is-debt';

    if (mode === 'cards') {
        list.className = 'data-grid';
        list.innerHTML = items.map(x => `<div class="data-card ${tone(x)}" id="morosidad-card-${x.s.id}">
<div class="data-card-head"><div class="student-num">${x.s.id}</div>
<div class="row-main"><div class="student-name">${escapeHtml(studentFullName(x.s))}</div><div class="student-detail">👤 ${escapeHtml(x.s.guard || 'Sin apoderado')}</div></div></div>
<div class="debt-line"><div><div class="debt-amount">${formatCLP(debtOf(x.d, scope))}</div><div class="row-sub">${label}</div></div><div class="chip-wrap end">${chipFor(x)}</div></div>
<div class="row-sub wrap">${subline(x)}</div>
<div class="data-card-actions">${actions(x)}</div></div>`).join('');
    } else {
        list.className = 'data-list';
        list.innerHTML = items.map(x => `<div class="data-row ${tone(x)}" id="morosidad-card-${x.s.id}">
<div class="student-num">${x.s.id}</div>
<div class="row-main"><div class="row-title">${escapeHtml(studentFullName(x.s))}</div><div class="row-sub wrap">${subline(x)}</div></div>
${chipFor(x)}<div class="debt-amount inline">${formatCLP(debtOf(x.d, scope))}</div>
<div class="row-actions">${actions(x)}</div></div>`).join('');
    }
}

function shareWhatsApp(studentId, totalDebt, scope) { const student = appData.students.find(s => s.id === studentId); if (!student) return; const { cuotaMensual, unpaidMonths, unpaidExtras, futureMonths, totalDebt: dueDebt } = getStudentDebt(studentId); const yearScope = scope === 'year'; let message = `*ESTADO DE CUENTA - CURSO 3A*\n\n`; message += `*Alumno:* ${student.last} ${student.first}\n`; message += `*Apoderado:* ${student.guard || 'N/A'}\n\n`; message += yearScope ? `*PARA PONERSE AL DÍA: ${formatCLP(dueDebt)}*\n*PAGO COMPLETO HASTA ${MONTH_NAMES[ALL_MONTHS[ALL_MONTHS.length - 1]].toUpperCase()}: ${formatCLP(totalDebt)}*\n\n` : `*DEUDA PENDIENTE: ${formatCLP(totalDebt)}*\n\n`; if (unpaidMonths.length > 0) { message += `*Mensualidades impagas:*\n`; unpaidMonths.forEach(m => { message += `• ${MONTH_NAMES[m]} 2026: ${formatCLP(cuotaMensual)}\n`; }); message += '\n'; } if (unpaidExtras.length > 0) { message += `*Eventos impagos:*\n`; unpaidExtras.forEach(e => { message += `• ${e.concept}: ${formatCLP(e.amountPer || 0)}\n`; }); message += '\n'; } if (yearScope && futureMonths.length > 0) { message += `*Meses por vencer (opcional adelantar):*\n`; futureMonths.forEach(m => { message += `• ${MONTH_NAMES[m]} 2026: ${formatCLP(cuotaMensual)}\n`; }); message += '\n'; } message += `*Datos de pago:*\nBanco: Tenpo\nCuenta: 111113268423\nRUT: 13.268.423-5\n\n`; message += yearScope ? `Si prefieres, puedes dejar pagado el año completo. ¡Gracias!` : `Por favor regularizar a la brevedad. ¡Gracias!`; const phone = student.phone ? student.phone.replace(/[^0-9]/g, '') : ''; const url = phone ? `https://wa.me/56${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(url, '_blank'); logActivity('WHATSAPP_MOROSIDAD', `Envió recordatorio WhatsApp a ${student.last} ${student.first}`); }
function showDebtVoucher(studentId, scope) { const student = appData.students.find(s => s.id === studentId); if (!student) return; const { cuotaMensual, unpaidMonths, unpaidExtras, futureMonths } = getStudentDebt(studentId); const yearScope = scope === 'year'; const dueDebt = (unpaidMonths.length * cuotaMensual) + unpaidExtras.reduce((sum, e) => sum + (e.amountPer || 0), 0); const totalDebt = dueDebt + (yearScope ? futureMonths.length * cuotaMensual : 0); const today = new Date(); const todayStr = today.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }); currentVoucherData = { student, totalDebt, unpaidMonths, unpaidExtras, cuotaMensual, today: todayStr, scope: yearScope ? 'year' : 'today' }; let rowsHTML = ''; if(unpaidMonths.length === 0 && unpaidExtras.length === 0 && !(yearScope && futureMonths.length)) { rowsHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No presenta deudas pendientes al momento de emitir este documento.</td></tr>'; } else { unpaidMonths.forEach(m => { rowsHTML += `<tr><td>Cuota ${MONTH_NAMES[m]} 2026</td><td>-</td><td class="amount-col">${formatCLP(cuotaMensual)}</td><td class="amount-col">$ 0</td><td class="amount-col">$ 0</td><td class="amount-col">${formatCLP(cuotaMensual)}</td></tr>`; }); unpaidExtras.forEach(e => { rowsHTML += `<tr><td>${e.concept}</td><td>-</td><td class="amount-col">${formatCLP(e.amountPer || 0)}</td><td class="amount-col">$ 0</td><td class="amount-col">$ 0</td><td class="amount-col">${formatCLP(e.amountPer || 0)}</td></tr>`; }); if (yearScope) { futureMonths.forEach(m => { rowsHTML += `<tr><td>Cuota ${MONTH_NAMES[m]} 2026 (por vencer)</td><td>-</td><td class="amount-col">${formatCLP(cuotaMensual)}</td><td class="amount-col">$ 0</td><td class="amount-col">$ 0</td><td class="amount-col">${formatCLP(cuotaMensual)}</td></tr>`; }); } rowsHTML += `<tr class="total-row"><td colspan="2">${yearScope ? 'TOTAL PAGO COMPLETO' : 'TOTAL DEUDA'}</td><td class="amount-col" colspan="4" style="font-size:1.3rem;">${formatCLP(totalDebt)}</td></tr>`; } const voucherHTML = `<div class="voucher-header-prof"><div class="voucher-logo-area"><img src="widmer_logo.png" alt="Logo"><div class="voucher-title-area"><h1>ESTADO DE CUENTA</h1><p>Curso 3A · Colegio Alberto Widmer</p></div></div><div style="text-align:right;"><div style="font-size:0.8rem; opacity:0.9;">Fecha de Emisión</div><div style="font-weight:700; font-size:1rem;">${todayStr}</div></div></div><div class="voucher-alert-banner">ESTADO DE CUENTA DEL ALUMNO</div><div class="voucher-body-prof"><div class="voucher-recipient"><h3>Sr(a):</h3><div class="name">${student.last} ${student.first}</div><div class="unit">Unidad: Curso 3A</div></div><div class="voucher-legal-text"><strong>Presente.-</strong><br><br>Por medio del presente documento se informa el estado de cuenta del alumno hasta el momento de la generación de este informe. Se solicita regularizar las obligaciones pendientes a la brevedad para evitar inconvenientes mayores.<br><br>Este documento es emitido por la tesorería del Curso 3A del Colegio Alberto Widmer.</div><div style="margin-bottom:15px; font-size:0.9rem; color:#475569;">${yearScope ? `Para ponerse al día debe: <strong style="color:#dc2626;">${formatCLP(dueDebt)}</strong>.- El pago completo hasta diciembre asciende a: <strong style="font-size:1.2rem; color:#4338ca;">${formatCLP(totalDebt)}</strong>.- (Según detalle adjunto)` : `Su deuda actual asciende a: <strong style="font-size:1.2rem; color:#dc2626;">${formatCLP(totalDebt)}</strong>.- (Según detalle adjunto)`}</div><table class="voucher-debt-table"><thead><tr><th>Concepto</th><th>Vencimiento</th><th>Monto</th><th>Intereses</th><th>Pagado</th><th>Saldo</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="voucher-payment-section"><h4>DATOS PARA TRANSFERENCIA</h4><div class="voucher-payment-details"><div class="voucher-payment-item"><label>Titular</label><div class="val">ANGELICA LUCIA MOFRE RETAMAL</div></div><div class="voucher-payment-item"><label>RUT</label><div class="val">13.268.423-5</div></div><div class="voucher-payment-item"><label>Banco</label><div class="val">Banco Prepago Tenpo</div></div><div class="voucher-payment-item"><label>Tipo Cuenta</label><div class="val">Cuenta Vista</div></div><div class="voucher-payment-item"><label>N° Cuenta</label><div class="val">111113268423</div></div><div class="voucher-payment-item"><label>Email</label><div class="val">anlumore@gmail.com</div></div></div></div><div class="voucher-footer-prof"><p>Documento generado electrónicamente por el sistema de gestión del Curso 3A.</p><p class="date">Emitido el ${todayStr}</p></div></div>`; document.getElementById('voucher-preview').innerHTML = voucherHTML; document.getElementById('modal-debt-voucher').classList.add('active'); }
function sendWhatsAppFromModal() { if(!currentVoucherData) return; shareWhatsApp(currentVoucherData.student.id, currentVoucherData.totalDebt, currentVoucherData.scope); closeModal('modal-debt-voucher'); }
function downloadVoucherPDF() {
    if(!currentVoucherData) return;
    const source = document.getElementById('voucher-preview');
    const student = currentVoucherData.student;
    const title = `Estado_Cuenta_${student.last}_${student.first}_2026`;

    // Los navegadores de fábrica de algunos celulares (ej: Huawei) bloquean en
    // silencio la descarga automática por blob/data-URI, sin mostrar ningún
    // error. En vez de pelear con eso, usamos la función de imprimir nativa
    // del propio Android/navegador: siempre trae la opción "Guardar como PDF",
    // y no depende de ningún truco de JavaScript para descargar archivos.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Tu navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para este sitio e inténtalo de nuevo.');
        return;
    }

    const cssHref = new URL('css/styles.css', window.location.href).href;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><link rel="stylesheet" href="${cssHref}"><style>
body { margin: 0; padding: 16px; background: #fff; }
.debt-voucher { max-width: 650px; margin: 0 auto; box-shadow: none; }
.print-toolbar { text-align: center; padding: 14px; background: #f1f5f9; margin-bottom: 16px; border-radius: 8px; }
.print-toolbar button { padding: 10px 18px; font-size: 1rem; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
@media print { .print-toolbar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="print-toolbar"><button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>
${source.outerHTML}
</body></html>`);
    printWindow.document.close();
    logActivity('DESCARGAR_PDF_VOUCHER', `Descargó PDF de ${student.last} ${student.first}`);
    printWindow.onload = () => {
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    };
}
