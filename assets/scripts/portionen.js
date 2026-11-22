/*
 * Küchenpilot – Portionen umrechnen.
 *
 * Gemeinsame Funktionen für Rezeptseite, Wochenplan und Einkaufsliste.
 * Rezepte werden standardmäßig für STANDARD_PERSONEN berechnet.
 *
 *   KPPortionen.basis(rezept)              -> { anzahl, einheit, personen }
 *   KPPortionen.standard(rezept)           -> Startwert (2 bei Personen-Rezepten)
 *   KPPortionen.faktor(rezept, ziel)       -> Umrechnungsfaktor
 *   KPPortionen.skaliereZutat(zutat, f)    -> neue Zutat mit umgerechneter menge/text (+ mengeWert)
 *   KPPortionen.skaliereRezept(rezept, ziel) -> Kopie des Rezepts mit umgerechneten Zutaten
 *   KPPortionen.parseMenge("1½") -> 1.5   KPPortionen.formatMenge(1.5) -> "1½"
 *
 * Läuft im Browser (window.KPPortionen) und in Node (module.exports).
 */
(function (root) {
    'use strict';

    const STANDARD_PERSONEN = 2;
    const BRUECHE = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
    const GEWICHT = ['g', 'ml'];

    /* Bezieht sich das Rezept auf Personen? Bei Laib, Blech oder Stück nicht. */
    function basis(rezept) {
        const anzahl = Number(rezept && rezept.portionen) || 0;
        const einheit = rezept && rezept.portionsEinheit ? rezept.portionsEinheit : '';
        return { anzahl, einheit, personen: anzahl > 0 && !einheit };
    }

    function standard(rezept) {
        const b = basis(rezept);
        if (!b.anzahl) return 0;
        return b.personen ? STANDARD_PERSONEN : b.anzahl;
    }

    function faktor(rezept, ziel) {
        const b = basis(rezept);
        return b.anzahl && ziel ? ziel / b.anzahl : 1;
    }

    /* "1½" -> 1.5, "½" -> 0.5, "1,5" -> 1.5, "200" -> 200; sonst NaN. */
    function parseMenge(text) {
        const s = String(text || '').trim().replace(',', '.');
        if (!s) return NaN;
        const m = s.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔])?$/);
        if (!m || (!m[1] && !m[2])) return NaN;
        return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? BRUECHE[m[2]] : 0);
    }

    function runden(wert, einheit) {
        if (GEWICHT.includes(einheit)) {
            if (wert >= 100) return Math.round(wert / 10) * 10;
            if (wert >= 20) return Math.round(wert / 5) * 5;
            return Math.max(1, Math.round(wert));
        }
        if (wert >= 10) return Math.round(wert);
        if (wert >= 1) return Math.round(wert * 2) / 2;
        return Math.max(0.25, Math.round(wert * 4) / 4);
    }

    function formatMenge(wert) {
        const ganz = Math.floor(wert + 1e-9);
        const rest = wert - ganz;
        const bruch = Object.keys(BRUECHE).find(k => Math.abs(BRUECHE[k] - rest) < 0.02);
        if (rest < 0.02) return String(ganz);
        if (bruch) return (ganz ? String(ganz) : '') + bruch;
        return String(Math.round(wert * 10) / 10).replace('.', ',');
    }

    /* Rechnet eine Mengenangabe wie "150–200", "ca. 150" oder "1½" um. */
    function skaliereMenge(menge, f, einheit) {
        const text = String(menge || '').trim();
        if (!text || f === 1) return { text, wert: parseMenge(text) };
        const praefix = (text.match(/^(ca\.\s*)/) || ['', ''])[1];
        const teile = text.slice(praefix.length).split(/\s*[–-]\s*/);
        const werte = teile.map(parseMenge);
        if (werte.some(isNaN)) return { text, wert: NaN };
        const neu = werte.map(w => runden(w * f, einheit));
        return { text: praefix + neu.map(formatMenge).join('–'), wert: neu[neu.length - 1] };
    }

    function skaliereZutat(zutat, f) {
        const s = skaliereMenge(zutat.menge, f, zutat.einheit || '');
        const neu = Object.assign({}, zutat, { menge: s.text, mengeWert: isNaN(s.wert) ? null : s.wert });
        if (s.text && s.text !== String(zutat.menge || '').trim()) {
            neu.text = [s.text, zutat.einheit, zutat.name].filter(Boolean).join(' ');
        }
        return neu;
    }

    function skaliereRezept(rezept, ziel) {
        const f = faktor(rezept, ziel);
        return Object.assign({}, rezept, {
            portionen: ziel || rezept.portionen,
            portionenOriginal: rezept.portionen,
            zutaten: (rezept.zutaten || []).map(z => skaliereZutat(z, f))
        });
    }

    function beschriftung(rezept, anzahl) {
        const b = basis(rezept);
        if (b.einheit) return `${anzahl} ${b.einheit}`;
        return `${anzahl} ${anzahl === 1 ? 'Person' : 'Personen'}`;
    }

    const api = {
        STANDARD_PERSONEN, basis, standard, faktor, parseMenge, formatMenge,
        skaliereMenge, skaliereZutat, skaliereRezept, beschriftung
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.KPPortionen = api;
})(typeof window !== 'undefined' ? window : globalThis);
