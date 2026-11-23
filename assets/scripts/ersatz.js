/*
 * Ersatz-Vorschläge für Unverträglichkeiten.
 * Liest die Unverträglichkeiten aller Personen (kuechenpilotPersonenDetails) und
 * schlägt bei Zutaten, die dazu passen, einen Ersatz vor. Das Rezept selbst bleibt unverändert.
 * Hinweis: Die Erkennung läuft über Stichwörter. Bei echten Allergien immer selbst prüfen.
 */
(function () {
    'use strict';

    const DETAILS_KEY = 'kuechenpilotPersonenDetails';

    /* Unverträglichkeit → Regeln: Muster für die Zutat und Ersatzvorschläge. */
    const REGELN = {
        'Paprika': [
            { muster: /\bpaprikapulver\b/i, ersatz: ['Kreuzkümmel oder Kurkuma (etwas weniger)'] },
            { muster: /\bpaprika\b/i, ersatz: ['Zucchini', 'Möhre', 'Aubergine'] }
        ],
        'Milch/Laktose': [
            { muster: /\b(kokosmilch|buttermilch)\b/i, ersatz: [] },
            { muster: /\bmilch\b/i, ersatz: ['Hafermilch', 'laktosefreie Milch'] },
            { muster: /\bsahne\b/i, ersatz: ['Hafersahne', 'laktosefreie Sahne'] },
            { muster: /\bbutter\b/i, ersatz: ['Margarine', 'laktosefreie Butter'] },
            { muster: /\b(käse|parmesan|mozzarella)\b/i, ersatz: ['laktosefreier Käse', 'Hefeflocken'] },
            { muster: /\bjoghurt\b/i, ersatz: ['Sojajoghurt', 'laktosefreier Joghurt'] }
        ],
        'Gluten': [
            { muster: /\bmehl\b/i, ersatz: ['glutenfreies Mehl (z. B. Reismehl)'] },
            { muster: /\b(nudeln|pasta|spaghetti)\b/i, ersatz: ['glutenfreie Nudeln'] },
            { muster: /\b(brot|brötchen)\b/i, ersatz: ['glutenfreies Brot'] },
            { muster: /\bsemmelbrösel|paniermehl\b/i, ersatz: ['glutenfreie Semmelbrösel'] }
        ],
        'Ei': [
            { muster: /\beier?\b/i, ersatz: ['Apfelmus (2 EL pro Ei)', 'Speisestärke mit Wasser (1 EL + 1 EL pro Ei)'] }
        ],
        'Erdnüsse/Nüsse': [
            { muster: /\b(mandel|walnuss|haselnuss|erdnuss|cashew|pistazie)/i, ersatz: ['Sonnenblumenkerne', 'geröstete Haferflocken'] }
        ],
        'Soja': [
            { muster: /\bsojasauce\b/i, ersatz: ['Kokosaminos'] },
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
            { muster: /\bsesam\b/i, ersatz: ['Sonnenblumenkerne'] }
        ]
    };

    /* Alle Unverträglichkeiten, die bei mindestens einer Person eingetragen sind. */
    function unvertraeglichkeiten() {
        try {
            const liste = JSON.parse(localStorage.getItem(DETAILS_KEY) || '[]');
            const alle = new Set();
            (Array.isArray(liste) ? liste : []).forEach(p => (p.allergien || []).forEach(a => alle.add(a)));
            return [...alle];
        } catch (e) {
            return [];
        }
    }

    /* Ersatz für eine Zutat: Liste der Vorschläge, leer wenn nichts passt. */
    function fuerZutat(zutat, eintraege) {
        const text = [zutat.name, zutat.text].filter(Boolean).join(' ');
        const ergebnis = [];
        (eintraege || unvertraeglichkeiten()).forEach(art => {
            (REGELN[art] || []).some(regel => {
                if (!regel.muster.test(text)) return false;
                if (regel.ersatz.length) ergebnis.push({ grund: art, vorschlaege: regel.ersatz });
                return true;
            });
        });
        return ergebnis;
    }

    window.KPErsatz = { fuerZutat, unvertraeglichkeiten, REGELN };
})();
