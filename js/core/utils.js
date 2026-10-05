// ===== Menú lateral: en escritorio se esconde/muestra con animación; en móvil es un cajón =====
const navCollapsedKey = () => APP_KEY + '_nav_collapsed';
const isMobileNav = () => window.matchMedia('(max-width: 1024px)').matches;
function syncMenuButton() {
    const btn = document.getElementById('menu-btn'); if (!btn) return;
    const open = isMobileNav() ? document.getElementById('sidebar').classList.contains('active') : !document.body.classList.contains('nav-collapsed');
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function applyNavCollapsedState() {
    let collapsed = false;
    try { collapsed = localStorage.getItem(navCollapsedKey()) === '1'; } catch (e) { /* sin almacenamiento */ }
    document.body.classList.toggle('nav-collapsed', collapsed);
    syncMenuButton();
}
function toggleMobileMenu() {
    if (isMobileNav()) {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('menuOverlay').classList.toggle('active');
    } else {
        const collapsed = document.body.classList.toggle('nav-collapsed');
        try { localStorage.setItem(navCollapsedKey(), collapsed ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
    }
    syncMenuButton();
}
window.addEventListener('resize', () => { if (!isMobileNav()) { document.getElementById('sidebar')?.classList.remove('active'); document.getElementById('menuOverlay')?.classList.remove('active'); } syncMenuButton(); });
const formatCLP = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(n);
// Escapa texto libre antes de insertarlo con innerHTML (evita XSS)
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const closeModal = id => document.getElementById(id).classList.remove('active');
window.onclick = e => { if(e.target.classList.contains('modal')) e.target.classList.remove('active'); }
const safeBase64 = (data) => { if (!data) return null; const clean = data.replace(/\s/g, ''); return clean.startsWith('data:') ? clean : `data:image/jpeg;base64,${clean}`; };
function openReceiptPreview(id) { const rec = appData.egresos.find(x => x.id === id); if (!rec || !rec.file) return alert('No hay archivo adjunto.'); const clean = safeBase64(rec.file); const win = window.open('', '_blank', 'width=800,height=600'); win.document.write(`<!DOCTYPE html><html><head><title>Comprobante - ${rec.desc}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafc;font-family:system-ui;}</style></head><body><div style="background:white;padding:1rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:95%;max-height:95vh;overflow:auto;"><img src="${clean}" style="display:block;max-width:100%;height:auto;" alt="Boleta"><p style="text-align:center;margin-top:0.8rem;color:#64748b;font-size:0.9rem;">${rec.desc} | ${rec.date} | ${formatCLP(rec.amount)}</p></div></body></html>`); win.document.close(); }

// ===== Iconos SVG (trazo, heredan el color del texto) =====
const ICONS = {
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 3.5 11.5a8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 9 8.5Z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    all: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'
};
const ico = (name, size) => `<svg class="ico" viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ===== Vista tarjeta / fila (preferencia por pestaña, guardada en este dispositivo) =====
let _viewModes = null;
function _loadViewModes() {
    if (_viewModes) return _viewModes;
    try { _viewModes = JSON.parse(localStorage.getItem(APP_KEY + '_views')) || {}; } catch (e) { _viewModes = {}; }
    return _viewModes;
}
function getViewMode(key, fallback) {
    const mode = _loadViewModes()[key];
    return (mode === 'cards' || mode === 'rows') ? mode : (fallback || 'cards');
}
function setViewMode(key, mode, renderFn) {
    const modes = _loadViewModes();
    modes[key] = mode;
    try { localStorage.setItem(APP_KEY + '_views', JSON.stringify(modes)); } catch (e) { /* almacenamiento no disponible */ }
    if (renderFn && typeof window[renderFn] === 'function') window[renderFn]();
}
// Botonera de dos opciones. renderFn es el nombre de la función que vuelve a dibujar la lista.
function viewToggleHTML(key, renderFn, fallback) {
    const mode = getViewMode(key, fallback);
    return `<div class="view-toggle" role="group" aria-label="Forma de ver la lista">
<button type="button" class="${mode === 'cards' ? 'active' : ''}" aria-pressed="${mode === 'cards'}" onclick="setViewMode('${key}','cards','${renderFn}')">${ico('grid')} Tarjetas</button>
<button type="button" class="${mode === 'rows' ? 'active' : ''}" aria-pressed="${mode === 'rows'}" onclick="setViewMode('${key}','rows','${renderFn}')">${ico('list')} Filas</button>
</div>`;
}
// Selector segmentado genérico: items [{value,label}], al elegir llama a window[fnName](value)
function segToggleHTML(items, active, fnName) {
    return `<div class="view-toggle" role="group">${items.map(it => `<button type="button" class="${it.value === active ? 'active' : ''}" aria-pressed="${it.value === active}" onclick="${fnName}('${it.value}')">${it.label}</button>`).join('')}</div>`;
}
// Texto sin tildes ni mayúsculas, para buscar "muñoz" escribiendo "munoz"
function searchKey(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

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
