/*
 * Airfryer-Einstellung und Backofen-Werte für Airfryer-Rezepte.
 *
 *   KPAirfryer.lade()                 -> { personen: 2, keiner: false }
 *   KPAirfryer.speichere(werte)
 *   KPAirfryer.brauchtOfen(rezept, anzahl) -> true, wenn der Backofen-Hinweis kommen soll
 *   KPAirfryer.mitOfenWerten(html)    -> Schritt-Text mit Backofen-Werten in Klammern
 *
 * Faustregel: Backofen (Ober-/Unterhitze, vorgeheizt) etwa 20 °C heißer
 * und etwa die Hälfte länger als im Airfryer.
 */
(function (root) {
    'use strict';

    const KEY = 'kuechenpilotAirfryer';
    const STANDARD = { personen: 2, keiner: false };

    function lade() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!v || typeof v !== 'object') return { ...STANDARD };
            const personen = Math.round(Number(v.personen));
            return {
                personen: personen >= 1 && personen <= 20 ? personen : STANDARD.personen,
                keiner: !!v.keiner
            };
        } catch (e) {
            return { ...STANDARD };
        }
    }

    function speichere(werte) {
        try { localStorage.setItem(KEY, JSON.stringify({ ...lade(), ...werte })); } catch (e) { /* ohne Speicher geht es auch */ }
    }

    function istAirfryerRezept(rezept) {
        return !!rezept && (rezept.geraete || []).includes('Airfryer');
    }

    function brauchtOfen(rezept, anzahl) {
        if (!istAirfryerRezept(rezept)) return false;
        const e = lade();
        return e.keiner || (Number(anzahl) || 0) > e.personen;
    }

    function runde5(n) { return Math.round(n / 5) * 5; }

    function ofenGrad(grad) { return runde5(grad + 20); }

    function ofenMinuten(min) { return Math.max(min + 1, Math.round(min * 1.5)); }

    const GRAD = /(\d{2,3})\s?°C/g;
    const MINUTEN = /(\d+)(?:\s*[–-]\s*(\d+))?\s*(Minuten|Min\.)/g;

    /* Hängt die Backofen-Werte in Klammern an. Erwartet bereits maskiertes HTML. */
    function mitOfenWerten(html) {
        return String(html || '')
            .replace(GRAD, (ganz, g) => `${ganz} <span class="oven-value">(Backofen: ${ofenGrad(Number(g))} °C)</span>`)
            .replace(MINUTEN, (ganz, von, bis) => {
                const text = bis ? `${ofenMinuten(Number(von))}–${ofenMinuten(Number(bis))}` : ofenMinuten(Number(von));
                return `${ganz} <span class="oven-value">(Backofen: ca. ${text} Min.)</span>`;
            })
            .replace(/Airfryer-Form/g, 'Airfryer-Form <span class="oven-value">(Backofen: Auflaufform)</span>')
            .replace(/in den Airfryer(?![-\w])/g, 'in den Airfryer <span class="oven-value">(Backofen: aufs Blech mit Backpapier)</span>');
    }

    const api = { KEY, lade, speichere, istAirfryerRezept, brauchtOfen, mitOfenWerten, ofenGrad, ofenMinuten };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.KPAirfryer = api;
})(typeof window !== 'undefined' ? window : globalThis);
