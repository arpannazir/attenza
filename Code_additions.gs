/**
 * ──────────────────────────────────────────────────────────────────────────
 * ATTENZA — Code.gs additions for the History page
 *
 * HOW TO INTEGRATE:
 *
 * 1. In doGet(), add this block alongside the existing action checks:
 *
 *      if (action === 'getHistory') {
 *        return jsonOutput_(getHistory_(e.parameter.employee));
 *      }
 *
 * 2. Paste the getHistory_() function below into Code.gs (anywhere before
 *    the closing of the file, e.g. just above getBook_()).
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Returns the complete attendance event log for one employee, sorted
 * chronologically, so the client can build sessions, totals, and charts.
 *
 * Response shape:
 * {
 *   ok: true,
 *   events: [
 *     {
 *       date:     'YYYY-MM-DD',
 *       time:     '<ISO 8601 timestamp>',
 *       type:     'Sign In' | 'Sign In (QR)' | 'Sign In (Admin Approved)' | 'Sign Out',
 *       branch:   'Branch Name',
 *       distance: 47,           // metres (number), or '' for sign-outs
 *       accuracy: 12,           // GPS accuracy metres, or '' if unknown
 *       status:   'Verified'
 *     },
 *     …
 *   ]
 * }
 */
function getHistory_(employeeName) {
  const name = employeeName ? String(employeeName).trim() : '';
  if (!name) return { ok: false, message: 'Employee name is required.' };

  const book   = getBook_();
  const sheet  = book.getSheetByName('Attendance');
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, events: [] };

  const tz     = Session.getScriptTimeZone();
  const target = name.toLowerCase();

  const range     = sheet.getDataRange();
  const rawRows   = range.getValues();
  const headers   = rawRows.shift().map(normaliseHeader_);

  // Column indices — tolerant of sheets created before every column existed.
  const idx = {
    time:   headers.indexOf('sign-in_time'),
    date:   headers.indexOf('date'),
    name:   headers.indexOf('name'),         // normalised from 'Employee Name'
    branch: headers.indexOf('branch'),       // normalised from 'Branch Name'
    type:   headers.indexOf('type'),
    dist:   headers.indexOf('distance_(m)'),
    acc:    headers.indexOf('gps_accuracy_(m)'),
    status: headers.indexOf('status')
  };

  const events = [];

  rawRows.forEach(function (row) {
    if (!row.some(String)) return; // blank row — skip

    // Filter by employee name (case-insensitive, trimmed).
    if (String(row[idx.name] || '').trim().toLowerCase() !== target) return;

    // Date — handle both Date objects and string cells.
    const rawDate = idx.date >= 0 ? row[idx.date] : null;
    const dateStr = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd')
      : String(rawDate || '').trim();

    // Time — always emit as ISO so new Date(time) is unambiguous on the client.
    const rawTime = idx.time >= 0 ? row[idx.time] : null;
    const timeISO = rawTime instanceof Date ? rawTime.toISOString() : (rawTime ? String(rawTime) : null);

    const dist = idx.dist >= 0 ? row[idx.dist] : '';
    const acc  = idx.acc  >= 0 ? row[idx.acc]  : '';

    events.push({
      date:     dateStr,
      time:     timeISO,
      type:     String(idx.type  >= 0 ? row[idx.type]   : '').trim(),
      branch:   String(idx.branch >= 0 ? row[idx.branch] : '').trim(),
      distance: dist !== '' && dist !== null ? Number(dist) : null,
      accuracy: acc  !== '' && acc  !== null ? Number(acc)  : null,
      status:   String(idx.status >= 0 ? row[idx.status] : '').trim()
    });
  });

  // Sort chronologically (oldest first).
  events.sort(function (a, b) {
    return (a.time || '').localeCompare(b.time || '');
  });

  return { ok: true, events: events };
}

/* ── doGet snippet to paste in ── */
/*
  // Inside doGet(), add this alongside the other action checks:
  if (action === 'getHistory') {
    return jsonOutput_(getHistory_(e.parameter.employee));
  }
*/