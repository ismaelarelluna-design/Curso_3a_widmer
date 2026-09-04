function renderTransparencia() {
    const tCuotas = appData.cuotas.reduce((s, c) => s + c.total, 0);
    const tExtras = appData.ingresos.reduce((s, i) => s + i.amount, 0);
    const tEgresos = appData.egresos.reduce((s, e) => s + e.amount, 0);
    const balance = (tCuotas + tExtras) - tEgresos;
    const cuotaMensual = appData.config.cuotaAmount || 5000;
    const exemptCount = appData.students.filter(s => s.exemptYear).length;
    const activeStudents = appData.students.length - exemptCount;
    const maxCuotasAnual = activeStudents * cuotaMensual * 10;
    const porcentajeRecaudacion = maxCuotasAnual > 0 ? ((tCuotas / maxCuotasAnual) * 100).toFixed(1) : 0;
    const promedioExtra = activeStudents > 0 ? (tExtras / activeStudents).toFixed(0) : 0;

    document.getElementById('trans-cuotas').textContent = formatCLP(tCuotas);
    document.getElementById('trans-extras').textContent = formatCLP(tExtras);
    document.getElementById('trans-porcentaje').textContent = `${porcentajeRecaudacion}%`;
    document.getElementById('trans-promedio').textContent = formatCLP(promedioExtra);
    document.getElementById('trans-egresos').textContent = formatCLP(tEgresos);
    document.getElementById('trans-balance').textContent = formatCLP(balance);
    document.getElementById('trans-balance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

    const dk = document.body.getAttribute('data-theme') === 'dark';
    const axisColor = dk ? '#94a3b8' : '#64748b';
    const gridColor = dk ? '#334155' : '#e2e8f0';
    const labelColor = dk ? '#f1f5f9' : '#1e293b';
    const pieLabelColor = dk ? '#f1f5f9' : '#ffffff';

    // ===== Gráfico 1 (ya existía): Alumnos al Día por mes =====
    const utd = ALL_MONTHS.map(m => { const c = appData.cuotas.find(x => x.month === `2026-${m}`); return c ? c.paidStudents.length : 0; });
    createChart('transChartUpToDate', { type: 'bar', data: { labels: ALL_MONTHS.map(m => MONTH_NAMES[m]), datasets: [{ label: 'Alumnos al Día', data: utd, backgroundColor: (c) => neonGradient(c.chart.ctx, c.chart.chartArea, '#00e5ff', '#b026ff'), borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', offset: 8, clip: false, color: labelColor, font: { weight: 'bold', size: 14 }, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 5, color: axisColor }, grid: { color: gridColor } }, x: { ticks: { color: axisColor }, grid: { display: false } } } } });

    // ===== Gráfico 2 (ya existía): Ingresos vs Egresos totales =====
    createChart('transChartGlobal', { type: 'bar', data: { labels: ['Ingresos Totales', 'Egresos Totales'], datasets: [{ label: 'Monto', data: [tCuotas + tExtras, tEgresos], backgroundColor: (c) => { const pair = c.dataIndex === 0 ? ['#00ff9d', '#00e5ff'] : ['#ff2e63', '#ff2ee6']; return neonGradient(c.chart.ctx, c.chart.chartArea, pair[0], pair[1]); }, borderRadius: 8, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', offset: 5, color: labelColor, font: { weight: 'bold', size: 14 }, formatter: v => formatCLP(v) } }, scales: { y: { beginAtZero: true, ticks: { color: axisColor, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: gridColor } }, x: { ticks: { color: axisColor }, grid: { display: false } } } } });

    // ===== Gráfico 3 (nuevo): Pagados vs Pendientes por mes (barra apilada) =====
    // Solo números, sin nombres. Meses futuros al mes actual muestran 0 pendientes
    // (todavía no corresponde exigir el pago), igual criterio que usa Morosidad.
    const currentMonthIdx = getCurrentMonthIndex();
    const pendArr = ALL_MONTHS.map((m, idx) => {
        if (idx > currentMonthIdx) return 0;
        const c = appData.cuotas.find(x => x.month === `2026-${m}`);
        const pagados = c ? c.paidStudents.length : 0;
        return Math.max(activeStudents - pagados, 0);
    });
    createChart('transChartPagosPendientes', { type: 'bar', data: { labels: ALL_MONTHS.map(m => MONTH_NAMES_SHORT[m]), datasets: [{ label: 'Pagados', data: utd, backgroundColor: (c) => neonGradient(c.chart.ctx, c.chart.chartArea, '#00ff9d', '#00e5ff'), stack: 'cuotas', borderRadius: 4 }, { label: 'Pendientes', data: pendArr, backgroundColor: (c) => neonGradient(c.chart.ctx, c.chart.chartArea, '#ff2e63', '#ff2ee6'), stack: 'cuotas', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor } } }, scales: { y: { beginAtZero: true, stacked: true, ticks: { color: axisColor, stepSize: 5 }, grid: { color: gridColor } }, x: { stacked: true, ticks: { color: axisColor }, grid: { display: false } } } } });

    // ===== Gráfico 4 (nuevo): % Recaudación Anual (torta) =====
    const faltaRecaudar = Math.max(maxCuotasAnual - tCuotas, 0);
    createChart('transChartRecaudacionPie', { type: 'doughnut', data: { labels: ['Recaudado', 'Falta por Recaudar'], datasets: [{ data: [tCuotas, faltaRecaudar], backgroundColor: (c) => c.dataIndex === 0 ? neonGradient(c.chart.ctx, c.chart.chartArea, '#00ff9d', '#00e5ff', true) : '#e2e8f0', borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor } }, datalabels: { color: pieLabelColor, font: { weight: 'bold', size: 13 }, formatter: v => maxCuotasAnual > 0 ? `${Math.round(v / maxCuotasAnual * 100)}%` : '' } } } });

    // ===== Gráfico 5 (nuevo): Meta vs. Real acumulado (cuotas) =====
    let metaAcum = 0, realAcum = 0;
    const metaSerie = [], realSerie = [];
    ALL_MONTHS.forEach(m => {
        metaAcum += cuotaMensual * activeStudents;
        const c = appData.cuotas.find(x => x.month === `2026-${m}`);
        realAcum += c ? c.total : 0;
        metaSerie.push(metaAcum);
        realSerie.push(realAcum);
    });
    createChart('transChartMetaVsReal', { type: 'line', data: { labels: ALL_MONTHS.map(m => MONTH_NAMES_SHORT[m]), datasets: [{ label: 'Meta Acumulada', data: metaSerie, borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.08)', borderDash: [6, 4], fill: false, tension: 0.3, pointRadius: 4 }, { label: 'Recaudado Real', data: realSerie, borderColor: '#00e5ff', backgroundColor: (c) => neonAreaFill(c.chart.ctx, c.chart.chartArea, '#00e5ff', 0.35), _glowColor: '#00e5ff', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#00e5ff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: axisColor } } }, scales: { y: { beginAtZero: true, ticks: { color: axisColor, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: gridColor } }, x: { ticks: { color: axisColor }, grid: { color: gridColor } } } }, plugins: [neonGlowPlugin(10)] });

    // ===== Gráfico 6 (nuevo): Origen de los ingresos — Cuotas vs Extras (torta) =====
    createChart('transChartOrigenIngresos', { type: 'doughnut', data: { labels: ['Cuotas', 'Ingresos Extra'], datasets: [{ data: [tCuotas, tExtras], backgroundColor: (c) => { const pair = c.dataIndex === 0 ? ['#b026ff', '#ff2ee6'] : ['#00e5ff', '#b026ff']; return neonGradient(c.chart.ctx, c.chart.chartArea, pair[0], pair[1], true); }, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor } }, datalabels: { color: pieLabelColor, font: { weight: 'bold', size: 13 }, formatter: v => formatCLP(v) } } } });

    // ===== Gráfico 7 (nuevo): Gastos por mes (barra) =====
    const gastosPorMes = ALL_MONTHS.map(m => appData.egresos.filter(e => e.date.startsWith(`2026-${m}`)).reduce((s, e) => s + e.amount, 0));
    createChart('transChartGastosPorMes', { type: 'bar', data: { labels: ALL_MONTHS.map(m => MONTH_NAMES_SHORT[m]), datasets: [{ label: 'Gastos', data: gastosPorMes, backgroundColor: (c) => neonGradient(c.chart.ctx, c.chart.chartArea, '#ff2e63', '#ff2ee6'), borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: labelColor, font: { weight: 'bold', size: 11 }, formatter: v => v > 0 ? formatCLP(v) : '' } }, scales: { y: { beginAtZero: true, ticks: { color: axisColor, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: gridColor } }, x: { ticks: { color: axisColor }, grid: { display: false } } } } });

    // ===== Gráfico 8 (nuevo): Balance acumulado (caja) mes a mes (línea) =====
    let saldoAcum = 0;
    const saldoSerie = ALL_MONTHS.map(m => {
        const cRec = appData.cuotas.find(x => x.month === `2026-${m}`);
        const ingresosMes = (cRec ? cRec.total : 0) + appData.ingresos.filter(i => i.date.startsWith(`2026-${m}`)).reduce((s, i) => s + i.amount, 0);
        const egresosMes = appData.egresos.filter(e => e.date.startsWith(`2026-${m}`)).reduce((s, e) => s + e.amount, 0);
        saldoAcum += (ingresosMes - egresosMes);
        return saldoAcum;
    });
    const balanceColor = saldoSerie[saldoSerie.length - 1] >= 0 ? '#00e5ff' : '#ff2ee6';
    createChart('transChartBalanceAcumulado', { type: 'line', data: { labels: ALL_MONTHS.map(m => MONTH_NAMES_SHORT[m]), datasets: [{ label: 'Balance Acumulado', data: saldoSerie, borderColor: balanceColor, backgroundColor: (c) => neonAreaFill(c.chart.ctx, c.chart.chartArea, balanceColor, 0.35), _glowColor: balanceColor, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: balanceColor }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: labelColor, font: { weight: 'bold', size: 11 }, formatter: v => formatCLP(v) } }, scales: { y: { ticks: { color: axisColor, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: gridColor } }, x: { ticks: { color: axisColor }, grid: { color: gridColor } } } }, plugins: [neonGlowPlugin(10)] });

    // ===== Tabla de gastos del mes (sin cambios) =====
    const me = appData.egresos.filter(e => e.date.startsWith(`2026-${currentMonth}`));
    document.getElementById('trans-expenses-body').innerHTML = me.map(e => `<tr><td>${e.desc}</td><td><span class="badge badge-pending">Gasto</span></td><td>${formatCLP(e.amount)}</td><td>${e.file ? `<button class="btn-view-file" onclick="openReceiptPreview(${e.id})">📄 Ver Boleta</button>` : '-'}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--text-light); padding:1.5rem;">Sin gastos este mes</td></tr>';
}
function exportToPDF() {
    const el = document.getElementById('transparency-content');
    const filename = `Transparencia_3A_${MONTH_NAMES[currentMonth]}_2026`;

    // Los navegadores de fábrica de algunos celulares (ej: Huawei) bloquean en
    // silencio la descarga automática por blob/data-URI, sin mostrar ningún
    // error. En vez de pelear con eso, usamos la función de imprimir nativa
    // del propio Android/navegador: siempre trae la opción "Guardar como PDF".
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Tu navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para este sitio e inténtalo de nuevo.');
        return;
    }
    printWindow.document.write('<title>Generando PDF...</title><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#334155;">Generando PDF, un momento...</body>');
    printWindow.document.close();

    // Los gráficos (canvas) se ven según el tema actual (claro/oscuro). Para que
    // el PDF quede legible siempre, forzamos modo claro, reconstruimos los charts
    // con esos colores, tomamos una foto de cada uno, y al final devolvemos todo
    // a como estaba (esto sí puede verse un instante en pantalla, es normal).
    const originalTheme = document.body.getAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    renderTransparencia();

    setTimeout(() => {
        const clone = el.cloneNode(true);
        const liveCanvases = el.querySelectorAll('canvas');
        const cloneCanvases = clone.querySelectorAll('canvas');
        liveCanvases.forEach((liveCanvas, i) => {
            try {
                const img = document.createElement('img');
                img.src = liveCanvas.toDataURL('image/png');
                img.style.cssText = 'max-width:100%; height:auto; display:block; margin:0 auto;';
                cloneCanvases[i].replaceWith(img);
            } catch (e) {
                console.error('No se pudo capturar un gráfico:', e);
            }
        });
        clone.querySelectorAll('.transparency-header button').forEach(b => b.remove());
        clone.querySelectorAll('.btn-view-file').forEach(b => b.remove());

        const cssHref = new URL('css/styles.css', window.location.href).href;
        printWindow.document.open();
        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filename}</title><link rel="stylesheet" href="${cssHref}"><style>
body { margin: 0; padding: 16px; background: #fff; color: #1e293b; }
.chart-row { display: block; }
.card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1.2rem; border: 1px solid #ddd; box-shadow: none; }
.stat-card, .stats-grid, .bank-info { break-inside: avoid; page-break-inside: avoid; }
.print-toolbar { text-align: center; padding: 14px; background: #f1f5f9; margin-bottom: 16px; border-radius: 8px; }
.print-toolbar button { padding: 10px 18px; font-size: 1rem; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
@media print { .print-toolbar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="print-toolbar"><button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>
${clone.innerHTML}
</body></html>`);
        printWindow.document.close();

        // Restaurar el tema real de la app (los charts en pantalla quedaron
        // reconstruidos en modo claro, hay que devolverlos a su estado normal).
        if (originalTheme) document.body.setAttribute('data-theme', originalTheme);
        renderTransparencia();

        logActivity('EXPORTAR_PDF', `Exportó transparencia ${MONTH_NAMES[currentMonth]} 2026`);
        printWindow.onload = () => {
            setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
        };
    }, 1000);
}
function showShareModal() { const publicLink = window.location.origin + window.location.pathname + '?view=transparencia'; document.getElementById('share-link').value = publicLink; document.getElementById('modal-share').classList.add('active'); }
function copyShareLink() { const i = document.getElementById('share-link'); i.select(); document.execCommand('copy'); alert('Link copiado al portapapeles'); }
