/*
 * Eigene Rezepte: werden im Browser gespeichert (localStorage kuechenpilotEigeneRezepte)
 * und beim Laden an die Rezeptsammlung (window.KP_REZEPTE.rezepte) angehängt.
 * Dadurch funktionieren sie überall: Rezeptseite, Heute, Wochenkorb, Einkauf.
 *
 * Einbinden direkt nach data/rezepte.js.
 */
(function (root) {
    'use strict';

    const KEY = 'kuechenpilotEigeneRezepte';
    const EINHEITEN = ['g', 'kg', 'ml', 'l', 'EL', 'TL', 'Prise', 'Prisen', 'Msp.', 'Stück', 'Stk.', 'Stk',
        'Dose', 'Dosen', 'Becher', 'Bund', 'Pck.', 'Packung', 'Packungen', 'Päckchen', 'Zehe', 'Zehen',
        'Scheibe', 'Scheiben', 'Glas', 'Gläser', 'Tasse', 'Tassen', 'Würfel', 'Kugel', 'Flasche', 'Handvoll'];

    function read() {
        try {
            const list = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(list) ? list.filter(r => r && r.id && r.titel) : [];
        } catch (e) {
            return [];
        }
    }

    function write(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ohne Speicher geht es nicht */ }
    }

    function slug(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'rezept';
    }

    function uniqueId(titel, takenIds) {
        const base = `eigen-${slug(titel)}`;
        let id = base;
        let n = 2;
        while (takenIds.has(id)) id = `${base}-${n++}`;
        return id;
    }

    /*
     * Zutaten aus Text, eine pro Zeile:
     *   "200 g Mehl", "2 EL Öl", "½ TL Salz", "3 Eier", "Salz und Pfeffer"
     *   Eine Zeile mit Doppelpunkt am Ende ("Für die Soße:") wird zur Zwischenüberschrift.
     */
    const MENGE = '(?:ca\\.\\s*)?(?:\\d+(?:[.,]\\d+)?(?:\\s*[½¼¾⅓⅔])?|[½¼¾⅓⅔]|\\d+\\s*\\/\\s*\\d+)(?:\\s*[–-]\\s*(?:\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔]))?';

    function escapeRe(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const ZEILE = new RegExp(`^(${MENGE})\\s*(${EINHEITEN.map(escapeRe).join('|')})?(?=\\s|$)\\s*(.*)$`, 'i');

    function parseZutaten(text) {
        let gruppe = '';
        const out = [];
        String(text || '').split(/\r?\n/).forEach(raw => {
            const line = raw.replace(/^[-•*]\s*/, '').trim();
            if (!line) return;
            if (/:$/.test(line) && line.length < 60) {
                gruppe = line.replace(/:$/, '').trim();
                return;
            }
            const m = line.match(ZEILE);
            let menge = '';
            let einheit = '';
            let name = line;
            if (m && m[3]) {
                menge = m[1].replace(/\s+/g, ' ').trim();
                einheit = m[2] ? (EINHEITEN.find(e => e.toLowerCase() === m[2].toLowerCase()) || m[2]) : '';
                name = m[3].trim();
            }
            const z = { text: line, menge, einheit, name };
            if (gruppe) z.gruppe = gruppe;
            out.push(z);
        });
        return out;
    }

    function zutatenText(zutaten) {
        let gruppe = '';
        const lines = [];
        (zutaten || []).forEach(z => {
            if ((z.gruppe || '') !== gruppe) {
                gruppe = z.gruppe || '';
                if (gruppe) lines.push(`${gruppe}:`);
            }
            lines.push(z.text || [z.menge, z.einheit, z.name].filter(Boolean).join(' '));
        });
        return lines.join('\n');
    }

    /* Schritte: eine Zeile pro Schritt, Nummern am Anfang werden entfernt. */
    function parseSchritte(text) {
        return String(text || '')
            .split(/\r?\n/)
            .map(l => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
            .filter(Boolean);
    }

    function list() {
        return read();
    }

    function get(id) {
        return read().find(r => r.id === id) || null;
    }

    /* Speichert neu oder überschreibt (gleiche id). Gibt das gespeicherte Rezept zurück. */
    function save(recipe) {
        const all = read();
        const taken = new Set([
            ...((root.KP_REZEPTE && root.KP_REZEPTE.rezepte) || []).map(r => r.id),
            ...all.map(r => r.id)
        ]);
        const r = Object.assign({}, recipe, { eigen: true, status: 'eigenes Rezept' });
        if (!r.id || !all.some(x => x.id === r.id)) {
            if (r.id) taken.delete(r.id);
            r.id = uniqueId(r.titel, taken);
        }
        r.geaendert = new Date().toISOString().slice(0, 10);
        const i = all.findIndex(x => x.id === r.id);
        if (i >= 0) all[i] = r; else all.push(r);
        write(all);
        return r;
    }

    function remove(id) {
        write(read().filter(r => r.id !== id));
    }

    /* An die Sammlung anhängen (einmal beim Laden). */
    const data = root.KP_REZEPTE;
    if (data && Array.isArray(data.rezepte)) {
        const ids = new Set(data.rezepte.map(r => r.id));
        read().forEach(r => { if (!ids.has(r.id)) data.rezepte.push(r); });
    }

    root.KPEigeneRezepte = { KEY, EINHEITEN, list, get, save, remove, parseZutaten, zutatenText, parseSchritte, slug };
})(typeof window !== 'undefined' ? window : globalThis);
