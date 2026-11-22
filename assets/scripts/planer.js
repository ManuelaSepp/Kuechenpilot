/*
 * Gemeinsame Logik für Wochenkorb (Wochenplan) und Einkauf.
 * Alles bleibt im Browser (localStorage), es gibt keinen Server.
 *
 * Gespeicherte Daten:
 *   kuechenpilotWochenplan   { "2026-11-23": [ { id, menge } ] }   (Schlüssel = Datum des Tages)
 *   kuechenpilotPersonen      Zahl (Standard 2), auch von personen.html gesetzt
 *   kuechenpilotWoche         Montag der zuletzt angesehenen Woche ("2026-11-23")
 *   kuechenpilotEinkauf       { "<Montag>": { gekauft: [], habeIch: [], dochKaufen: [], eigene: [], eingeraeumt: [] } }
 *   Wochenplan-Einträge bekommen nach "Gekocht" { gekocht: "<Datum>" } und fallen aus der Einkaufsliste.
 *   kuechenpilotGrundvorratDetails  (kommt von vorrat.html)
 *   kuechenpilotKaeufe        { "<key>": { name, daten: ["2026-11-22", …], spaeter: "<Datum>" } }  (wann was gekauft wurde)
 */
(function () {
    const KEYS = {
        plan: 'kuechenpilotWochenplan',
        personen: 'kuechenpilotPersonen',
        woche: 'kuechenpilotWoche',
        einkauf: 'kuechenpilotEinkauf',
        vorrat: 'kuechenpilotGrundvorrat',
        vorratDetails: 'kuechenpilotGrundvorratDetails',
        kaeufe: 'kuechenpilotKaeufe'
    };

    const RECIPES = ((window.KP_REZEPTE || {}).rezepte || [])
        .filter(r => r.status !== 'unvollständig' && (r.zutaten || []).length);
    const BY_ID = new Map(RECIPES.map(r => [r.id, r]));

    /* ---------- Speicher ---------- */

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value === null ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ohne Speicher geht es trotzdem */ }
    }

    function getPersonen() {
        const fallback = (window.KPPortionen && window.KPPortionen.STANDARD_PERSONEN) || 2;
        const n = Number(readJson(KEYS.personen, fallback));
        return Number.isFinite(n) && n >= 1 ? Math.round(n) : fallback;
    }

    function setPersonen(n) {
        writeJson(KEYS.personen, Math.max(1, Math.min(20, Math.round(n))));
    }

    /* ---------- Datum und Woche ---------- */

    const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    function isoDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function parseIso(text) {
        const [y, m, d] = String(text).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }

    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const shift = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - shift);
        return d;
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function currentWeek() {
        const saved = readJson(KEYS.woche, null);
        const thisWeek = isoDate(mondayOf(new Date()));
        /* Eine vergangene Woche nicht wieder öffnen, dann lieber die aktuelle. */
        if (typeof saved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved) && saved >= thisWeek) return saved;
        return thisWeek;
    }

    function setWeek(monday) {
        writeJson(KEYS.woche, monday);
    }

    function shiftWeek(monday, n) {
        return isoDate(addDays(parseIso(monday), 7 * n));
    }

    function weekDays(monday) {
        const start = parseIso(monday);
        return DAY_NAMES.map((name, i) => {
            const d = addDays(start, i);
            return { key: isoDate(d), name, short: name.slice(0, 2), date: d, label: `${d.getDate()}. ${MONTHS[d.getMonth()]}` };
        });
    }

    function weekLabel(monday) {
        const s = parseIso(monday);
        const e = addDays(s, 6);
        const thisWeek = isoDate(mondayOf(new Date()));
        let prefix = '';
        if (monday === thisWeek) prefix = 'Diese Woche · ';
        else if (monday === shiftWeek(thisWeek, 1)) prefix = 'Nächste Woche · ';
        const left = s.getMonth() === e.getMonth() ? `${s.getDate()}.` : `${s.getDate()}. ${MONTHS[s.getMonth()]}`;
        return `${prefix}${left} – ${e.getDate()}. ${MONTHS[e.getMonth()]}`;
    }

    /* ---------- Wochenplan ---------- */

    function getPlan() {
        const plan = readJson(KEYS.plan, {});
        return plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : {};
    }

    function savePlan(plan) {
        /* leere Tage nicht speichern */
        Object.keys(plan).forEach(k => { if (!Array.isArray(plan[k]) || !plan[k].length) delete plan[k]; });
        writeJson(KEYS.plan, plan);
    }

    /*
     * Umrechnung wie auf der Rezeptseite: Personen-Rezepte nach Personenzahl,
     * Rezepte mit Laib/Blech/Stück nach dieser Anzahl.
     * Ist assets/scripts/portionen.js (KPPortionen) geladen, wird dessen Rechnung benutzt.
     */
    function portionen() {
        return window.KPPortionen || null;
    }

    function planArt(recipe) {
        return recipe && recipe.portionsEinheit ? 'stueck' : 'personen';
    }

    function defaultMenge(recipe) {
        if (planArt(recipe) === 'stueck') {
            const kp = portionen();
            return kp ? kp.standard(recipe) || 1 : Number(recipe.portionen) || 1;
        }
        return getPersonen();
    }

    function factorFor(entry, recipe) {
        const menge = Number(entry.menge) || defaultMenge(recipe);
        const kp = portionen();
        if (kp) return kp.faktor(recipe, menge);
        return menge / (Number(recipe.portionen) || 1);
    }

    function mengeLabel(recipe, menge) {
        const kp = portionen();
        if (kp) return kp.beschriftung(recipe, menge);
        if (planArt(recipe) === 'stueck') return `${menge} ${recipe.portionsEinheit}`;
        return `${menge} ${menge === 1 ? 'Person' : 'Personen'}`;
    }

    function weekEntries(monday, plan) {
        plan = plan || getPlan();
        const out = [];
        weekDays(monday).forEach(day => {
            (plan[day.key] || []).forEach((entry, index) => {
                const recipe = BY_ID.get(entry.id);
                if (recipe) out.push({ day, entry, index, recipe });
            });
        });
        return out;
    }

    /* ---------- Zutaten verstehen ---------- */

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

    function parseNumber(text) {
        let t = String(text || '').replace(/ca\.?/gi, '').trim();
        if (!t) return null;
        /* Spannen wie "1–2" oder "150-200": den größeren Wert nehmen, damit genug da ist. */
        const parts = t.split(/\s*[–-]\s*/);
        if (parts.length > 1) t = parts[parts.length - 1];
        let value = 0;
        let found = false;
        const frac = t.match(/[½¼¾⅓⅔⅛]/);
        if (frac) { value += FRACTIONS[frac[0]]; found = true; t = t.replace(frac[0], ''); }
        const slash = t.match(/(\d+)\s*\/\s*(\d+)/);
        if (slash) { value += Number(slash[1]) / Number(slash[2]); found = true; t = t.replace(slash[0], ''); }
        const num = t.match(/\d+(?:[.,]\d+)?/);
        if (num) { value += Number(num[0].replace(',', '.')); found = true; }
        return found ? value : null;
    }

    const UNIT_ALIASES = {
        '': 'Stück', 'stk': 'Stück', 'stück': 'Stück',
        'pck.': 'Päckchen', 'pck': 'Päckchen', 'packung': 'Päckchen', 'päckchen': 'Päckchen',
        'kleines stück': 'Stück'
    };

    function normUnit(unit) {
        const u = String(unit || '').trim();
        const key = u.toLowerCase();
        return Object.prototype.hasOwnProperty.call(UNIT_ALIASES, key) ? UNIT_ALIASES[key] : u;
    }

    /* Grundeinheit, damit sich g/kg und ml/l zusammenrechnen lassen. */
    function toBase(amount, unit) {
        const u = String(unit || '').toLowerCase();
        if (u === 'kg') return { amount: amount * 1000, unit: 'g' };
        if (u === 'l') return { amount: amount * 1000, unit: 'ml' };
        return { amount, unit: normUnit(unit) };
    }

    const CAT = {
        gemuese: 'Obst & Gemüse',
        fleisch: 'Fleisch & Fisch',
        kuehl: 'Kühlregal',
        brot: 'Brot & Backwaren',
        trocken: 'Vorratsschrank',
        gewuerz: 'Gewürze & Kräuter',
        tk: 'Tiefkühl',
        sonst: 'Sonstiges'
    };
    const CATEGORY_ORDER = [CAT.gemuese, CAT.fleisch, CAT.kuehl, CAT.brot, CAT.trocken, CAT.gewuerz, CAT.tk, CAT.sonst];

    /*
     * Regeln: Suchmuster (auf normalisiertem Namen) → einheitlicher Name + Abteilung im Laden.
     * Die Reihenfolge ist wichtig: spezielle Begriffe zuerst (Paprikapulver vor Paprika).
     */
    const RULES = [
        [/^(lauwarmes |kaltes |etwas )?wasser\b|gurkenwasser|dosieren|geschmack|belieben/, null],
        [/tk-lachs|lachs/, 'Lachs', CAT.fleisch],
        [/seelachs/, 'Seelachsfilet', CAT.fleisch],
        [/kabeljau/, 'Kabeljaufilet', CAT.fleisch],
        [/haehnchen/, 'Hähnchenbrust', CAT.fleisch],
        [/pute/, 'Putenbrust', CAT.fleisch],
        [/rinderhack/, 'Rinderhackfleisch', CAT.fleisch],
        [/hackfleisch/, 'Hackfleisch', CAT.fleisch],
        [/schweinefilet/, 'Schweinefilet', CAT.fleisch],
        [/bacon/, 'Bacon', CAT.fleisch],
        [/speck/, 'Speck', CAT.fleisch],
        [/salami/, 'Salami', CAT.fleisch],
        [/kochschinken|schinken/, 'Kochschinken', CAT.fleisch],
        [/kasseler/, 'Kasseler', CAT.fleisch],
        [/pesto/, 'Pesto', CAT.trocken],
        [/kaesekrainer/, 'Käsekrainer', CAT.fleisch],

        [/paprikapulver|paprika,? edelsuess/, 'Paprikapulver', CAT.gewuerz, 'gewuerz'],
        [/knoblauchpulver/, 'Knoblauchpulver', CAT.gewuerz, 'gewuerz'],
        [/currypulver|^curry/, 'Currypulver', CAT.gewuerz, 'gewuerz'],
        [/cayenne/, 'Cayennepfeffer', CAT.gewuerz, 'gewuerz'],
        [/pfeffer/, 'Pfeffer', CAT.gewuerz],
        [/meersalz|^salz/, 'Salz', CAT.gewuerz],
        [/muskat/, 'Muskat', CAT.gewuerz, 'gewuerz'],
        [/majoran/, 'Majoran', CAT.gewuerz, 'gewuerz'],
        [/zimt/, 'Zimt', CAT.gewuerz, 'gewuerz'],
        [/kuemmel/, 'Kümmel', CAT.gewuerz, 'gewuerz'],
        [/garam masala/, 'Garam Masala', CAT.gewuerz, 'gewuerz'],
        [/oregano/, 'Oregano', CAT.gewuerz, 'gewuerz'],
        [/thymian/, 'Thymian', CAT.gewuerz, 'gewuerz'],
        [/rosmarin/, 'Rosmarin', CAT.gewuerz, 'gewuerz'],
        [/italienische kraeuter/, 'Italienische Kräuter', CAT.gewuerz, 'gewuerz'],
        [/graf koks|rauchige drecksau/, 'Grillgewürz', CAT.gewuerz, 'gewuerz'],
        [/gemahlener ingwer/, 'Ingwer', CAT.gewuerz, 'gewuerz'],
        [/^(etwas )?chili$/, 'Chili', CAT.gewuerz, 'gewuerz'],
        [/petersilie/, 'Petersilie', CAT.gewuerz, 'kraeuter'],
        [/schnittlauch/, 'Schnittlauch', CAT.gewuerz, 'kraeuter'],
        [/salbei/, 'Salbei', CAT.gewuerz, 'kraeuter'],
        [/gehackte kraeuter|^kraeuter/, 'Kräuter', CAT.gewuerz, 'kraeuter'],

        [/fruehlingszwiebel/, 'Frühlingszwiebeln', CAT.gemuese],
        [/roestzwiebel/, 'Röstzwiebeln', CAT.trocken],
        [/zwiebel/, 'Zwiebeln', CAT.gemuese],
        [/knoblauch/, 'Knoblauch', CAT.gemuese],
        [/kartoffel/, 'Kartoffeln', CAT.gemuese],
        [/moehre/, 'Möhren', CAT.gemuese],
        [/zucchini/, 'Zucchini', CAT.gemuese],
        [/getrocknete tomaten/, 'Getrocknete Tomaten', CAT.trocken],
        [/passierte tomaten|geschaelte tomaten|dosentomaten/, 'Dosentomaten', CAT.trocken],
        [/tomatenmark/, 'Tomatenmark', CAT.trocken],
        [/tomate/, 'Tomaten', CAT.gemuese],
        [/paprika/, 'Paprika', CAT.gemuese],
        [/chilischote/, 'Chilischote', CAT.gemuese],
        [/blumenkohl/, 'Blumenkohl', CAT.gemuese],
        [/brokkoli/, 'Brokkoli', CAT.gemuese],
        [/kohlrabi/, 'Kohlrabi', CAT.gemuese],
        [/spitzkohl/, 'Spitzkohl', CAT.gemuese],
        [/weisskohl/, 'Weißkohl', CAT.gemuese],
        [/rotkohl/, 'Rotkohl', CAT.gemuese],
        [/lauch/, 'Lauch', CAT.gemuese],
        [/kuerbis/, 'Hokkaido-Kürbis', CAT.gemuese],
        [/champignon/, 'Champignons', CAT.gemuese],
        [/salatgurke/, 'Salatgurke', CAT.gemuese],
        [/gewuerzgurke/, 'Gewürzgurken', CAT.trocken],
        [/avocado/, 'Avocado', CAT.gemuese],
        [/ingwer/, 'Ingwer', CAT.gemuese],
        [/aepfel|apfel/, 'Äpfel', CAT.gemuese],
        [/birne/, 'Birnen', CAT.gemuese],
        [/aprikose/, 'Aprikosen', CAT.gemuese],
        [/ananas/, 'Ananas', CAT.gemuese],
        [/limettensaft/, 'Limettensaft', CAT.trocken],
        [/zitronensaft/, 'Zitronensaft', CAT.kuehl],
        [/zitrone/, 'Zitrone', CAT.gemuese],
        [/spinat/, 'Spinat', CAT.tk],
        [/erbsen/, 'Erbsen', CAT.tk],
        [/edamame/, 'Edamame', CAT.tk],

        [/eigelb|\bei(er)?\b/, 'Eier', CAT.kuehl],
        [/buttermilch/, 'Buttermilch', CAT.kuehl],
        [/milch/, 'Milch', CAT.kuehl],
        [/butterschmalz/, 'Butterschmalz', CAT.kuehl],
        [/kraeuterbutter/, 'Kräuterbutter', CAT.kuehl],
        [/butter(?!milch)/, 'Butter', CAT.kuehl],
        [/kraeuterfrischkaese/, 'Kräuterfrischkäse', CAT.kuehl],
        [/koerniger frischkaese/, 'Körniger Frischkäse', CAT.kuehl],
        [/frischkaese/, 'Frischkäse', CAT.kuehl],
        [/quark/, 'Quark', CAT.kuehl],
        [/skyr/, 'Skyr', CAT.kuehl],
        [/joghurt/, 'Joghurt', CAT.kuehl],
        [/creme fraiche/, 'Crème fraîche', CAT.kuehl],
        [/sahne|kochcreme/, 'Sahne', CAT.kuehl],
        [/ricotta/, 'Ricotta', CAT.kuehl],
        [/mozzarella/, 'Mozzarella', CAT.kuehl],
        [/parmesan/, 'Parmesan', CAT.kuehl],
        [/cheddar/, 'Cheddar', CAT.kuehl],
        [/kaese|gouda|emmentaler/, 'Käse', CAT.kuehl],
        [/tortellini/, 'Tortellini', CAT.kuehl],
        [/filoteig|fruehlingsrollen/, 'Teigblätter', CAT.kuehl],

        [/toast/, 'Toastbrot', CAT.brot],
        [/broetchen/, 'Brötchen', CAT.brot],

        [/dinkelmehl/, 'Dinkelmehl', CAT.trocken],
        [/roggenmehl/, 'Roggenmehl', CAT.trocken],
        [/mehl/, 'Mehl', CAT.trocken],
        [/speisestaerke/, 'Speisestärke', CAT.trocken],
        [/vanillezucker/, 'Vanillezucker', CAT.trocken],
        [/puderzucker/, 'Puderzucker', CAT.trocken],
        [/zucker/, 'Zucker', CAT.trocken],
        [/agavendicksaft/, 'Agavendicksaft', CAT.trocken],
        [/backpulver/, 'Backpulver', CAT.trocken],
        [/hefe/, 'Trockenhefe', CAT.trocken],
        [/haferflocken/, 'Haferflocken', CAT.trocken],
        [/paniermehl|panko/, 'Paniermehl', CAT.trocken],
        [/lasagneplatten/, 'Lasagneplatten', CAT.trocken],
        [/nudeln|spaghetti|tagliatelle/, 'Nudeln', CAT.trocken],
        [/risottoreis/, 'Risottoreis', CAT.trocken],
        [/reis/, 'Reis', CAT.trocken],
        [/gemuesebruehe|bruehe/, 'Gemüsebrühe', CAT.trocken],
        [/sesamoel/, 'Sesamöl', CAT.trocken],
        [/olivenoel/, 'Olivenöl', CAT.trocken],
        [/oel\b|oelspray|pflanzenoel/, 'Speiseöl', CAT.trocken],
        [/essig/, 'Essig', CAT.trocken],
        [/hoisin/, 'Hoisin-Sauce', CAT.trocken],
        [/soja/, 'Sojasauce', CAT.trocken],
        [/senf/, 'Senf', CAT.trocken],
        [/ketchup/, 'Ketchup', CAT.trocken],
        [/honig/, 'Honig', CAT.trocken],
        [/erdnussbutter/, 'Erdnussbutter', CAT.trocken],
        [/erdnuesse/, 'Erdnüsse', CAT.trocken],
        [/haselnuess/, 'Gemahlene Haselnüsse', CAT.trocken],
        [/walnuess/, 'Walnüsse', CAT.trocken],
        [/sonnenblumenkerne/, 'Sonnenblumenkerne', CAT.trocken],
        [/sesam/, 'Sesam', CAT.trocken],
        [/rosinen/, 'Rosinen', CAT.trocken],
        [/weisswein/, 'Weißwein', CAT.sonst],
        [/mineralwasser/, 'Mineralwasser', CAT.sonst],
        [/obstsaft/, 'Obstsaft', CAT.sonst]
    ];

    /* Beschreibende Wörter, die für den Einkauf egal sind. */
    function cleanName(name) {
        return String(name || '')
            .replace(/\([^)]*\)/g, '')
            .replace(/[„“"]/g, '')
            .replace(/^optional:\s*/i, '')
            .replace(/^(etwas|ca\.)\s+/i, '')
            .replace(/\s+(nach (geschmack|belieben)|zum (bestäuben|bestreichen|abschmecken|einweichen|vorkochen.*)|für die form|zimmerwarm|vorsichtig dosieren|ohne haut)\b.*$/i, '')
            .replace(/,.*$/, '')
            .trim();
    }

    function stripParens(text) {
        return String(text || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    }

    /* "Salz, Pfeffer und Muskat" ohne Menge → drei einzelne Zutaten. */
    function splitList(zutat) {
        const whole = stripParens(zutat.name || zutat.text).replace(/^(etwas|optional:)\s+/i, '');
        const hasAmount = parseNumber(zutat.menge) !== null;
        if (!hasAmount && /,|\s(und|&)\s/.test(whole)) {
            const pieces = whole
                .split(/\s*,\s*|\s+und\/oder\s+|\s+und\s+|\s*&\s*/)
                .map(p => p.trim())
                .filter(Boolean);
            if (pieces.length > 1 && pieces.every(p => p.split(' ').length <= 3)) return pieces;
        }
        return [whole];
    }

    function classify(name) {
        const key = normalize(stripParens(name));
        for (const [re, canonical, category, group] of RULES) {
            if (re.test(key)) {
                if (canonical === null) return null;
                return { name: canonical, category, group: group || '' };
            }
        }
        const short = cleanName(name).replace(/^(frische[rsn]?|kleine[rsn]?|große[rsn]?|mittelgroße[rsn]?|gehackte[rsn]?|geriebene[rsn]?|zarte[rsn]?)\s+/i, '') || name;
        const pretty = short.charAt(0).toUpperCase() + short.slice(1);
        return { name: pretty, category: CAT.sonst, group: '' };
    }

    /*
     * Löffel und Prisen sind für den Einkauf nur ungefähr wichtig:
     * - gibt es auch g oder ml, werden sie grob dazugerechnet (TL ≈ 5, EL ≈ 15),
     * - sonst als Löffel zusammengefasst.
     * g und ml werden zusammengelegt (bei Sahne, Joghurt usw. fast gleich).
     */
    const SPOON_TL = { 'TL': 1, 'EL': 3, 'Prise': 0.1, 'Msp.': 0.1 };

    function mergeUnits(sums, keepSpoons) {
        const map = new Map(sums);
        let tl = 0;
        Object.keys(SPOON_TL).forEach(u => {
            if (map.has(u)) { tl += map.get(u) * SPOON_TL[u]; map.delete(u); }
        });
        const g = map.get('g') || 0;
        const ml = map.get('ml') || 0;
        if (g && ml) {
            map.delete('g'); map.delete('ml');
            map.set(g >= ml ? 'g' : 'ml', g + ml);
        }
        const weightUnit = map.has('g') ? 'g' : map.has('ml') ? 'ml' : null;
        if (tl) {
            if (weightUnit && !keepSpoons) map.set(weightUnit, map.get(weightUnit) + tl * 5);
            else if (tl >= 3) map.set('EL', tl / 3);
            else map.set('TL', tl);
        }
        return [...map.entries()].map(([unit, amount]) => ({ unit, amount }));
    }

    /* ---------- Vorrat ---------- */

    /* Welche Zutaten deckt ein Eintrag im Grundvorrat ab? */
    const STOCK_COVERS = {
        'Kräuter und Gewürze': item => item.group === 'gewuerz',
        'Tiefgekühlte Kräuter': item => item.group === 'kraeuter',
        'Milch oder Pflanzendrink': item => item.name === 'Milch',
        'Butter oder Margarine': item => item.name === 'Butter',
        'Sahne oder Kochcreme': item => item.name === 'Sahne',
        'Speiseöl': item => item.name === 'Speiseöl',
        'Brot oder Brötchen': item => item.name === 'Brötchen',
        'Hülsenfrüchte': () => false,
        /* Diese Sammelbegriffe sind zu allgemein, um daraus etwas sicher abzuleiten. */
        'Fleisch oder Geflügel': () => false,
        'Fisch': () => false,
        'Gemüsemischung': () => false,
        'Beeren': () => false,
        'Vorgekochte Reste': () => false
    };

    /* Gespeicherte Vorrats-Einträge wie auf vorrat.html: [{ name, amount, unit, custom }] oder null. */
    function getStockDetails() {
        let details = readJson(KEYS.vorratDetails, null);
        if (!Array.isArray(details)) {
            const names = readJson(KEYS.vorrat, null);
            details = Array.isArray(names) ? names.map(name => ({ name })) : null;
        }
        if (!details) return null;
        return details.filter(d => d && typeof d.name === 'string' && d.name.trim());
    }

    function saveStockDetails(details) {
        writeJson(KEYS.vorratDetails, details);
        writeJson(KEYS.vorrat, details.map(d => d.name));
    }

    function getStock(details) {
        details = details || getStockDetails();
        if (!details) return null;
        return details.map((d, index) => {
            const cls = classify(cleanName(d.name)) || { name: d.name };
            return {
                index,
                name: d.name,
                canonical: cls.name,
                amount: parseNumber(d.amount),
                unit: d.unit || '',
                custom: !!d.custom
            };
        });
    }

    function findStock(item, stock) {
        if (!stock) return null;
        for (const s of stock) {
            const rule = STOCK_COVERS[s.name];
            if (rule ? rule(item) : s.canonical === item.name) return s;
        }
        /* eigene Einträge: lockerer Vergleich ("Couscous" ↔ "Couscous, fein") */
        const key = normalize(item.name);
        return stock.find(s => {
            const sk = normalize(s.name);
            return s.custom && sk.length > 3 && (key.includes(sk) || sk.includes(key));
        }) || null;
    }

    /* ---------- Vorrat ändern: Einkauf einräumen, Gekochtes abziehen ---------- */

    /* Menge aus Grundeinheit (g/ml/Stück …) in die Einheit des Vorrats-Eintrags umrechnen. */
    function fromBase(amount, baseUnit, stockUnit) {
        const target = toBase(1, stockUnit);
        if (target.unit !== baseUnit) return null;
        return amount / target.amount;
    }

    function stockNumber(n) {
        const r = n >= 10 ? Math.round(n) : Math.round(n * 100) / 100;
        return String(r).replace('.', ',');
    }

    /* Gekaufte Menge so runden wie auf der Einkaufsliste angezeigt.
       Löffelmengen (TL, EL, Prise) kauft man nicht – dann ohne Menge (= "ist da"). */
    const SPOON_UNITS = ['TL', 'EL', 'Prise', 'Prisen', 'Msp.'];

    function roundBought(a) {
        if (!a || SPOON_UNITS.includes(a.unit)) return null;
        let amount = a.amount;
        if (a.unit === 'g' || a.unit === 'ml') amount = amount >= 20 ? Math.ceil(amount / 5) * 5 : Math.ceil(amount);
        else amount = Math.ceil(amount - 0.01);
        return { amount, unit: a.unit };
    }

    /* Neue Einträge: große Mengen als kg / l, sonst wie gekauft. */
    function storeAmount(a) {
        if (a.unit === 'g' && a.amount >= 1000) return { amount: stockNumber(a.amount / 1000), unit: 'kg' };
        if (a.unit === 'ml' && a.amount >= 1000) return { amount: stockNumber(a.amount / 1000), unit: 'l' };
        if (a.unit === 'g' || a.unit === 'ml') return { amount: String(Math.ceil(a.amount)), unit: a.unit };
        return { amount: stockNumber(a.amount), unit: a.unit };
    }

    function snapshot() {
        return {
            vorrat: localStorage.getItem(KEYS.vorrat),
            vorratDetails: localStorage.getItem(KEYS.vorratDetails),
            plan: localStorage.getItem(KEYS.plan),
            einkauf: localStorage.getItem(KEYS.einkauf)
        };
    }

    function restore(snap) {
        if (!snap) return;
        try {
            Object.entries(snap).forEach(([k, v]) => {
                if (v === null) localStorage.removeItem(KEYS[k]); else localStorage.setItem(KEYS[k], v);
            });
        } catch (e) { /* nichts zu tun */ }
    }

    /*
     * Gekaufte Dinge in den Vorrat legen.
     * items: [{ name, amounts: [{ amount, unit }] }] (Mengen in Grundeinheit, wie auf der Einkaufsliste)
     * Rückgabe: [{ name, text }] – was passiert ist.
     */
    function addToStock(items) {
        const details = (getStockDetails() || []).map(d => Object.assign({}, d));
        const changes = [];
        items.forEach(item => {
            const stock = getStock(details);
            const a = roundBought(item.amounts && item.amounts.length === 1 ? item.amounts[0] : null);
            const found = findStock(item, stock);
            if (found) {
                const d = details[found.index];
                const add = a ? fromBase(a.amount, a.unit, d.unit) : null;
                if (add !== null && found.amount !== null) {
                    d.amount = stockNumber(found.amount + add);
                    changes.push({ name: d.name, text: `jetzt ${d.amount} ${d.unit}` });
                } else if (add !== null && !String(d.amount || '').trim()) {
                    d.amount = stockNumber(add);
                    changes.push({ name: d.name, text: `jetzt ${d.amount} ${d.unit}` });
                } else {
                    changes.push({ name: d.name, text: 'war schon im Vorrat' });
                }
                return;
            }
            const neu = a ? storeAmount(a) : { amount: '', unit: 'Stück' };
            details.push({ name: item.name, amount: neu.amount, unit: neu.unit, custom: true });
            changes.push({ name: item.name, text: neu.amount ? `neu: ${neu.amount} ${neu.unit}` : 'neu im Vorrat' });
        });
        saveStockDetails(details);
        return changes;
    }

    /*
     * Ein Rezept wurde gekocht: Mengen aus dem Vorrat abziehen.
     * Nur Einträge mit bekannter Menge und passender Einheit werden verringert.
     * Rückgabe: [{ name, text }]
     */
    function removeFromStock(recipe, factor) {
        const details = getStockDetails();
        if (!details) return [];
        const copy = details.map(d => Object.assign({}, d));
        const changes = [];
        const used = new Map();
        (recipe.zutaten || []).forEach(zutat => {
            const amount = parseNumber(zutat.menge);
            const pieces = splitList(zutat);
            if (amount === null || pieces.length !== 1) return;
            const cls = classify(pieces[0]);
            if (!cls) return;
            const base = toBase(amount * (factor || 1), zutat.einheit);
            const found = findStock({ name: cls.name, group: cls.group, category: cls.category }, getStock(copy));
            if (!found || found.amount === null) return;
            const take = fromBase(base.amount, base.unit, copy[found.index].unit);
            if (take === null) return;
            const key = found.index;
            used.set(key, (used.get(key) || 0) + take);
        });
        const remove = [];
        used.forEach((take, index) => {
            const d = copy[index];
            const left = Math.max(0, parseNumber(d.amount) - take);
            if (left <= 0.0001 && d.custom) {
                remove.push(index);
                changes.push({ name: d.name, text: 'aufgebraucht' });
            } else {
                d.amount = stockNumber(left);
                changes.push({ name: d.name, text: `noch ${d.amount} ${d.unit}` });
            }
        });
        const kept = copy.filter((d, i) => !remove.includes(i));
        saveStockDetails(kept);
        return changes;
    }

    /*
     * Wie viel von einem Rezept ist schon im Vorrat? Gewürze zählen nicht mit,
     * die hat man meistens. Rückgabe: { have, total, missing: [Namen] }
     */
    function stockCoverage(recipe, stock) {
        stock = stock === undefined ? getStock() : stock;
        const seen = new Set();
        const out = { have: 0, total: 0, missing: [], haveNames: [] };
        (recipe.zutaten || []).forEach(zutat => {
            splitList(zutat).forEach(piece => {
                const cls = classify(piece);
                if (!cls || cls.category === CAT.gewuerz || seen.has(cls.name)) return;
                seen.add(cls.name);
                out.total++;
                if (stock && findStock({ name: cls.name, group: cls.group, category: cls.category }, stock)) { out.have++; out.haveNames.push(cls.name); }
                else out.missing.push(cls.name);
            });
        });
        return out;
    }

    /* Im Wochenplan als gekocht markieren (heute zuerst, sonst ein anderer Tag dieser Woche). */
    function markCooked(recipeId, menge) {
        const plan = getPlan();
        const today = isoDate(new Date());
        const days = [today, ...weekDays(currentWeekOf(today)).map(d => d.key).filter(k => k !== today)];
        for (const key of days) {
            const entry = (plan[key] || []).find(e => e.id === recipeId && !e.gekocht);
            if (entry) {
                entry.gekocht = today;
                savePlan(plan);
                return key;
            }
        }
        return null;
    }

    function currentWeekOf(iso) {
        return isoDate(mondayOf(parseIso(iso)));
    }

    /* ---------- Regelmäßige Einkäufe erkennen ---------- */

    function daysBetween(a, b) {
        return Math.round((parseIso(b) - parseIso(a)) / 86400000);
    }

    function formatDay(iso) {
        const d = parseIso(iso);
        return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    }

    /* Kauf merken (ein Eintrag pro Tag) oder beim Abwählen wieder entfernen. */
    function recordPurchase(name, bought, day) {
        const key = normalize(name);
        if (!key) return;
        day = day || isoDate(new Date());
        const all = readJson(KEYS.kaeufe, {}) || {};
        const entry = all[key] || { name, daten: [] };
        entry.name = name;
        if (bought) {
            if (!entry.daten.includes(day)) entry.daten.push(day);
            entry.daten.sort();
            delete entry.spaeter;
        } else {
            entry.daten = entry.daten.filter(d => d !== day);
        }
        entry.daten = entry.daten.slice(-12);
        if (entry.daten.length) all[key] = entry; else delete all[key];
        writeJson(KEYS.kaeufe, all);
    }

    /* Rhythmus: Abstand zwischen den Käufen (Käufe in derselben Woche zählen als einer). */
    function rhythmOf(entry) {
        const dates = [];
        (entry.daten || []).forEach(d => {
            if (!dates.length || daysBetween(dates[dates.length - 1], d) >= 4) dates.push(d);
        });
        if (dates.length < 2) return null;
        const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
        const every = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        if (every < 5) return null;
        const last = dates[dates.length - 1];
        return { every, last, due: isoDate(addDays(parseIso(last), every)), count: dates.length };
    }

    function rhythmLabel(days) {
        if (days % 7 === 0 || days >= 12) {
            const weeks = Math.round(days / 7);
            return weeks === 1 ? 'jede Woche' : `alle ${weeks} Wochen`;
        }
        return `alle ${days} Tage`;
    }

    /*
     * Was ist bald wieder fällig? (3 Tage vorher erinnern)
     * Rückgabe: [{ key, name, every, label, last, lastLabel, due }]
     */
    function dueReminders(today) {
        today = today || isoDate(new Date());
        const all = readJson(KEYS.kaeufe, {}) || {};
        const out = [];
        Object.entries(all).forEach(([key, entry]) => {
            const r = rhythmOf(entry);
            if (!r) return;
            if (entry.spaeter && entry.spaeter > today) return;
            if (daysBetween(today, r.due) > 3) return;
            out.push({ key, name: entry.name, every: r.every, label: rhythmLabel(r.every), last: r.last, lastLabel: formatDay(r.last), due: r.due });
        });
        return out.sort((a, b) => a.due.localeCompare(b.due));
    }

    /* "Hab noch genug": eine Woche lang (oder ein Drittel des Rhythmus) nicht mehr fragen. */
    function snoozeReminder(key, today) {
        today = today || isoDate(new Date());
        const all = readJson(KEYS.kaeufe, {}) || {};
        const entry = all[key];
        if (!entry) return;
        const r = rhythmOf(entry);
        const days = r ? Math.max(4, Math.min(7, Math.round(r.every / 3))) : 7;
        entry.spaeter = isoDate(addDays(parseIso(today), days));
        writeJson(KEYS.kaeufe, all);
    }

    /* ---------- Einkaufsliste ---------- */

    function itemKey(name) {
        return normalize(name);
    }

    /*
     * Baut aus dem Wochenplan die Einkaufsliste.
     * Ergebnis: { items: [...], recipesCount, stockKnown }
     * Jedes item: { key, name, category, amounts: [{amount, unit}], unknownAmount, recipes: [Titel], stock, remaining }
     */
    function buildShoppingList(monday, options) {
        options = options || {};
        const plan = options.plan || getPlan();
        const stock = options.stock !== undefined ? options.stock : getStock();
        /* schon gekochte Gerichte brauchen nichts mehr vom Einkauf */
        const entries = weekEntries(monday, plan).filter(e => !e.entry.gekocht);
        const map = new Map();

        entries.forEach(({ entry, recipe }) => {
            const factor = factorFor(entry, recipe);
            (recipe.zutaten || []).forEach(zutat => {
                const baseAmount = parseNumber(zutat.menge);
                splitList(zutat).forEach((piece, i, all) => {
                    const cls = classify(piece);
                    if (!cls) return;
                    const key = itemKey(cls.name);
                    if (!map.has(key)) {
                        map.set(key, { key, name: cls.name, category: cls.category, group: cls.group, sums: new Map(), unknownAmount: false, recipes: [] });
                    }
                    const item = map.get(key);
                    if (!item.recipes.includes(recipe.titel)) item.recipes.push(recipe.titel);
                    if (baseAmount === null || all.length > 1) {
                        item.unknownAmount = true;
                        return;
                    }
                    const base = toBase(baseAmount * factor, zutat.einheit);
                    item.sums.set(base.unit, (item.sums.get(base.unit) || 0) + base.amount);
                });
            });
        });

        const items = [...map.values()].map(item => {
            const amounts = mergeUnits(item.sums, item.category === CAT.gewuerz);
            const out = { key: item.key, name: item.name, category: item.category, group: item.group, amounts, unknownAmount: item.unknownAmount && !amounts.length, recipes: item.recipes, stock: null, remaining: null };
            const s = findStock(out, stock);
            if (s) {
                out.stock = s;
                /* Menge im Vorrat bekannt? Dann prüfen, ob sie reicht. */
                if (s.amount !== null && s.amount !== undefined && amounts.length === 1) {
                    const have = toBase(s.amount, s.unit);
                    const need = amounts[0];
                    if (have.unit === need.unit && need.amount > have.amount) {
                        out.remaining = { unit: need.unit, amount: need.amount - have.amount };
                    }
                }
            }
            return out;
        });

        items.sort((a, b) => {
            const c = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
            return c || a.name.localeCompare(b.name, 'de');
        });

        return { items, recipesCount: entries.length, stockKnown: !!stock };
    }

    /* ---------- Mengen schön anzeigen ---------- */

    const COUNT_UNITS = ['Stück', 'Päckchen', 'Kugel', 'Bund', 'Scheiben', 'Dose', 'Glas', 'Flasche'];

    function niceNumber(n) {
        const whole = Math.floor(n);
        const rest = n - whole;
        const fracs = [[0.25, '¼'], [0.5, '½'], [0.75, '¾']];
        for (const [v, s] of fracs) {
            if (Math.abs(rest - v) < 0.04) return whole ? `${whole}${s}` : s;
        }
        if (rest < 0.04) return String(whole);
        return String(Math.round(n * 10) / 10).replace('.', ',');
    }

    function formatAmount(a) {
        let { amount, unit } = a;
        if (unit === 'g' && amount >= 1000) { amount /= 1000; unit = 'kg'; }
        else if (unit === 'ml' && amount >= 1000) { amount /= 1000; unit = 'l'; }
        else if (unit === 'g' || unit === 'ml') { amount = amount >= 20 ? Math.ceil(amount / 5) * 5 : Math.ceil(amount); }
        else if (COUNT_UNITS.includes(unit)) { amount = Math.ceil(amount - 0.01); }
        else if (unit === 'TL' || unit === 'EL') { amount = Math.max(0.5, Math.round(amount * 2) / 2); }
        const text = niceNumber(amount);
        if (unit === 'Stück') return text;
        return `${text} ${unit}`;
    }

    function formatAmounts(item) {
        if (item.remaining) return formatAmount(item.remaining);
        if (!item.amounts.length) return '';
        return item.amounts.map(formatAmount).join(' + ');
    }

    /* ---------- Einkauf-Status (abgehakt usw.) ---------- */

    function getShopState(monday) {
        const all = readJson(KEYS.einkauf, {});
        const s = (all && all[monday]) || {};
        return {
            gekauft: Array.isArray(s.gekauft) ? s.gekauft : [],
            habeIch: Array.isArray(s.habeIch) ? s.habeIch : [],
            dochKaufen: Array.isArray(s.dochKaufen) ? s.dochKaufen : [],
            eigene: Array.isArray(s.eigene) ? s.eigene : [],
            eingeraeumt: Array.isArray(s.eingeraeumt) ? s.eingeraeumt : []
        };
    }

    function saveShopState(monday, state) {
        const all = readJson(KEYS.einkauf, {}) || {};
        all[monday] = state;
        /* alte Wochen (älter als 8 Wochen) aufräumen */
        const limit = shiftWeek(isoDate(mondayOf(new Date())), -8);
        Object.keys(all).forEach(k => { if (k < limit) delete all[k]; });
        writeJson(KEYS.einkauf, all);
    }

    function esc(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    window.KPPlaner = {
        KEYS, RECIPES, BY_ID, CATEGORY_ORDER,
        readJson, writeJson, esc, normalize,
        getPersonen, setPersonen,
        isoDate, parseIso, mondayOf, currentWeek, setWeek, shiftWeek, weekDays, weekLabel,
        getPlan, savePlan, planArt, defaultMenge, factorFor, mengeLabel, weekEntries,
        parseNumber, classify, splitList, getStock, findStock,
        getStockDetails, saveStockDetails, addToStock, removeFromStock, markCooked, snapshot, restore, stockCoverage,
        recordPurchase, rhythmOf, dueReminders, snoozeReminder,
        buildShoppingList, formatAmount, formatAmounts,
        getShopState, saveShopState
    };
})();
