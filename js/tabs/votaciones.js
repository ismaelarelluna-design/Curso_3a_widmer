// ===== VOTACIONES: panel admin =====
// Cada votación puede tener 1 o varias preguntas, cada una con sus propias
// alternativas. Estructura: { eventName, date, questions:[{question, options:[]}], ... }

function generateShortId() {
    // Alfabeto sin 0/O/1/l/I para evitar confusiones al escribir el link a mano
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
    return id;
}

// Compatibilidad: normaliza votaciones antiguas (con "question"/"options" sueltos)
// al nuevo formato "questions: [...]" para que nada se rompa si ya creaste alguna.
function normalizeVotacion(v) {
    if (!v.questions || !v.questions.length) {
        v.questions = [{ question: v.question || '', options: v.options || [] }];
    }
    return v;
}

let _editVotacionId = null; // null = creando nueva, string = editando esa votación

async function loadVotaciones() {
    try {
        const snap = await db.collection('votaciones').orderBy('createdAt', 'desc').get();
        votaciones = snap.docs.map(d => normalizeVotacion({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Error al cargar votaciones:', e);
        votaciones = [];
    }
}

const votacionesState = { q: '', from: '', to: '', sort: 'recent' };
function votacionesSetQuery(v) { votacionesState.q = v; renderVotacionesList(); }
function votacionesSetFrom(v) { votacionesState.from = v; renderVotacionesList(); }
function votacionesSetTo(v) { votacionesState.to = v; renderVotacionesList(); }
function votacionesSetSort(v) { votacionesState.sort = v; renderVotacionesList(); }
function votacionesClearFilters() {
    Object.assign(votacionesState, { q: '', from: '', to: '' });
    document.getElementById('votaciones-q').value = '';
    document.getElementById('votaciones-from').value = '';
    document.getElementById('votaciones-to').value = '';
    renderVotacionesList();
}

function renderVotaciones() {
    const banner = document.getElementById('votaciones-banner');
    if (!banner) return;
    const today = todayISO();
    const proximas = votaciones.filter(v => v.date && v.date >= today).length;
    const preguntas = votaciones.reduce((n, v) => n + v.questions.length, 0);
    banner.innerHTML = `
<div class="kpi-banner-title"><h3>🗳️ Votaciones</h3><span class="sub">Comparte el link con el curso y revisa los resultados en tiempo real</span></div>
<div class="kpi brand"><div class="kpi-label">Votaciones creadas</div><div class="kpi-value">${votaciones.length}</div><div class="kpi-foot">en el año</div></div>
<div class="kpi ok"><div class="kpi-label">Próximas</div><div class="kpi-value">${proximas}</div><div class="kpi-foot">fecha de hoy en adelante</div></div>
<div class="kpi info"><div class="kpi-label">Realizadas</div><div class="kpi-value">${votaciones.length - proximas}</div><div class="kpi-foot">fecha ya pasada</div></div>
<div class="kpi warn"><div class="kpi-label">Preguntas</div><div class="kpi-value">${preguntas}</div><div class="kpi-foot">entre todas las votaciones</div></div>`;
    renderVotacionesList();
}

function renderVotacionesList() {
    const list = document.getElementById('votaciones-list');
    if (!list) return;
    const mode = getViewMode('votaciones', 'cards');
    document.getElementById('votaciones-view-toggle').innerHTML = viewToggleHTML('votaciones', 'renderVotacionesList', 'cards');

    if (votaciones.length === 0) {
        list.className = '';
        list.innerHTML = '<div class="empty-state"><p style="font-size:1.1rem;">Aún no hay votaciones creadas.</p></div>';
        document.getElementById('votaciones-count').textContent = '';
        return;
    }
    const st = votacionesState;
    const q = searchKey(st.q);
    let items = votaciones.filter(v => {
        if (st.from && (!v.date || v.date < st.from)) return false;
        if (st.to && (!v.date || v.date > st.to)) return false;
        return !q || searchKey(`${v.eventName} ${v.questions.map(x => x.question).join(' ')}`).includes(q);
    });
    items.sort((a, b) => st.sort === 'oldest' ? (a.date || '').localeCompare(b.date || '') : (st.sort === 'name' ? (a.eventName || '').localeCompare(b.eventName || '', 'es') : (b.date || '').localeCompare(a.date || '')));
    document.getElementById('votaciones-count').textContent = `${items.length} de ${votaciones.length}`;
    document.getElementById('votaciones-clear').hidden = !(st.q || st.from || st.to);

    if (items.length === 0) {
        list.className = '';
        list.innerHTML = '<div class="empty-state">No hay votaciones que coincidan con los filtros.</div>';
        return;
    }
    const actions = v => `<button type="button" class="act act-info" onclick="copyVotacionLink('${v.id}')">${ico('link')} Copiar link</button>
<button type="button" class="act act-solid-brand" onclick="openVotacionResults('${v.id}')">${ico('chart')} Ver resultados</button>
<button type="button" class="act act-warn" onclick="openVotacionModal('${v.id}')">${ico('edit')} Editar</button>
<button type="button" class="act act-danger" onclick="deleteVotacion('${v.id}')">${ico('trash')} Eliminar</button>`;

    if (mode === 'cards') {
        list.className = 'data-grid';
        list.innerHTML = items.map(v => {
            const qCount = v.questions.length;
            const preguntasHTML = v.questions.slice(0, 2).map(q => `<div class="row-sub wrap">• ${escapeHtml(q.question)}</div>`).join('')
                + (qCount > 2 ? `<div class="row-sub">+ ${qCount - 2} pregunta(s) más</div>` : '');
            return `<div class="data-card"><div class="data-card-head"><div class="row-main"><div class="student-name">${escapeHtml(v.eventName)}</div>
<div class="student-detail">📅 ${formatShortDate(v.date)}</div></div><span class="chip info">${qCount} pregunta${qCount === 1 ? '' : 's'}</span></div>
<div>${preguntasHTML}</div><div class="data-card-actions">${actions(v)}</div></div>`;
        }).join('');
    } else {
        list.className = 'data-list';
        list.innerHTML = items.map(v => `<div class="data-row"><div class="row-main"><div class="row-title">${escapeHtml(v.eventName)}</div>
<div class="row-sub">📅 ${formatShortDate(v.date)}</div></div><span class="chip info">${v.questions.length} pregunta${v.questions.length === 1 ? '' : 's'}</span>
<div class="row-actions">${actions(v)}</div></div>`).join('');
    }
}

function copyVotacionLink(id) {
    const link = window.location.origin + window.location.pathname + '?v=' + id;
    document.getElementById('share-link').value = link;
    document.getElementById('modal-share').classList.add('active');
}

// --- Modal de creación ---

function openVotacionModal(editId = null) {
    _editVotacionId = editId;
    const modalTitle = document.querySelector('#modal-votacion h3');
    const saveBtn = document.querySelector('#modal-votacion .btn-primary');
    const existingWarning = document.getElementById('votacion-edit-warning');
    if (existingWarning) existingWarning.remove();
    document.getElementById('votacion-questions-list').innerHTML = '';

    if (editId) {
        const v = votaciones.find(x => x.id === editId);
        if (!v) return;
        if (modalTitle) modalTitle.textContent = 'Editar Votación';
        if (saveBtn) saveBtn.textContent = 'Guardar Cambios';
        document.getElementById('votacion-event').value = v.eventName;
        document.getElementById('votacion-date').value = v.date;
        v.questions.forEach(q => {
            addVotacionQuestionBlock();
            const blocks = document.querySelectorAll('#votacion-questions-list .votacion-question-block');
            const block = blocks[blocks.length - 1];
            block.querySelector('.votacion-question-input').value = q.question;
            const optList = block.querySelector('.votacion-options-list');
            optList.innerHTML = '';
            q.options.forEach(o => {
                addOptionRow(optList);
                const inputs = optList.querySelectorAll('.votacion-option-input');
                inputs[inputs.length - 1].value = o;
            });
        });
        // Si ya hay respuestas registradas, avisamos antes de que edite las alternativas.
        db.collection('votaciones').doc(editId).collection('respuestas').limit(1).get().then(snap => {
            if (!snap.empty && modalTitle) {
                const warn = document.createElement('p');
                warn.id = 'votacion-edit-warning';
                warn.style.cssText = 'background:#fef3c7; color:#92400e; padding:0.7rem 1rem; border-radius:8px; font-size:0.85rem; margin-bottom:1rem;';
                warn.textContent = '⚠️ Esta votación ya tiene respuestas registradas. Si cambias el texto de una pregunta o alternativa, las respuestas ya guardadas quedarán con el texto antiguo.';
                modalTitle.insertAdjacentElement('afterend', warn);
            }
        }).catch(() => {});
    } else {
        if (modalTitle) modalTitle.textContent = 'Nueva Votación';
        if (saveBtn) saveBtn.textContent = 'Crear Votación';
        document.getElementById('votacion-event').value = '';
        document.getElementById('votacion-date').value = new Date().toISOString().split('T')[0];
        addVotacionQuestionBlock(); // por defecto: 1 pregunta
    }
    document.getElementById('modal-votacion').classList.add('active');
}

function addVotacionQuestionBlock() {
    const wrap = document.getElementById('votacion-questions-list');
    const block = document.createElement('div');
    block.className = 'votacion-question-block';
    block.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:1rem; margin-bottom:1rem; background:var(--bg);';
    block.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;"><label style="font-size:0.9rem; color:var(--text-light); font-weight:600;" class="votacion-question-label"></label><button type="button" class="btn btn-sm btn-danger votacion-remove-question" onclick="removeVotacionQuestionBlock(this)">✕ Quitar pregunta</button></div><input type="text" class="votacion-question-input" placeholder="Escribe la pregunta" style="width:100%; padding:0.7rem; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--text); font-size:1rem; margin-bottom:0.7rem;"><div class="votacion-options-list"></div><button type="button" class="btn btn-sm btn-info" onclick="addVotacionOptionField(this)">+ Agregar opción</button>`;
    wrap.appendChild(block);
    const optionsList = block.querySelector('.votacion-options-list');
    addOptionRow(optionsList);
    addOptionRow(optionsList);
    renumberVotacionQuestions();
}

function removeVotacionQuestionBlock(btn) {
    const wrap = document.getElementById('votacion-questions-list');
    if (wrap.children.length <= 1) { alert('La votación necesita al menos 1 pregunta.'); return; }
    btn.closest('.votacion-question-block').remove();
    renumberVotacionQuestions();
}

function renumberVotacionQuestions() {
    const blocks = document.querySelectorAll('#votacion-questions-list .votacion-question-block');
    blocks.forEach((b, idx) => {
        b.querySelector('.votacion-question-label').textContent = `Pregunta ${idx + 1}`;
        b.querySelector('.votacion-remove-question').style.display = blocks.length > 1 ? 'inline-flex' : 'none';
    });
}

// Llamado desde el botón "+ Agregar opción" de cada pregunta
function addVotacionOptionField(btn) {
    addOptionRow(btn.previousElementSibling);
}

function addOptionRow(optionsList) {
    const n = optionsList.children.length + 1;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:0.5rem; margin-bottom:0.5rem;';
    row.innerHTML = `<input type="text" class="votacion-option-input" placeholder="Opción ${n}" style="flex:1; padding:0.7rem; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--text); font-size:1rem;"><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    optionsList.appendChild(row);
}

async function saveVotacion() {
    const eventName = document.getElementById('votacion-event').value.trim();
    const date = document.getElementById('votacion-date').value;
    if (!eventName || !date) return alert('Completa el nombre del evento y la fecha');
    const blocks = document.querySelectorAll('#votacion-questions-list .votacion-question-block');
    const questions = [];
    for (const b of blocks) {
        const question = b.querySelector('.votacion-question-input').value.trim();
        const options = Array.from(b.querySelectorAll('.votacion-option-input')).map(i => i.value.trim()).filter(v => v);
        if (!question) return alert('Completa el texto de todas las preguntas');
        if (options.length < 2) return alert(`Agrega al menos 2 opciones en la pregunta: "${question || '(sin texto)'}"`);
        questions.push({ question, options });
    }
    try {
        if (_editVotacionId) {
            const id = _editVotacionId;
            const existing = votaciones.find(v => v.id === id);
            const votacion = { eventName, date, questions, createdBy: existing ? existing.createdBy : currentUser, createdAt: existing ? existing.createdAt : new Date().toISOString(), updatedBy: currentUser, updatedAt: new Date().toISOString() };
            await db.collection('votaciones').doc(id).set(votacion);
            const idx = votaciones.findIndex(v => v.id === id);
            if (idx !== -1) votaciones[idx] = { id, ...votacion };
            logActivity('EDITAR_VOTACION', `Editó la votación "${eventName}"`);
            closeModal('modal-votacion');
            renderVotaciones();
            alert('Votación actualizada correctamente');
        } else {
            const id = generateShortId();
            const votacion = { eventName, date, questions, createdBy: currentUser, createdAt: new Date().toISOString() };
            await db.collection('votaciones').doc(id).set(votacion);
            votaciones.unshift({ id, ...votacion });
            logActivity('CREAR_VOTACION', `Creó votación "${eventName}" (${questions.length} pregunta${questions.length === 1 ? '' : 's'})`);
            closeModal('modal-votacion');
            renderVotaciones();
            alert('Votación creada correctamente');
        }
    } catch (e) {
        console.error(e);
        alert('No se pudo guardar la votación. Revisa tu conexión e intenta de nuevo.');
    }
    _editVotacionId = null;
}

async function deleteVotacion(id) {
    const v = votaciones.find(x => x.id === id);
    if (!v) return;
    if (!confirm(`¿Eliminar por completo la votación "${v.eventName}"? Se borrarán también todas las respuestas registradas. Esta acción no se puede deshacer.`)) return;
    try {
        const respSnap = await db.collection('votaciones').doc(id).collection('respuestas').get();
        if (!respSnap.empty) {
            const batch = db.batch();
            respSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await db.collection('votaciones').doc(id).delete();
        votaciones = votaciones.filter(x => x.id !== id);
        logActivity('ELIMINAR_VOTACION', `Eliminó la votación "${v.eventName}"`);
        renderVotaciones();
    } catch (e) {
        console.error(e);
        alert('No se pudo eliminar la votación.');
    }
}

// --- Resultados ---

async function openVotacionResults(id) {
    const votacion = votaciones.find(v => v.id === id);
    if (!votacion) return;
    currentVotacionResults = { id, votacion, respuestas: [] };
    document.getElementById('votacion-results-title').textContent = votacion.eventName;
    document.getElementById('votacion-results-event').textContent = votacion.date;
    document.getElementById('votacion-results-body').innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-light);">Cargando respuestas...</p>';
    document.getElementById('modal-votacion-results').classList.add('active');
    try {
        const snap = await db.collection('votaciones').doc(id).collection('respuestas').get();
        currentVotacionResults.respuestas = snap.docs.map(d => {
            const data = d.data();
            // Compatibilidad con respuestas antiguas de una sola pregunta (campo "option")
            if (!data.answers && data.option) {
                data.answers = [{ question: votacion.questions[0].question, option: data.option }];
            }
            return { studentId: d.id, ...data };
        });
    } catch (e) {
        console.error(e);
        currentVotacionResults.respuestas = [];
    }
    renderVotacionResults();
}

function renderVotacionResults() {
    if (!currentVotacionResults) return;
    const { votacion, respuestas } = currentVotacionResults;
    const total = respuestas.length;
    const totalStudents = appData.students ? getActiveStudents().length : 0;

    const questionsHTML = votacion.questions.map((q, qIdx) => {
        const counts = {};
        q.options.forEach(o => counts[o] = 0);
        respuestas.forEach(r => {
            const ans = (r.answers || [])[qIdx];
            if (ans && ans.option !== undefined) counts[ans.option] = (counts[ans.option] || 0) + 1;
        });
        const bars = q.options.map(o => {
            const c = counts[o] || 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return `<div style="margin-bottom:0.7rem;"><div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:0.3rem;"><span>${o}</span><span><strong>${pct}%</strong> (${c} ${c === 1 ? 'alumno' : 'alumnos'})</span></div><div class="progress-container"><div class="progress-bar" style="width:${pct}%"></div></div></div>`;
        }).join('');
        return `<div style="margin-bottom:1.4rem;"><h4 style="font-size:1rem; margin-bottom:0.6rem;">${votacion.questions.length > 1 ? `${qIdx + 1}. ` : ''}${q.question}</h4>${bars}</div>`;
    }).join('');

    const theadCols = votacion.questions.map((q, i) => `<th>${votacion.questions.length > 1 ? `P${i + 1}` : 'Respuesta'}</th>`).join('');
    const tableHTML = respuestas.length === 0
        ? `<tr><td colspan="${votacion.questions.length + 2}" style="text-align:center; padding:1.5rem; color:var(--text-light);">Nadie ha votado todavía</td></tr>`
        : respuestas.slice().sort((a, b) => a.studentName.localeCompare(b.studentName)).map(r => {
            const cols = votacion.questions.map((q, i) => `<td>${(r.answers && r.answers[i]) ? r.answers[i].option : '-'}</td>`).join('');
            return `<tr><td>${r.studentName}</td>${cols}<td><button class="btn btn-sm btn-danger" onclick="deleteVotacionRespuesta('${r.studentId}')">Eliminar</button></td></tr>`;
        }).join('');

    document.getElementById('votacion-results-body').innerHTML = `
<div style="margin-bottom:1.2rem; font-size:0.9rem; color:var(--text-light);">${total} de ${totalStudents} alumnos han respondido</div>
${questionsHTML}
<div style="overflow-x:auto;"><table style="margin-top:0.5rem;"><thead><tr><th>Alumno</th>${theadCols}<th>Acciones</th></tr></thead><tbody>${tableHTML}</tbody></table></div>`;
}

async function deleteVotacionRespuesta(studentId) {
    if (!currentVotacionResults) return;
    if (!confirm('¿Eliminar TODAS las respuestas de este alumno en esta votación? Podrá volver a votar si se le reenvía el link.')) return;
    try {
        await db.collection('votaciones').doc(currentVotacionResults.id).collection('respuestas').doc(String(studentId)).delete();
        currentVotacionResults.respuestas = currentVotacionResults.respuestas.filter(r => String(r.studentId) !== String(studentId));
        logActivity('ELIMINAR_VOTO', `Eliminó un voto en la votación "${currentVotacionResults.votacion.eventName}"`);
        renderVotacionResults();
    } catch (e) {
        console.error(e);
        alert('No se pudo eliminar el voto.');
    }
}

function exportVotacionCSV() {
    if (!currentVotacionResults) return;
    const { votacion, respuestas } = currentVotacionResults;
    if (respuestas.length === 0) return alert('Todavía no hay respuestas para exportar.');
    const filename = `Votacion_${votacion.eventName.replace(/[^a-zA-Z0-9]+/g, '_')}.csv`;
    const headers = ['Alumno', ...votacion.questions.map(q => q.question)];
    let csv = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
    respuestas.slice().sort((a, b) => a.studentName.localeCompare(b.studentName)).forEach(r => {
        const row = [r.studentName, ...votacion.questions.map((q, i) => (r.answers && r.answers[i]) ? r.answers[i].option : '')];
        csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    // \ufeff (BOM) para que Excel reconozca tildes/ñ correctamente al abrir el CSV.
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + csv);
    // Mismo criterio que el fix de los PDF: en PWA instalada la descarga
    // automática por blob/href se puede bloquear, así que abrimos la pestaña
    // ya (dentro del clic) y la llenamos después.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
        const win = window.open('', '_blank');
        if (win) {
            win.location.href = dataUri;
        } else {
            const link = document.createElement('a');
            link.href = dataUri; link.download = filename;
            document.body.appendChild(link); link.click(); link.remove();
        }
    } else {
        const link = document.createElement('a');
        link.href = dataUri; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
    }
    logActivity('EXPORTAR_VOTACION', `Exportó CSV de la votación "${votacion.eventName}"`);
}

// ===== VOTACIONES: página pública (link compartido) =====

async function initPublicVote(votId) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('public-vote-screen').style.display = 'flex';
    const content = document.getElementById('public-vote-content');
    content.innerHTML = '<p style="text-align:center; color:var(--text-light);">Cargando votación...</p>';
    try {
        const docSnap = await db.collection('votaciones').doc(votId).get();
        if (!docSnap.exists) {
            content.innerHTML = '<p style="text-align:center; color:var(--danger);">Esta votación no existe o el link es incorrecto.</p>';
            return;
        }
        const votacion = normalizeVotacion({ id: votId, ...docSnap.data() });
        const appDocSnap = await db.collection('app_data').doc('curso3a').get();
        const students = appDocSnap.exists ? (appDocSnap.data().students || []) : [];
        renderPublicVoteForm(votacion, students);
    } catch (e) {
        console.error(e);
        content.innerHTML = '<p style="text-align:center; color:var(--danger);">Error al cargar la votación. Intenta más tarde.</p>';
    }
}

function renderPublicVoteForm(votacion, students) {
    const content = document.getElementById('public-vote-content');
    const sortedStudents = students.filter(s => !s.withdrawn).sort((a, b) => `${a.last} ${a.first}`.localeCompare(`${b.last} ${b.first}`));
    const questionsHTML = votacion.questions.map((q, qIdx) => {
        const optionsHTML = q.options.map(o => `<label style="display:flex; align-items:center; gap:0.6rem; padding:0.8rem; border:2px solid var(--border); border-radius:8px; margin-bottom:0.6rem; cursor:pointer;"><input type="radio" name="pv-option-${qIdx}" value="${o.replace(/"/g, '&quot;')}" style="accent-color:var(--primary); width:18px; height:18px;">${o}</label>`).join('');
        return `<div style="margin-bottom:1.4rem;"><p style="font-weight:600; margin-bottom:0.7rem; color:var(--text);">${votacion.questions.length > 1 ? `${qIdx + 1}. ` : ''}${q.question}</p>${optionsHTML}</div>`;
    }).join('');
    content.innerHTML = `
<h2 style="text-align:center; margin-bottom:1.3rem; font-size:1.3rem; color:var(--text);">${votacion.eventName}</h2>
<div class="input-group"><label>Selecciona tu nombre</label><select id="pv-student"><option value="">-- Elige tu nombre --</option>${sortedStudents.map(s => `<option value="${s.id}">${s.last} ${s.first}</option>`).join('')}</select></div>
<div style="margin:1.2rem 0;">${questionsHTML}</div>
<button class="btn btn-primary" id="pv-submit-btn" style="width:100%;">Enviar mi voto</button>
<p id="pv-status-msg" style="text-align:center; margin-top:1rem; font-size:0.9rem;"></p>`;
    document.getElementById('pv-submit-btn').onclick = () => submitPublicVote(votacion, students);
}

async function submitPublicVote(votacion, students) {
    const sid = document.getElementById('pv-student').value;
    const msg = document.getElementById('pv-status-msg');
    if (!sid) { msg.style.color = 'var(--danger)'; msg.textContent = 'Selecciona tu nombre.'; return; }
    const answers = [];
    for (let i = 0; i < votacion.questions.length; i++) {
        const checked = document.querySelector(`input[name="pv-option-${i}"]:checked`);
        if (!checked) {
            msg.style.color = 'var(--danger)';
            msg.textContent = `Falta responder la pregunta: "${votacion.questions[i].question}"`;
            return;
        }
        answers.push({ question: votacion.questions[i].question, option: checked.value });
    }
    const student = students.find(s => String(s.id) === String(sid));
    const btn = document.getElementById('pv-submit-btn');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
        const respRef = db.collection('votaciones').doc(votacion.id).collection('respuestas').doc(String(sid));
        const existing = await respRef.get();
        if (existing.exists) {
            msg.style.color = 'var(--danger)';
            msg.textContent = `${student.last} ${student.first} ya registró su voto en esta votación. Si necesitas corregirlo, pide que un apoderado a cargo lo elimine desde la app.`;
            btn.disabled = false; btn.textContent = 'Enviar mi voto';
            return;
        }
        await respRef.set({ studentId: sid, studentName: `${student.last} ${student.first}`, answers, ts: new Date().toISOString() });
        document.getElementById('public-vote-content').innerHTML = `<div style="text-align:center; padding:1rem 0;"><p style="font-size:2.2rem; margin-bottom:0.5rem;">✅</p><h3 style="margin-bottom:0.5rem; color:var(--text);">¡Voto registrado!</h3><p style="color:var(--text-light);">Gracias, ${student.last} ${student.first}. Tu respuesta fue guardada.</p></div>`;
    } catch (e) {
        console.error(e);
        msg.style.color = 'var(--danger)';
        msg.textContent = 'Hubo un error al enviar tu voto. Intenta nuevamente.';
        btn.disabled = false; btn.textContent = 'Enviar mi voto';
    }
}
