/*
 * Ersatz-Vorschläge für Unverträglichkeiten.
 * Liest die Personen (kuechenpilotPersonenDetails) und die Auswahl „Wer isst mit?“ pro Rezept
 * (kuechenpilotWerIsstMit). Bei Zutaten, die nicht passen, gibt es zwei Vorschläge pro Ersatz.
 * Eigene Ersätze einer Person haben Vorrang. Das Rezept selbst bleibt unverändert.
 * Hinweis: Die Erkennung läuft über Stichwörter. Bei echten Allergien immer selbst prüfen.
 */
(function () {
    'use strict';

    const DETAILS_KEY = 'kuechenpilotPersonenDetails';
    const WER_KEY = 'kuechenpilotWerIsstMit';
    const ANZAHL_KEY = 'kuechenpilotPersonen';

    /* Unverträglichkeit → Regeln: Muster für die Zutat und zwei Ersatzvorschläge. */
    const REGELN = {
        'Paprika': [
            { muster: /\bpaprikapulver\b/i, ersatz: ['Kreuzkümmel', 'Kurkuma (etwas weniger)'] },
            { muster: /\bpaprika\b/i, ersatz: ['Zucchini', 'Möhre'] }
        ],
        'Milch/Laktose': [
            { muster: /\b(kokosmilch|buttermilch)\b/i, ersatz: [] },
            { muster: /\bmilch\b/i, ersatz: ['Hafermilch', 'Sojamilch'] },
            { muster: /\bsahne\b/i, ersatz: ['Hafersahne', 'laktosefreie Sahne'] },
            { muster: /\bbutter\b/i, ersatz: ['Margarine', 'laktosefreie Butter'] },
            { muster: /\b(käse|parmesan|mozzarella)\b/i, ersatz: ['laktosefreier Käse', 'Hefeflocken'] },
            { muster: /\bjoghurt\b/i, ersatz: ['Sojajoghurt', 'laktosefreier Joghurt (nur bei Laktose)'] }
        ],
        'Gluten': [
            { muster: /\bmehl\b/i, ersatz: ['glutenfreies Mehl (z. B. Reismehl)', 'glutenfreie Mehlmischung'] },
            { muster: /\b(nudeln|pasta|spaghetti)\b/i, ersatz: ['glutenfreie Nudeln', 'Reisnudeln'] },
            { muster: /\b(brot|brötchen)\b/i, ersatz: ['glutenfreies Brot', 'Kartoffeln als Beilage'] },
            { muster: /\bsemmelbrösel|paniermehl\b/i, ersatz: ['glutenfreie Semmelbrösel', 'gemahlene Haferflocken (glutenfrei)'] }
        ],
        'Ei': [
            { muster: /\beier?\b/i, ersatz: ['Apfelmus (2 EL pro Ei)', 'Joghurt (3 EL pro Ei)'] }
        ],
        'Erdnüsse': [
            { muster: /\berdnuss\w*\s*(butter|mus)/i, ersatz: ['Cashewmus', 'Sonnenblumenkernmus'] },
            { muster: /\berdnuss/i, ersatz: ['Sonnenblumenkerne (geröstet)', 'Kokosflocken'] }
        ],
        'Schalenfrüchte': [
            { muster: /\b(mandel|haselnuss|walnuss|cashew|pistazie|pekan)\w*\s*(butter|mus)/i, ersatz: ['Sonnenblumenkernmus', 'Kokosmus'] },
            { muster: /\b(mandel|haselnuss|walnuss|cashew|pistazie|pekan)/i, ersatz: ['Sonnenblumenkerne (geröstet)', 'Kokosflocken'] }
        ],
        'Soja': [
            { muster: /\bsojasauce\b/i, ersatz: ['Kokosaminos', 'Gemüsebrühe (salzig abschmecken)'] },
            { muster: /\btofu\b/i, ersatz: ['Kichererbsen', 'Hähnchenbrust'] }
        ],
        'Fisch/Meeresfrüchte': [
            { muster: /\b(fisch|lachs|thunfisch|garnele|shrimp|kabeljau|forelle)/i, ersatz: ['Hähnchenbrust', 'Kichererbsen'] }
        ],
        'Sellerie': [
            { muster: /\bsellerie\b/i, ersatz: ['Fenchel', 'Lauch'] }
        ],
        'Senf': [
            { muster: /\bsenf\b/i, ersatz: ['Zitronensaft mit Honig', 'Meerrettich (sparsam)'] }
        ],
        'Sesam': [
            { muster: /\bsesam\b/i, ersatz: ['Sonnenblumenkerne', 'Leinsamen'] }
        ]
    };

    /* Ersatz, der für die Person selbst nicht geht (z. B. Cashew bei Schalenfrüchten). */
    const VERBOTEN = {
        'Milch/Laktose': t => /(milch|joghurt|sahne|butter|käse|quark)/i.test(t) && !/laktosefrei|hafer|soja|reis|kokos|margarine|hefe/i.test(t),
        'Soja': t => /soja/i.test(t),
        'Erdnüsse': t => /erdnuss/i.test(t),
        'Schalenfrüchte': t => /(mandel|haselnuss|walnuss|cashew|pistazie|pekan)/i.test(t),
        'Fisch/Meeresfrüchte': t => /(fisch|lachs|thunfisch|garnele|kabeljau|forelle)/i.test(t),
        'Sellerie': t => /sellerie/i.test(t),
        'Senf': t => /senf/i.test(t),
        'Sesam': t => /sesam|tahin/i.test(t),
        'Paprika': t => /paprika(?!pulver)/i.test(t)
    };

    const FLEISCH = /\b(fleisch|hähnchen|hühnchen|geflügel|rind|schwein|hack|fisch|lachs|garnele|thunfisch)/i;

    /* Alte Einträge „Erdnüsse/Nüsse“ werden auf die getrennten Punkte umgestellt. */
    function altAuflösen(liste) {
        const out = [];
        (liste || []).forEach(a => {
            if (a === 'Erdnüsse/Nüsse') out.push('Erdnüsse', 'Schalenfrüchte');
            else out.push(a);
        });
        return [...new Set(out)];
    }

    function lese(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key));
            return v == null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    /* Alle Personen aus dem Profil, mit Namen, Ernährungsform und Allergien. */
    function personen() {
        const liste = lese(DETAILS_KEY, []);
        return (Array.isArray(liste) ? liste : []).map((p, i) => ({
            index: i,
            name: (p.name || '').trim() || `Person ${i + 1}`,
            ernaehrung: (p.ernaehrung || '').toLowerCase(),
            allergien: altAuflösen(p.allergien),
            eigeneErsaetze: p.eigeneErsaetze || {}
        }));
    }

    /* Alle Unverträglichkeiten, die bei mindestens einer Person eingetragen sind. */
    function unvertraeglichkeiten() {
        const alle = new Set();
        personen().forEach(p => p.allergien.forEach(a => alle.add(a)));
        return [...alle];
    }

    /* Auswahl „Wer isst mit?“ für ein Rezept: { ids: [Personen-Nummern], weitere: Zahl }. */
    function werIsstMit(rezeptId) {
        const alle = lese(WER_KEY, {});
        const gespeichert = alle && alle[rezeptId];
        const anzahlPersonen = Number(lese(ANZAHL_KEY, 2)) || 2;
        const standard = Array.from({ length: anzahlPersonen }, (_, i) => i);
        if (!gespeichert) return { ids: standard, weitere: 0 };
        return {
            ids: Array.isArray(gespeichert.ids) ? gespeichert.ids : standard,
            weitere: Math.max(0, Number(gespeichert.weitere) || 0)
        };
    }

    function werIsstMitSpeichern(rezeptId, auswahl) {
        const alle = lese(WER_KEY, {}) || {};
        alle[rezeptId] = { ids: auswahl.ids, weitere: auswahl.weitere };
        try { localStorage.setItem(WER_KEY, JSON.stringify(alle)); } catch (e) { /* Speicher voll oder gesperrt */ }
    }

    /* Die Personen, die beim Rezept mitessen. */
    function gewaehlte(rezeptId) {
        const auswahl = werIsstMit(rezeptId);
        return personen().filter(p => auswahl.ids.includes(p.index));
    }

    /* Ersatz für eine Zutat, nur für die übergebenen Personen (Standard: alle).
     * Ergebnis: [{ grund, personen: [Namen], vorschlaege: [...] }] */
    function fuerZutat(zutat, liste) {
        const text = [zutat.name, zutat.text].filter(Boolean).join(' ');
        const gruppen = new Map();
        const nehmen = liste || personen();

        const eintrag = (grund, name, vorschlaege) => {
            if (!vorschlaege.length) return;
            const key = grund + '|' + vorschlaege.join('|');
            if (!gruppen.has(key)) gruppen.set(key, { grund, personen: [], vorschlaege });
            const g = gruppen.get(key);
            if (!g.personen.includes(name)) g.personen.push(name);
        };

        nehmen.forEach(p => {
            p.allergien.forEach(art => {
                const eigen = (p.eigeneErsaetze || {})[art];
                const regel = (REGELN[art] || []).find(r => r.muster.test(text));
                if (!regel) return;
                const verboten = VERBOTEN[art] || (() => false);
                const passend = regel.ersatz.filter(v => !verboten(v));
                const vorschlaege = eigen ? [`${eigen} (dein eigener Ersatz)`, ...passend.slice(0, 1)] : passend;
                eintrag(art, p.name, vorschlaege);
            });
            if (/vegetarisch|vegan/.test(p.ernaehrung) && FLEISCH.test(text)) {
                eintrag('Ernährungsform', p.name, ['Tofu', 'Kichererbsen']);
            }
        });
        return [...gruppen.values()];
    }

    window.KPErsatz = { fuerZutat, unvertraeglichkeiten, personen, werIsstMit, werIsstMitSpeichern, gewaehlte, REGELN };
})();
