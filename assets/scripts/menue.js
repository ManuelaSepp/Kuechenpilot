/*
 * Hamburger-Menü: erscheint oben rechts auf jeder Seite und zeigt alle Bereiche.
 * Einbinden vor </body>: <script src="assets/scripts/menue.js?v=1"></script>
 * Das Menü fügt sich selbst ein (Stil und Knopf), damit jede Seite gleich aussieht.
 */
(function () {
    'use strict';

    const SEITEN = [
        { href: 'index.html', titel: 'Startseite', text: 'Alles auf einen Blick', icon: 'topf.png' },
        { href: 'heute.html', titel: 'Heute', text: 'Dein Tag, deine Mahlzeiten', icon: 'haus.png' },
        { href: 'wochenkorb.html', titel: 'Wochenkorb', text: 'Planen und organisieren', icon: 'wochenkorb.png' },
        { href: 'rezepte.html', titel: 'Rezepte', text: 'Entdecken, kochen, lieben', icon: 'kochbesteck.png' },
        { href: 'einkauf.html', titel: 'Einkauf', text: 'Einkaufen leicht gemacht', icon: 'kiste.png' },
        { href: 'vorrat.html', titel: 'Vorrat', text: 'Vorräte im Blick', icon: 'regal.png' },
        { href: 'kaloriengrab.html', titel: 'Was war auf dem Teller?', text: 'Essen eintragen, Kalorien im Blick', icon: 'apfel.png' },
        { href: 'personen.html', titel: 'Personen', text: 'Personen und Vorlieben eintragen (optional)', icon: 'klemmbrett.png' },
        { href: 'mehr.html', titel: 'Mehr', text: 'Einstellungen und Infos', icon: 'stern.png' }
    ];

    const CSS = `
        .kp-menu-button {
            position: fixed;
            top: 14px;
            right: 14px;
            z-index: 1000;
            width: 52px;
            height: 52px;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 0;
            border: 2px solid #f5a623;
            border-radius: 16px;
            background: #fffdf8;
            box-shadow: 0 10px 22px rgba(166, 112, 34, 0.18);
            cursor: pointer;
        }
        .kp-menu-button span {
            display: block;
            width: 24px;
            height: 3px;
            border-radius: 3px;
            background: #df8f12;
        }
        .kp-menu-button[hidden] { display: none; }
        .kp-menu-button.kp-menu-in-hero {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 46px;
            height: 46px;
            gap: 4px;
        }
        .kp-menu-button.kp-menu-in-hero span { width: 20px; height: 2.5px; }
        .kp-menu-button:focus-visible { outline: 3px solid rgba(245, 166, 35, 0.45); outline-offset: 2px; }
        .kp-menu-layer {
            position: fixed;
            inset: 0;
            z-index: 999;
            background: rgba(51, 36, 10, 0.35);
            display: flex;
            justify-content: flex-end;
        }
        .kp-menu-layer[hidden] { display: none; }
        .kp-menu-panel {
            width: min(92vw, 380px);
            height: 100%;
            overflow-y: auto;
            padding: 84px 18px 28px;
            background: #fff7ea;
            border-left: 2px solid rgba(245, 166, 35, 0.42);
            box-shadow: -16px 0 36px rgba(166, 112, 34, 0.18);
            font-family: "Architects Daughter", "Comfortaa", sans-serif;
            color: #333333;
        }
        .kp-menu-panel h2 {
            margin: 0 0 14px;
            font-size: 1.5rem;
            font-weight: 600;
            color: #df8f12;
        }
        .kp-menu-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: grid;
            gap: 10px;
        }
        .kp-menu-list a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border: 2px solid rgba(245, 166, 35, 0.30);
            border-radius: 16px;
            background: #fffdf8;
            color: #333333;
            text-decoration: none;
        }
        .kp-menu-list a:hover,
        .kp-menu-list a:focus-visible {
            border-color: #f5a623;
            outline: none;
        }
        .kp-menu-list a[aria-current="page"] {
            border-color: #f5a623;
            background: rgba(245, 166, 35, 0.14);
        }
        .kp-menu-list img { width: 36px; height: 36px; object-fit: contain; flex: none; }
        .kp-menu-list strong { display: block; font-size: 1.12rem; font-weight: 600; }
        .kp-menu-list small { color: #555555; font-size: 0.92rem; font-family: "Comfortaa", sans-serif; }
        .kp-menu-close {
            position: absolute;
            top: 14px;
            right: 14px;
            min-height: 52px;
            padding: 8px 16px;
            border: 2px solid #f5a623;
            border-radius: 16px;
            background: #ffffff;
            color: #df8f12;
            font: inherit;
            font-size: 1.05rem;
            cursor: pointer;
        }
        .kp-menu-close:hover, .kp-menu-close:focus-visible { background: #f5a623; color: #ffffff; outline: none; }
    `;

    /* Name der aktuellen Seite, damit ihr Eintrag markiert wird. */
    function aktuelleSeite() {
        const name = location.pathname.split('/').pop() || 'index.html';
        const zuordnung = { 'grundvorrat.html': 'vorrat.html', 'rezept-bearbeiten.html': 'rezepte.html' };
        return zuordnung[name] || name;
    }

    function bauen() {
        /* Auf der Startseite ist kein Menü nötig, dort stehen alle Bereiche schon als Kacheln. */
        if (aktuelleSeite() === 'index.html') return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = 'kp-menu-button';
        knopf.setAttribute('aria-label', 'Menü öffnen');
        knopf.setAttribute('aria-expanded', 'false');
        knopf.setAttribute('aria-controls', 'kpMenu');
        knopf.innerHTML = '<span></span><span></span><span></span>';

        const schicht = document.createElement('div');
        schicht.className = 'kp-menu-layer';
        schicht.id = 'kpMenu';
        schicht.hidden = true;

        const aktuell = aktuelleSeite();
        const links = SEITEN.map(s => `
            <li><a href="${s.href}"${s.href === aktuell ? ' aria-current="page"' : ''}>
                <img src="assets/icons/${s.icon}" alt="">
                <div><strong>${s.titel}</strong><small>${s.text}</small></div>
            </a></li>`).join('');

        schicht.innerHTML = `
            <nav class="kp-menu-panel" aria-label="Alle Bereiche">
                <h2>Wohin möchtest du?</h2>
                <ul class="kp-menu-list">${links}</ul>
            </nav>
            <button type="button" class="kp-menu-close" aria-label="Menü schließen">Schließen</button>`;

        /* Knopf direkt in den Kopfbereich setzen, damit er nah am Inhalt sitzt. */
        /* Knopf in die Kachel mit dem Text setzen, oben rechts. */
        const kachel = document.querySelector('.welcome-card') || document.querySelector('.hero-shell');
        if (kachel) {
            knopf.classList.add('kp-menu-in-hero');
            if (getComputedStyle(kachel).position === 'static') kachel.style.position = 'relative';
            kachel.appendChild(knopf);
        } else {
            document.body.appendChild(knopf);
        }
        document.body.appendChild(schicht);

        function oeffnen() {
            schicht.hidden = false;
            knopf.hidden = true;
            knopf.setAttribute('aria-expanded', 'true');
            const erster = schicht.querySelector('.kp-menu-list a');
            if (erster) erster.focus();
        }
        function schliessen() {
            schicht.hidden = true;
            knopf.hidden = false;
            knopf.setAttribute('aria-expanded', 'false');
            knopf.focus();
        }

        knopf.addEventListener('click', oeffnen);
        schicht.querySelector('.kp-menu-close').addEventListener('click', schliessen);
        schicht.addEventListener('click', e => { if (e.target === schicht) schliessen(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !schicht.hidden) schliessen(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bauen);
    } else {
        bauen();
    }
})();
