const API_URL = 'https://script.google.com/macros/s/AKfycbwpuED8aHh5bs_ljk9tFDTITHUmmkCS6HGn3uhE7xvYUqjFDTLMI_H5bMOTiis_8QJY/exec';
const $ = id => document.getElementById(id);

function showToast(message, success = false) {
    const t = $('toast');
    t.textContent = message;
    t.className = `toast show${success ? ' success' : ''}`;
    setTimeout(() => t.className = 'toast', 3500);
}

$('today').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase();

let record = null;
try {
    const raw = sessionStorage.getItem('attenza_signin');
    record = raw ? JSON.parse(raw) : null;
} catch (_) { record = null; }

// Admin panel is admin-only — anyone who lands here without an Admin
// session (e.g. by typing the URL directly) is sent back to the home screen.
const isAdmin = record && String(record.role || '').trim().toLowerCase() === 'admin';
if (!isAdmin) {
    window.location.href = 'home.html';
}

let busyRequestId = null;
let busyLeaveId = null;
let pollTimer = null;
let leavePollTimer = null;

function renderRequests(requests) {
    $('requestCountText').textContent = requests.length
        ? `${requests.length} request${requests.length === 1 ? '' : 's'} waiting for your decision.`
        : 'No pending requests right now.';

    if (!requests.length) {
        $('requestList').innerHTML = `
            <div class="activity-row">
                <div>
                    <span class="a-main">All caught up</span>
                    <span class="a-sub">No branch sign-in requests are waiting for approval.</span>
                </div>
                <span class="a-time">—</span>
            </div>`;
        return;
    }

    $('requestList').innerHTML = requests.map(req => `
        <div class="activity-row request-row">
            <div>
                <span class="a-main">${req.employee}</span>
                <span class="a-sub">Wants to sign in at <strong>${req.requestedBranch}</strong> instead of ${req.assignedBranch || 'their assigned branch'} · ${req.distanceMeters}m away${req.accuracyMeters ? ` · GPS ±${Math.round(req.accuracyMeters)}m` : ''}</span>
            </div>
            <div class="request-actions">
                <button class="reject-btn" type="button" data-id="${req.requestId}" data-decision="Reject" ${busyRequestId === req.requestId ? 'disabled' : ''}>DECLINE</button>
                <button class="approve-btn" type="button" data-id="${req.requestId}" data-decision="Approve" ${busyRequestId === req.requestId ? 'disabled' : ''}>APPROVE</button>
            </div>
        </div>`).join('');

    document.querySelectorAll('.approve-btn, .reject-btn').forEach(btn => {
        btn.addEventListener('click', () => reviewRequest(btn.dataset.id, btn.dataset.decision));
    });
}

async function loadRequests() {
    try {
        const r = await fetch(`${API_URL}?action=getPendingRequests`);
        const result = await r.json();
        if (result && result.ok) renderRequests(result.requests || []);
    } catch (_) {/* keep showing the last known list until the next poll succeeds */ }
}

async function reviewRequest(requestId, decision) {
    busyRequestId = requestId;
    try {
        const r = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'reviewRequest', requestId, decision, reviewer: record.employee })
        });
        const result = await r.json();
        if (result && result.ok) {
            showToast(decision === 'Approve' ? 'Approved — the employee has been signed in.' : 'Request declined.', decision === 'Approve');
        } else {
            showToast((result && result.message) || 'Could not update the request.');
        }
    } catch (_) {
        showToast('Could not reach the server. Try again.');
    } finally {
        busyRequestId = null;
        loadRequests();
    }
}

/* ── Leave requests — scoped to this admin's own branch ── */
// From/To Date should always arrive as a plain "yyyy-MM-dd" string, but
// this stays defensive against a stray full ISO timestamp (e.g. from an
// older row) by simply keeping the first 10 characters.
function toDateOnly(value) {
    if (!value) return '';
    const m = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
}
// "dd MMM, yyyy" — e.g. "21 Aug, 2026". Leave dates are whole calendar
// days with no meaningful time component, so no hh:mm:ss is shown here.
function fmtLeaveDate(value) {
    const dateOnly = toDateOnly(value);
    if (!dateOnly) return '—';
    const d = new Date(dateOnly + 'T00:00:00');
    if (isNaN(d.getTime())) return String(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d);
    return `${day} ${month}, ${d.getFullYear()}`;
}

function leaveDayCount(fromStr, toStr) {
    const fromOnly = toDateOnly(fromStr), toOnly = toDateOnly(toStr);
    if (!fromOnly || !toOnly) return 0;
    const a = new Date(fromOnly + 'T00:00:00'), b = new Date(toOnly + 'T00:00:00');
    const n = Math.round((b - a) / 86400000) + 1;
    return n > 0 ? n : 0;
}

function renderLeaveRequests(requests) {
    $('leaveRequestCountText').textContent = requests.length
        ? `${requests.length} leave request${requests.length === 1 ? '' : 's'} waiting for your decision.`
        : 'No pending leave requests right now.';

    if (!requests.length) {
        $('leaveRequestList').innerHTML = `
            <div class="activity-row">
                <div>
                    <span class="a-main">All caught up</span>
                    <span class="a-sub">No leave requests from your branch are waiting for approval.</span>
                </div>
                <span class="a-time">—</span>
            </div>`;
        return;
    }

    $('leaveRequestList').innerHTML = requests.map(req => {
        const days = leaveDayCount(req.fromDate, req.toDate);
        return `
        <div class="activity-row request-row">
            <div>
                <span class="a-main">${req.employee} <span style="color:var(--muted);font-weight:500">· ${req.leaveType || 'Leave'}</span></span>
                <span class="a-sub">${fmtLeaveDate(req.fromDate)} — ${fmtLeaveDate(req.toDate)} · ${days} day${days === 1 ? '' : 's'} · ${req.branch || ''}</span>
                ${req.reason ? `<span class="a-sub" style="margin-top:4px;color:var(--ink)">${req.reason}</span>` : ''}
            </div>
            <div class="request-actions">
                <button class="reject-btn" type="button" data-id="${req.leaveId}" data-decision="Reject" ${busyLeaveId === req.leaveId ? 'disabled' : ''}>DECLINE</button>
                <button class="approve-btn" type="button" data-id="${req.leaveId}" data-decision="Approve" ${busyLeaveId === req.leaveId ? 'disabled' : ''}>APPROVE</button>
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('#leaveRequestList .approve-btn, #leaveRequestList .reject-btn').forEach(btn => {
        btn.addEventListener('click', () => reviewLeaveRequest(btn.dataset.id, btn.dataset.decision));
    });
}

async function loadLeaveRequests() {
    try {
        const r = await fetch(`${API_URL}?action=getPendingLeaveRequests&branch=${encodeURIComponent(record.branch || '')}`);
        const result = await r.json();
        if (result && result.ok) renderLeaveRequests(result.requests || []);
    } catch (_) {/* keep showing the last known list until the next poll succeeds */ }
}

async function reviewLeaveRequest(leaveId, decision) {
    busyLeaveId = leaveId;
    try {
        const r = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'reviewLeaveRequest', leaveId, decision, reviewer: record.employee })
        });
        const result = await r.json();
        if (result && result.ok) {
            showToast(decision === 'Approve' ? 'Leave approved.' : 'Leave declined.', decision === 'Approve');
        } else {
            showToast((result && result.message) || 'Could not update the leave request.');
        }
    } catch (_) {
        showToast('Could not reach the server. Try again.');
    } finally {
        busyLeaveId = null;
        loadLeaveRequests();
    }
}

document.querySelectorAll('.sidebar-link[data-soon]').forEach(btn => {
    btn.addEventListener('click', () => showToast(`${btn.dataset.soon} is coming soon.`));
});

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
        } catch (_) {/* ignore — still sign out locally below */ }
    } else {
        await minDelay;
    }
    try { sessionStorage.removeItem('attenza_signin'); } catch (_) {/* ignore */ }
    window.location.href = 'index.html';
});

if (isAdmin) {
    loadRequests();
    pollTimer = setInterval(loadRequests, 5000);
    loadLeaveRequests();
    leavePollTimer = setInterval(loadLeaveRequests, 5000);
}