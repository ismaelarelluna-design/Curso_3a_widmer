function toggleMobileMenu() { const s=document.getElementById('sidebar'), o=document.getElementById('menuOverlay'); s.classList.toggle('active'); o.classList.toggle('active'); }
const formatCLP = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(n);
const closeModal = id => document.getElementById(id).classList.remove('active');
window.onclick = e => { if(e.target.classList.contains('modal')) e.target.classList.remove('active'); }
const safeBase64 = (data) => { if (!data) return null; const clean = data.replace(/\s/g, ''); return clean.startsWith('data:') ? clean : `data:image/jpeg;base64,${clean}`; };
function openReceiptPreview(id) { const rec = appData.egresos.find(x => x.id === id); if (!rec || !rec.file) return alert('No hay archivo adjunto.'); const clean = safeBase64(rec.file); const win = window.open('', '_blank', 'width=800,height=600'); win.document.write(`<!DOCTYPE html><html><head><title>Comprobante - ${rec.desc}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafc;font-family:system-ui;}</style></head><body><div style="background:white;padding:1rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:95%;max-height:95vh;overflow:auto;"><img src="${clean}" style="display:block;max-width:100%;height:auto;" alt="Boleta"><p style="text-align:center;margin-top:0.8rem;color:#64748b;font-size:0.9rem;">${rec.desc} | ${rec.date} | ${formatCLP(rec.amount)}</p></div></body></html>`); win.document.close(); }
Chart.register(ChartDataLabels);
// Degradado de dos tonos para barras/líneas (neón suave). Antes de que el chart
// tenga layout (chartArea aún null) se devuelve el color inicial como fallback.
function neonGradient(ctx, chartArea, colorFrom, colorTo, horizontal) {
    if (!chartArea) return colorFrom;
    const gradient = horizontal
        ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
        : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, colorFrom);
    gradient.addColorStop(1, colorTo);
    return gradient;
}
// Relleno de área que se desvanece (para el "fill" bajo una línea), típico look neón suave.
function neonAreaFill(ctx, chartArea, color, maxAlpha) {
    if (!chartArea) return 'transparent';
    const a = maxAlpha || 0.35;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexToRgba(color, a));
    gradient.addColorStop(1, hexToRgba(color, 0));
    return gradient;
}
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
// Plugin de "resplandor" neón: dibuja una sombra de color detrás del dataset
// (usa dataset._glowColor si se define, si no cae al borderColor). Se activa
// solo en los charts que lo incluyan explícitamente en su array "plugins".
function neonGlowPlugin(blur) {
    return {
        id: 'neonGlow',
        beforeDatasetDraw(chart, args) {
            const ds = chart.data.datasets[args.index];
            let color = ds._glowColor || ds.borderColor;
            if (Array.isArray(color)) color = color[0];
            if (typeof color !== 'string') color = '#00e5ff';
            chart.ctx.save();
            chart.ctx.shadowColor = color;
            chart.ctx.shadowBlur = blur || 10;
        },
        afterDatasetDraw(chart) {
            chart.ctx.restore();
        }
    };
}
function createChart(cid, cfg) { const ctx = document.getElementById(cid).getContext('2d'); const dk = document.body.getAttribute('data-theme') === 'dark'; cfg.options = cfg.options || {}; cfg.options.plugins = cfg.options.plugins || {}; cfg.options.plugins.legend = cfg.options.plugins.legend || {}; cfg.options.plugins.legend.labels = cfg.options.plugins.legend.labels || {}; cfg.options.plugins.legend.labels.color = dk ? '#94a3b8' : '#64748b'; cfg.options.plugins.datalabels = Object.assign({ anchor: 'end', align: 'end', offset: 0, color: dk ? '#f1f5f9' : '#1e293b', font: { weight: 'bold', size: 12 } }, cfg.options.plugins.datalabels || {}); cfg.options.scales = cfg.options.scales || {}; Object.keys(cfg.options.scales).forEach(s => { if(!cfg.options.scales[s].ticks) cfg.options.scales[s].ticks = {}; cfg.options.scales[s].ticks.color = dk ? '#94a3b8' : '#64748b'; if(!cfg.options.scales[s].grid) cfg.options.scales[s].grid = {}; cfg.options.scales[s].grid.color = dk ? '#334155' : '#e2e8f0'; }); if(charts[cid]) charts[cid].destroy(); charts[cid] = new Chart(ctx, cfg); }
function updateChartsTheme() { Object.keys(charts).forEach(id => { const c=charts[id]; const dk=document.body.getAttribute('data-theme')==='dark'; if(c.options.plugins.legend?.labels) c.options.plugins.legend.labels.color=dk?'#94a3b8':'#64748b'; if(c.options.scales) Object.keys(c.options.scales).forEach(s=>{if(c.options.scales[s].ticks)c.options.scales[s].ticks.color=dk?'#94a3b8':'#64748b';if(c.options.scales[s].grid)c.options.scales[s].grid.color=dk?'#334155':'#e2e8f0';}); c.update(); }); }
