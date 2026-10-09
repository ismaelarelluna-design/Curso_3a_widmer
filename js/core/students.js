// ===== Alumnos: reglas compartidas =====
// Un alumno tiene tres estados que NO se mezclan:
//   - participa   : cuenta en cuotas, eventos y morosidad (estado normal)
//   - no participa: campo `exemptYear` (antes "Eximir año"). Sigue en el curso, pero no paga ni
//                   se le cobra. Se conserva su historial.
//   - retirado    : campo `withdrawn`. Se fue del curso. Sale de listas y cálculos desde ahora,
//                   pero su historial de pagos queda intacto para que los totales pasados no cambien.

const isActiveStudent = s => !!s && !s.withdrawn;                       // sigue en el curso
const isPayingStudent = s => isActiveStudent(s) && !s.exemptYear;       // participa y debe pagar
const getActiveStudents = () => (appData.students || []).filter(isActiveStudent);
const getPayingStudents = () => (appData.students || []).filter(isPayingStudent);
const studentFullName = s => `${s.last} ${s.first}`.trim();

// Cuántos alumnos de la lista de pagados siguen siendo "pagadores" hoy.
// (Un retirado que pagó en abril sigue sumando plata, pero ya no cuenta como alumno al día.)
function countPaidAmongPaying(paidIds) {
    const paying = new Set(getPayingStudents().map(s => s.id));
    return (paidIds || []).filter(id => paying.has(id)).length;
}

// Deuda de un alumno: meses de cuota impagos hasta el mes actual + eventos "por alumno" sin pagar.
// Misma regla que ya usaba Morosidad; ahora es la única fuente de verdad.
function getStudentDebt(studentId) {
    const cuotaMensual = appData.config.cuotaAmount || 5000;
    const monthsToCheck = ALL_MONTHS.slice(0, getCurrentMonthIndex() + 1);
    const unpaidMonths = monthsToCheck.filter(m => {
        const cuota = appData.cuotas.find(c => c.month === `2026-${m}`);
        return cuota && !cuota.paidStudents.includes(studentId);
    });
    const paidMonths = monthsToCheck.filter(m => {
        const cuota = appData.cuotas.find(c => c.month === `2026-${m}`);
        return cuota && cuota.paidStudents.includes(studentId);
    });
    const unpaidExtras = appData.ingresos.filter(ing => {
        if (ing.type !== 'cuota') return false;
        const rec = (ing.students || []).find(st => st.id === studentId);
        return !rec || (!rec.paid && !rec.exempt);
    });
    const paidExtras = appData.ingresos.filter(ing => {
        if (ing.type !== 'cuota') return false;
        const rec = (ing.students || []).find(st => st.id === studentId);
        return rec && (rec.paid || rec.exempt);
    });
    const totalDebt = (unpaidMonths.length * cuotaMensual) + unpaidExtras.reduce((sum, e) => sum + (e.amountPer || 0), 0);
    // Meses que aún no vencen (después del actual, hasta diciembre) y siguen sin pagar:
    // sirven para calcular el "pago completo del año", distinto de solo "ponerse al día".
    const futureMonths = ALL_MONTHS.slice(getCurrentMonthIndex() + 1).filter(m => {
        const cuota = appData.cuotas.find(c => c.month === `2026-${m}`);
        return cuota && !cuota.paidStudents.includes(studentId);
    });
    const yearDebt = totalDebt + futureMonths.length * cuotaMensual;
    const periods = unpaidMonths.length + unpaidExtras.length;
    return { unpaidMonths, paidMonths, unpaidExtras, paidExtras, cuotaMensual, totalDebt, periods, futureMonths, yearDebt, yearPeriods: periods + futureMonths.length };
}

// Estado de un alumno dentro de un evento "por alumno": 'paid' | 'exempt' | null (pendiente)
function getEventStudentState(ingreso, studentId) {
    const rec = (ingreso.students || []).find(st => st.id === studentId);
    if (!rec) return null;
    if (rec.exempt) return 'exempt';
    return rec.paid ? 'paid' : null;
}

// Resumen de un evento por alumno. Los pendientes solo cuentan a quienes hoy deben pagar.
function getEventStats(ingreso) {
    if (ingreso.type !== 'cuota') return { paid: 0, exempt: 0, pending: 0, total: 0, complete: true, toCollect: 0 };
    const records = ingreso.students || [];
    const paid = records.filter(r => r.paid && !r.exempt).length;
    const exempt = records.filter(r => r.exempt).length;
    const pending = getPayingStudents().filter(s => !getEventStudentState(ingreso, s.id)).length;
    return { paid, exempt, pending, total: paid + exempt + pending, complete: pending === 0, toCollect: pending * (ingreso.amountPer || 0) };
}
