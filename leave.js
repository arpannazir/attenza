/**
 * ATTENZA — Leave
 *
 * Lets an employee apply for leave (goes to their branch admin as
 * "Pending"), and shows the status of every leave application they've
 * ever filed, refreshed automatically so an admin's decision shows up
 * without a manual reload.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwpuED8aHh5bs_ljk9tFDTITHUmmkCS6HGn3uhE7xvYUqjFDTLMI_H5bMOTiis_8QJY/exec';
const $ = id => document.getElementById(id);

function showToast(message, success = false) {
    const t = $('toast');
    t.textContent = message;
    t.className = `toast show${success ? ' success' : ''}`;
    setTimeout(() => t.className = 'toast', 3500);
}

$('today').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase();

/* ── Auth guard ── */
let record = null;
try {
    const raw = sessionStorage.getItem('attenza_signin');
    record = raw ? JSON.parse(raw) : null;
} catch (_) { record = null; }

if (!record || !record.employee) {
    window.location.href = 'index.html';
}

const isAdmin = record && String(record.role || '').trim().toLowerCase() === 'admin';
if (isAdmin && $('adminLink')) $('adminLink').hidden = false;
if ($('adminLink')) $('adminLink').addEventListener('click', () => { window.location.href = 'admin.html'; });

const firstName = record ? String(record.employee).trim().split(' ')[0] : '';
$('leaveTitle').innerHTML = `Apply for leave,<br><em style="color:var(--coral);font-style:normal">${firstName}</em>.`;

$('signOut').addEventListener('click', async () => {
    const btn = $('signOut');
    if (btn) btn.disabled = true;
    if (typeof SoundFx !== 'undefined') SoundFx.playSignOut();
    const overlay = $('signoutOverlay');
    if (overlay) overlay.classList.add('active');

    const minDelay = new Promise(resolve => setTimeout(resolve, 850));

    if (record && record.employee) {
        try {
            await Promise.all([
                fetch(API_URL, {
                    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'signOut', employee: record.employee, branch: record.branch })
                }),
                minDelay
            ]);
        } catch (_) {
            await minDelay;
        }
    } else {
        await minDelay;
    }
    try { sessionStorage.removeItem('attenza_signin'); } catch (_) { /* ignore */ }
    window.location.href = 'index.html';
});

/* ── Date helpers ── */
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// From/To Date should always arrive as a plain "yyyy-MM-dd" string, but this
// stays defensive against a stray full ISO timestamp (e.g. from an older
// row) by simply keeping the first 10 characters.
function toDateOnly(value) {
    if (!value) return '';
    const m = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
}
// "dd MMM, yyyy" — e.g. "21 Aug, 2026". Leave dates are whole calendar
// days with no meaningful time component, so no hh:mm:ss is shown here.
function fmtDate(value) {
    const dateOnly = toDateOnly(value);
    if (!dateOnly) return '—';
    const d = new Date(dateOnly + 'T00:00:00');
    if (isNaN(d.getTime())) return String(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d);
    return `${day} ${month}, ${d.getFullYear()}`;
}
function daysBetween(fromStr, toStr) {
    const fromOnly = toDateOnly(fromStr), toOnly = toDateOnly(toStr);
    if (!fromOnly || !toOnly) return 0;
    const a = new Date(fromOnly + 'T00:00:00'), b = new Date(toOnly + 'T00:00:00');
    const diff = Math.round((b - a) / 86400000) + 1;
    return diff > 0 ? diff : 0;
}

$('leaveFrom').min = todayStr();
$('leaveTo').min = todayStr();
$('leaveFrom').addEventListener('change', () => {
    if ($('leaveTo').value && $('leaveTo').value < $('leaveFrom').value) $('leaveTo').value = $('leaveFrom').value;
    $('leaveTo').min = $('leaveFrom').value || todayStr();
    updateDaysNote();
});
$('leaveTo').addEventListener('change', updateDaysNote);

function updateDaysNote() {
    const from = $('leaveFrom').value, to = $('leaveTo').value;
    const note = $('leaveDaysNote');
    if (from && to) {
        const n = daysBetween(from, to);
        note.textContent = n > 0 ? `${n} day${n === 1 ? '' : 's'} of leave` : 'Select a valid date range.';
    } else {
        note.textContent = '\u00a0';
    }
}

/* ── Status chip + whole-row colouring ── */
function statusChip(status) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'approved') return { cls: 'chip-approved', text: 'APPROVED', row: 'row-approved' };
    if (s === 'rejected') return { cls: 'chip-rejected', text: 'REJECTED', row: 'row-rejected' };
    return { cls: 'chip-pending', text: 'PENDING', row: 'row-pending' };
}

/* ── Render list ── */
function renderLeaveList(requests) {
    const el = $('leaveList');
    if (!requests.length) {
        el.innerHTML = `<p class="leave-empty">You haven't applied for any leave yet.</p>`;
        $('leaveSub').textContent = 'No leave applications on record.';
        return;
    }

    const pending = requests.filter(r => String(r.status).trim().toLowerCase() === 'pending').length;
    $('leaveSub').textContent = pending
        ? `${requests.length} application${requests.length === 1 ? '' : 's'} on record · ${pending} waiting on your admin.`
        : `${requests.length} application${requests.length === 1 ? '' : 's'} on record.`;

    el.innerHTML = requests.map(r => {
        const chip = statusChip(r.status);
        const n = daysBetween(r.fromDate, r.toDate);
        const reviewNote = r.status !== 'Pending' && r.reviewedBy
            ? ` · ${r.status === 'Approved' ? 'Approved' : 'Declined'} by ${r.reviewedBy}`
            : '';
        return `
            <div class="leave-row ${chip.row}">
                <div>
                    <span class="leave-row-main">${fmtDate(r.fromDate)} — ${fmtDate(r.toDate)}</span>
                    <span class="leave-row-sub">${n} day${n === 1 ? '' : 's'} · ${r.leaveType || 'Leave'}${reviewNote}</span>
                    ${r.reason ? `<span class="leave-row-reason">${r.reason}</span>` : ''}
                </div>
                <span class="leave-status-chip ${chip.cls}">${chip.text}</span>
            </div>`;
    }).join('');
}

/* ── Fetch ── */
async function loadMyLeaves() {
    try {
        const r = await fetch(`${API_URL}?action=getMyLeaveRequests&employee=${encodeURIComponent(record.employee)}`);
        const result = await r.json();
        if (result && result.ok) renderLeaveList(result.requests || []);
    } catch (_) { /* keep showing the last known list until the next poll succeeds */ }
}

/* ── Submit ── */
let submitting = false;
$('submitLeave').addEventListener('click', async () => {
    if (submitting) return;
    const from = $('leaveFrom').value, to = $('leaveTo').value;
    const leaveType = $('leaveType').value;
    const reason = $('leaveReason').value.trim();
    const statusEl = $('leaveSubmitStatus');

    if (!from || !to) {
        statusEl.className = 'leave-submit-status error';
        statusEl.textContent = 'Pick both a from and to date.';
        return;
    }
    if (to < from) {
        statusEl.className = 'leave-submit-status error';
        statusEl.textContent = 'The to-date can\u2019t be before the from-date.';
        return;
    }
    if (!reason) {
        statusEl.className = 'leave-submit-status error';
        statusEl.textContent = 'Add a short reason for your admin.';
        return;
    }

    submitting = true;
    $('submitLeave').disabled = true;
    statusEl.className = 'leave-submit-status';
    statusEl.textContent = 'Sending…';

    try {
        const r = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'applyLeave',
                employee: record.employee,
                branch: record.branch,
                fromDate: from,
                toDate: to,
                leaveType: leaveType,
                reason: reason
            })
        });
        const result = await r.json();
        if (result && result.ok) {
            if (typeof SoundFx !== 'undefined') SoundFx.playNotification();
            statusEl.className = 'leave-submit-status success';
            statusEl.textContent = 'Sent to your admin for approval.';
            showToast('Leave application sent for approval.', true);
            $('leaveReason').value = '';
            $('leaveFrom').value = '';
            $('leaveTo').value = '';
            updateDaysNote();
            loadMyLeaves();
        } else {
            statusEl.className = 'leave-submit-status error';
            statusEl.textContent = (result && result.message) || 'Could not submit your application.';
        }
    } catch (_) {
        statusEl.className = 'leave-submit-status error';
        statusEl.textContent = 'Could not reach the server. Try again.';
    } finally {
        submitting = false;
        $('submitLeave').disabled = false;
    }
});

/* ── Boot ── */
loadMyLeaves();
setInterval(loadMyLeaves, 8000); // pick up admin decisions without a manual reload