function renderMorosidad() { const list = document.getElementById('morosidad-list'); const cuotaMensual = appData.config.cuotaAmount || 5000; const currentMonthIdx = getCurrentMonthIndex(); const monthsToCheck = ALL_MONTHS.slice(0, currentMonthIdx + 1); const studentsWithDebt = appData.students.filter(s => { if (s.exemptYear) return false; const unpaidMonths = monthsToCheck.filter(m => { const cuota = appData.cuotas.find(c => c.month === `2026-${m}`); return cuota && !cuota.paidStudents.includes(s.id); }); const unpaidExtras = appData.ingresos.filter(ing => { if (ing.type !== 'cuota') return false; const studentRecord = ing.students.find(st => st.id === s.id); return !studentRecord || (!studentRecord.paid && !studentRecord.exempt); }); return unpaidMonths.length > 0 || unpaidExtras.length > 0; }); if (studentsWithDebt.length === 0) { list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-light);"><p style="font-size:1.1rem;">¡Excelente! No hay morosidad en el curso.</p></div>'; return; } list.innerHTML = studentsWithDebt.map(s => { const unpaidMonths = monthsToCheck.filter(m => { const cuota = appData.cuotas.find(c => c.month === `2026-${m}`); return cuota && !cuota.paidStudents.includes(s.id); }); const unpaidExtras = appData.ingresos.filter(ing => { if (ing.type !== 'cuota') return false; const studentRecord = ing.students.find(st => st.id === s.id); return !studentRecord || (!studentRecord.paid && !studentRecord.exempt); }); const totalDebt = (unpaidMonths.length * cuotaMensual) + unpaidExtras.reduce((sum, e) => sum + (e.amountPer || 0), 0); const monthCount = unpaidMonths.length + unpaidExtras.length; return `<div class="morosidad-card-slim" id="morosidad-card-${s.id}"><div class="morosidad-header-slim"><div class="morosidad-student-slim"><div class="student-num">${s.id}</div><div class="student-name">${s.last} ${s.first}</div><div class="student-detail">${s.guard || 'Sin apoderado'}</div></div><div class="morosidad-debt-slim"><div class="amount">${formatCLP(totalDebt)}</div><div class="label">Total deuda</div></div></div><div class="morosidad-summary-slim"><span class="months">${monthCount} períodos impagos</span><span class="count">${monthCount}</span></div><div class="morosidad-actions-slim"><button class="btn btn-success" onclick="shareWhatsApp(${s.id}, ${totalDebt})">💬 WhatsApp</button><button class="btn btn-primary" onclick="showDebtVoucher(${s.id})">📄 Ver</button></div></div>`; }).join(''); }
function shareWhatsApp(studentId, totalDebt) { const student = appData.students.find(s => s.id === studentId); if (!student) return; const cuotaMensual = appData.config.cuotaAmount || 5000; const currentMonthIdx = getCurrentMonthIndex(); const monthsToCheck = ALL_MONTHS.slice(0, currentMonthIdx + 1); const unpaidMonths = monthsToCheck.filter(m => { const cuota = appData.cuotas.find(c => c.month === `2026-${m}`); return cuota && !cuota.paidStudents.includes(studentId); }); const unpaidExtras = appData.ingresos.filter(ing => { if (ing.type !== 'cuota') return false; const studentRecord = ing.students.find(st => st.id === studentId); return !studentRecord || (!studentRecord.paid && !studentRecord.exempt); }); let message = `*ESTADO DE CUENTA - CURSO 3A*\n\n`; message += `*Alumno:* ${student.last} ${student.first}\n`; message += `*Apoderado:* ${student.guard || 'N/A'}\n\n`; message += `*DEUDA PENDIENTE: ${formatCLP(totalDebt)}*\n\n`; if (unpaidMonths.length > 0) { message += `*Mensualidades impagas:*\n`; unpaidMonths.forEach(m => { message += `• ${MONTH_NAMES[m]} 2026: ${formatCLP(cuotaMensual)}\n`; }); message += '\n'; } if (unpaidExtras.length > 0) { message += `*Eventos impagos:*\n`; unpaidExtras.forEach(e => { message += `• ${e.concept}: ${formatCLP(e.amountPer || 0)}\n`; }); message += '\n'; } message += `*Datos de pago:*\nBanco: Tenpo\nCuenta: 111113268423\nRUT: 13.268.423-5\n\n`; message += `Por favor regularizar a la brevedad. ¡Gracias!`; const phone = student.phone ? student.phone.replace(/[^0-9]/g, '') : ''; const url = phone ? `https://wa.me/56${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(url, '_blank'); logActivity('WHATSAPP_MOROSIDAD', `Envió recordatorio WhatsApp a ${student.last} ${student.first}`); }
function showDebtVoucher(studentId) { const student = appData.students.find(s => s.id === studentId); if (!student) return; const cuotaMensual = appData.config.cuotaAmount || 5000; const currentMonthIdx = getCurrentMonthIndex(); const monthsToCheck = ALL_MONTHS.slice(0, currentMonthIdx + 1); const unpaidMonths = monthsToCheck.filter(m => { const cuota = appData.cuotas.find(c => c.month === `2026-${m}`); return cuota && !cuota.paidStudents.includes(studentId); }); const unpaidExtras = appData.ingresos.filter(ing => { if (ing.type !== 'cuota') return false; const studentRecord = ing.students.find(st => st.id === studentId); return !studentRecord || (!studentRecord.paid && !studentRecord.exempt); }); const totalDebt = (unpaidMonths.length * cuotaMensual) + unpaidExtras.reduce((sum, e) => sum + (e.amountPer || 0), 0); const today = new Date(); const todayStr = today.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }); currentVoucherData = { student, totalDebt, unpaidMonths, unpaidExtras, cuotaMensual, today: todayStr }; let rowsHTML = ''; if(unpaidMonths.length === 0 && unpaidExtras.length === 0) { rowsHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No presenta deudas pendientes al momento de emitir este documento.</td></tr>'; } else { unpaidMonths.forEach(m => { rowsHTML += `<tr><td>Cuota ${MONTH_NAMES[m]} 2026</td><td>-</td><td class="amount-col">${formatCLP(cuotaMensual)}</td><td class="amount-col">$ 0</td><td class="amount-col">$ 0</td><td class="amount-col">${formatCLP(cuotaMensual)}</td></tr>`; }); unpaidExtras.forEach(e => { rowsHTML += `<tr><td>${e.concept}</td><td>-</td><td class="amount-col">${formatCLP(e.amountPer || 0)}</td><td class="amount-col">$ 0</td><td class="amount-col">$ 0</td><td class="amount-col">${formatCLP(e.amountPer || 0)}</td></tr>`; }); rowsHTML += `<tr class="total-row"><td colspan="2">TOTAL DEUDA</td><td class="amount-col" colspan="4" style="font-size:1.3rem;">${formatCLP(totalDebt)}</td></tr>`; } const voucherHTML = `<div class="voucher-header-prof"><div class="voucher-logo-area"><img src="widmer_logo.png" alt="Logo"><div class="voucher-title-area"><h1>ESTADO DE CUENTA</h1><p>Curso 3A · Colegio Alberto Widmer</p></div></div><div style="text-align:right;"><div style="font-size:0.8rem; opacity:0.9;">Fecha de Emisión</div><div style="font-weight:700; font-size:1rem;">${todayStr}</div></div></div><div class="voucher-alert-banner">ESTADO DE CUENTA DEL ALUMNO</div><div class="voucher-body-prof"><div class="voucher-recipient"><h3>Sr(a):</h3><div class="name">${student.last} ${student.first}</div><div class="unit">Unidad: Curso 3A</div></div><div class="voucher-legal-text"><strong>Presente.-</strong><br><br>Por medio del presente documento se informa el estado de cuenta del alumno hasta el momento de la generación de este informe. Se solicita regularizar las obligaciones pendientes a la brevedad para evitar inconvenientes mayores.<br><br>Este documento es emitido por la tesorería del Curso 3A del Colegio Alberto Widmer.</div><div style="margin-bottom:15px; font-size:0.9rem; color:#475569;">Su deuda actual asciende a: <strong style="font-size:1.2rem; color:#dc2626;">${formatCLP(totalDebt)}</strong>.- (Según detalle adjunto)</div><table class="voucher-debt-table"><thead><tr><th>Concepto</th><th>Vencimiento</th><th>Monto</th><th>Intereses</th><th>Pagado</th><th>Saldo</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="voucher-payment-section"><h4>DATOS PARA TRANSFERENCIA</h4><div class="voucher-payment-details"><div class="voucher-payment-item"><label>Titular</label><div class="val">ANGELICA LUCIA MOFRE RETAMAL</div></div><div class="voucher-payment-item"><label>RUT</label><div class="val">13.268.423-5</div></div><div class="voucher-payment-item"><label>Banco</label><div class="val">Banco Prepago Tenpo</div></div><div class="voucher-payment-item"><label>Tipo Cuenta</label><div class="val">Cuenta Vista</div></div><div class="voucher-payment-item"><label>N° Cuenta</label><div class="val">111113268423</div></div><div class="voucher-payment-item"><label>Email</label><div class="val">anlumore@gmail.com</div></div></div></div><div class="voucher-footer-prof"><p>Documento generado electrónicamente por el sistema de gestión del Curso 3A.</p><p class="date">Emitido el ${todayStr}</p></div></div>`; document.getElementById('voucher-preview').innerHTML = voucherHTML; document.getElementById('modal-debt-voucher').classList.add('active'); }
function sendWhatsAppFromModal() { if(!currentVoucherData) return; shareWhatsApp(currentVoucherData.student.id, currentVoucherData.totalDebt); closeModal('modal-debt-voucher'); }
function downloadVoucherPDF() {
    if(!currentVoucherData) return;
    const source = document.getElementById('voucher-preview');
    const student = currentVoucherData.student;
    const filename = `Estado_Cuenta_${student.last}_${student.first}_2026.pdf`;

    // En PWA instalada (modo standalone) iOS/Android bloquean la descarga
    // automática por blob que usa html2pdf().save(). Por eso, si detectamos
    // ese modo, abrimos una pestaña vacía AHORA MISMO (dentro del clic, para
    // que no la bloquee el navegador) y luego la llenamos con el PDF ya
    // generado, para que el usuario lo guarde desde el visor nativo.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    let pdfWindow = null;
    if (isStandalone) {
        pdfWindow = window.open('', '_blank');
        if (pdfWindow) {
            pdfWindow.document.write('<title>Generando PDF...</title><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#334155;">Generando PDF, un momento...</body>');
        }
    }

    const clone = source.cloneNode(true);
    clone.style.width = '650px';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    if (location.protocol === 'file:') {
        clone.querySelectorAll('img').forEach(img => {
            const ph = document.createElement('div');
            ph.style.cssText = 'width:50px;height:50px;border-radius:8px;background:#1e1b4b;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;flex-shrink:0;';
            ph.textContent = '3A';
            img.replaceWith(ph);
        });
    }
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
    document.body.appendChild(holder);
    holder.appendChild(clone);
    const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    if (isStandalone) {
        html2pdf().set(opt).from(clone).outputPdf('datauristring').then(dataUri => {
            if (pdfWindow) {
                pdfWindow.location.href = dataUri;
            } else {
                const link = document.createElement('a');
                link.href = dataUri;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            logActivity('DESCARGAR_PDF_VOUCHER', `Descargó PDF de ${student.last} ${student.first}`);
        }).catch(err => {
            console.error(err);
            if (pdfWindow) pdfWindow.close();
            alert('Hubo un error al generar el PDF.');
        }).finally(() => {
            holder.remove();
        });
    } else {
        html2pdf().set(opt).from(clone).save().then(() => {
            logActivity('DESCARGAR_PDF_VOUCHER', `Descargó PDF de ${student.last} ${student.first}`);
        }).catch(err => {
            console.error(err);
            alert('Hubo un error al generar el PDF.');
        }).finally(() => {
            holder.remove();
        });
    }
}
