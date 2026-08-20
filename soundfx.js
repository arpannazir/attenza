/**
 * ATTENZA — Sound Effects & Smooth Page Transitions
 *
 * Lightweight, zero-dependency Web Audio API synthesizer for luxury UI chimes:
 *   • playSuccess()      — Rising harmonic triad for successful check-in / approval
 *   • playSignOut()      — Soft descending resolution tone for safe sign-out
 *   • playNotification() — Pleasant dual-bell chime for leave submission / review
 *   • playTransition()   — Subtle micro-tap for page transitions
 *
 * Also automatically wires smooth fade-and-slide navigation transitions on all
 * sidebar links.
 */

const SoundFx = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) ctx = new AudioCtx();
        }
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        return ctx;
    }

    // Success Chime: Rising harmonic triad (C5 -> E5 -> G5)
    function playSuccess() {
        try {
            const c = getCtx();
            if (!c) return;
            const now = c.currentTime;
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.085);

                gain.gain.setValueAtTime(0.001, now + i * 0.085);
                gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.085 + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.085 + 0.38);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(now + i * 0.085);
                osc.stop(now + i * 0.085 + 0.39);
            });
        } catch (_) {}
    }

    // Sign Out Chime: Warm descending resolution tone (G5 -> E5 -> C5)
    function playSignOut() {
        try {
            const c = getCtx();
            if (!c) return;
            const now = c.currentTime;
            const notes = [783.99, 659.25, 523.25]; // G5, E5, C5
            notes.forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);

                gain.gain.setValueAtTime(0.001, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.08 + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.35);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.36);
            });
        } catch (_) {}
    }

    // Notification / Submit Chime: Pleasant dual-bell chime (A4 -> C#5)
    function playNotification() {
        try {
            const c = getCtx();
            if (!c) return;
            const now = c.currentTime;
            const notes = [440, 554.37];
            notes.forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.075);

                gain.gain.setValueAtTime(0.001, now + i * 0.075);
                gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.075 + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.075 + 0.3);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(now + i * 0.075);
                osc.stop(now + i * 0.075 + 0.31);
            });
        } catch (_) {}
    }

    // Subtle micro-tap for page transitions
    function playTransition() {
        try {
            const c = getCtx();
            if (!c) return;
            const now = c.currentTime;
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(700, now);
            osc.frequency.exponentialRampToValueAtTime(350, now + 0.05);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(now);
            osc.stop(now + 0.06);
        } catch (_) {}
    }

    return { playSuccess, playSignOut, playNotification, playTransition };
})();

// Auto-wire smooth page transitions on all sidebar navigation links
function wirePageTransitions() {
    document.querySelectorAll('.sidebar-nav a.sidebar-link, .sidebar a.sidebar-logo').forEach(link => {
        link.addEventListener('click', ev => {
            const target = link.getAttribute('href');
            if (!target || target === '#' || link.classList.contains('active')) return;
            
            ev.preventDefault();
            SoundFx.playTransition();

            const main = document.querySelector('.home-main');
            if (main) main.classList.add('page-leaving');

            setTimeout(() => {
                window.location.href = target;
            }, 160);
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wirePageTransitions);
} else {
    wirePageTransitions();
}
