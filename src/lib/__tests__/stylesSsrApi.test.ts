import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/*
 * Mise en forme de la version serveur (api/_ssr/styles.js, un bloc par type de page, injecté dans le <head>
 * du seul type concerné) et jeu UNIQUE de polices de repli (index.html). Règles verrouillées ici :
 *  - aucun bloc dans index.html (il irait sur toutes les pages) ;
 *  - aucune police web ni @font-face propre à un bloc : seulement les variables du jeu commun ;
 *  - jamais de line-height:normal (les marges ascent/descent des polices de repli l'exploseraient) ;
 *  - pas d'ombre transparente (la marge LCP passe par les métriques du jeu commun, une seule technique) ;
 *  - aucun tiret long dans un texte généré par le CSS (typographie maison).
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));
const INDEX = readFileSync(decodeURIComponent(new URL('../../../index.html', import.meta.url).pathname), 'utf8');
const TYPES = ['article', 'code', 'decision', 'theme', 'jurisprudence', 'guides', 'guide', 'doctrine', 'codes'];

describe('blocs de mise en forme de la version serveur (api/_ssr/styles.js)', () => {
    it('un bloc par type de page, rendu dans une balise <style> identifiée ; rien pour un type inconnu', async () => {
        const { STYLES_SSR, styleSsr } = await charger('_ssr/styles.js');
        expect(Object.keys(STYLES_SSR).sort()).toEqual([...TYPES].sort());
        for (const t of TYPES) {
            expect(styleSsr(t).startsWith(`<style id="ssr-style-${t}">`)).toBe(true);
            expect(styleSsr(t).endsWith('</style>')).toBe(true);
            // Accolades équilibrées : un bloc tronqué casserait tout ce qui suit dans le <head>.
            const css: string = STYLES_SSR[t];
            expect((css.match(/\{/g) || []).length).toBe((css.match(/\}/g) || []).length);
            expect(css).not.toContain('</style');
        }
        expect(styleSsr('home')).toBe('');
    });

    it('chaque bloc met en forme le cadre de sa page par la classe de type, sans :has()', async () => {
        // Firefox avant 121 et Safari avant 15.4 rejettent toute règle contenant :has() : le cadre de la page
        // passe par #ssr-keep.ssr-type-TYPE (classe posée par render.js, recopiée par src/index.tsx).
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        for (const t of TYPES) {
            expect(STYLES_SSR[t], t).toMatch(new RegExp(`(^|\\n)#ssr-keep\\.ssr-type-${t}\\{[^}]*padding:0`));
            expect(STYLES_SSR[t], t).not.toMatch(/#ssr-keep:has/);
        }
    });

    it('la racine servie porte la classe de son type, que src/index.tsx recopie sur #ssr-keep', async () => {
        const api = await charger('render.js');
        const pages: Record<string, string> = {
            article: api.buildArticleBody({ slug: 'code-x', title: 'X' }, { slug: 'a', num: 'Article 1' }, '<p>T</p>', [], [], {}),
            code: api.buildCodeBody({ slug: 'code-x', title: 'X', category: 'code' }, [], []),
            decision: api.buildDecisionBody({ slug: 'd', reference: 'R' }, [], []),
            theme: api.buildThemeBody({ theme: { label: 'L', h1: 'H', chapo: 'C' }, decisions: [] }),
            jurisprudence: api.buildJurisprudenceBody([]),
            guides: api.buildGuidesBody([]),
            guide: api.buildGuideBody({ title: 'G', content_html: '' }),
            doctrine: api.buildDoctrineBody({ objet: 'O' }),
            codes: api.buildCodesBody([], []),
        };
        expect(Object.keys(pages).sort()).toEqual([...TYPES].sort());
        for (const [t, html] of Object.entries(pages)) expect(html, t).toMatch(new RegExp(`^<div id="ssr-content" class="ssr-prerender ssr-type-${t}">`));
        // Accueil : aucun bloc, aucune classe (cadre générique d'index.html).
        expect(api.buildHomeBody([])).toMatch(/^<div id="ssr-content" class="ssr-prerender">/);
        const INDEX_TSX = readFileSync(decodeURIComponent(new URL('../../index.tsx', import.meta.url).pathname), 'utf8');
        expect(INDEX_TSX).toMatch(/c\.startsWith\('ssr-type-'\)\) keep\.classList\.add\(c\)/);
    });

    /*
     * Autonomie des blocs : les règles génériques « #ssr-keep … » d'index.html ne valent plus sur une page typée.
     * Ce dont les blocs héritaient sans le dire (relevé le 05/10/2026 en retirant ces règles dans le navigateur :
     * couleur des liens, grille du sommaire, police des paragraphes) est porté par le bloc lui-même.
     */
    it('autonomie : liens, sommaire et paragraphes mis en forme par le bloc, pas par index.html', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        const LIENS: Record<string, RegExp> = {
            article: /#ssr-content \.ssr-article a\{color:#047857;text-decoration:none\}/,
            code: /#ssr-content \.ssr-code a\{color:#047857;text-decoration:none;\}/,
            decision: /#ssr-content \.ssr-decision a\{color:#047857;text-decoration:none\}/,
            theme: /#ssr-content \.ssr-theme a\{color:#047857;text-decoration:none;\}/,
            jurisprudence: /#ssr-content \.ssr-jurisprudence a\{color:#047857;text-decoration:none;\}/,
            guides: /#ssr-content \.ssr-ed :where\(a\)\{color:inherit;text-decoration:none\}/,
            guide: /#ssr-content \.ssr-ed :where\(a\)\{color:inherit;text-decoration:none\}/,
            doctrine: /#ssr-content \.ssr-ed :where\(a\)\{color:inherit;text-decoration:none\}/,
            codes: /#ssr-content \.ssr-ed :where\(a\)\{color:inherit;text-decoration:none\}/,
        };
        for (const t of TYPES) expect(STYLES_SSR[t], t).toMatch(LIENS[t]);
        expect(STYLES_SSR.code).toMatch(/\.ssr-toc ul\{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat\(auto-fill,minmax\(150px,1fr\)\);gap:6px 16px;/);
        expect(STYLES_SSR.article).toMatch(/#ssr-content \.ssr-article-body p\{font-family:inherit;/);
    });

    it('impression : chaque bloc a son @media print ; emplacements masqués, badges en noir sur blanc', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        for (const t of TYPES) expect(STYLES_SSR[t], t).toContain('@media print{');
        const impression = (t: string) => (STYLES_SSR[t] as string).split('@media print{')[1];
        // Trait de graisse des titres (-webkit-text-stroke) retiré à l'impression : il dédoublait le texte
        // des titres dans la couche texte du PDF (« GGarde arde à à vue vue »).
        for (const t of TYPES) {
            const blocs = (STYLES_SSR[t] as string).split('@media print{').slice(1);
            expect(blocs.length, t).toBeGreaterThan(0);
            for (const b of blocs) expect(b.startsWith('#ssr-content *{-webkit-text-stroke:0!important}'), t).toBe(true);
        }
        expect(impression('article')).toMatch(/:is\(\.ssr-a-somm,\.ssr-act,\.ssr-citing,\.ssr-artnav,\.ssr-a-tree,\.ssr-ver--vide\)\{display:none!important\}/);
        expect(impression('article')).toMatch(/\.ssr-ah-badge\{background:#fff!important;color:#000!important;border-color:#000!important\}/);
        expect(impression('code')).toMatch(/:is\(\.ssr-st,\.ssr-code__toggle,[^)]*\.ssr-dv__tabs,\.ssr-dv__nav,/);
        expect(impression('code')).toMatch(/\.ssr-tp__nature,[^)]*\)\{background:#fff!important;color:#000!important;/);
        // Titre du texte en tête de l'impression : sans !important, « order:1 » de l'écran (:is(), plus spécifique)
        // l'emportait et le titre sortait APRÈS les articles.
        expect(impression('code')).toMatch(/\.ssr-code__main>h1\{order:0!important;/);
        // Chevrons du fil d'Ariane : print.css rend tous les fonds transparents, le chevron est un fond masqué.
        expect(impression('article')).toMatch(/\.ssr-bc \.ssr-chev\{background:currentColor!important\}/);
        expect(impression('decision')).toMatch(/:is\(\.ssr-dc-gauche,\.ssr-dc-droite,\.ssr-dc-outils\)\{display:none!important\}/);
        expect(impression('decision')).toMatch(/\.ssr-dc-tags li,\.ssr-dc-badge\)\{background:#fff!important;color:#000!important;/);
    });

    /*
     * Feuilles React chargées à la demande (relecture « rendu » du 05/10/2026) : les renvois d'article de
     * legal-content.css et de DecisionPage.css ne sont pas limités à la page React. Arrivés pendant la phase
     * serveur, ils faisaient recouler le texte serveur (CLS 0,028 sur /code/code-penal/art-124 en 1440).
     * Les blocs portent donc leur géométrie FINALE, relue ici dans les feuilles React elles-mêmes.
     */
    it('renvois d’article : géométrie finale de legal-content.css (article, code) et de DecisionPage.css (décision)', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        const lireCss = (chemin: string) => readFileSync(decodeURIComponent(new URL(`../../${chemin}`, import.meta.url).pathname), 'utf8');
        /** Déclarations d'un bloc dont le sélecteur commence exactement par `selecteur`. */
        const bloc = (css: string, selecteur: RegExp) => {
            const m = css.match(new RegExp(selecteur.source + '\\s*\\{([^}]*)\\}'));
            expect(m, String(selecteur)).toBeTruthy();
            return Object.fromEntries(m![1].split(';').map((d) => d.split(':').map((x) => x.trim())).filter((d) => d.length === 2 && d[0]));
        };
        const GEOMETRIE = ['font-weight', 'padding', 'margin', 'border-radius'];
        const GEOMETRIE_APRES = ['content', 'font-size', 'margin-left'];
        const verifier = (cssReact: string, prefixeReact: string, cssSsr: string, prefixeSsr: string) => {
            const lien = bloc(cssReact, new RegExp(`${prefixeReact}\\.article-link,\\s*${prefixeReact}a\\[data-article-id\\]`));
            const apres = bloc(cssReact, new RegExp(`${prefixeReact}\\.article-link::after,\\s*${prefixeReact}a\\[data-article-id\\]::after`));
            const echapper = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const ssr = bloc(cssSsr, new RegExp(echapper(`${prefixeSsr} :is(.article-link,a[data-article-id])`)));
            const ssrApres = bloc(cssSsr, new RegExp(echapper(`${prefixeSsr} :is(.article-link,a[data-article-id])::after`)));
            // Même valeur à l'écriture près (« 0.75em » = « .75em », guillemets simples ou doubles).
            const norme = (v?: string) => v?.replace(/"/g, "'").replace(/(^|[\s(])0\./g, '$1.');
            for (const p of GEOMETRIE) expect(norme(ssr[p]), `${prefixeSsr} ${p}`).toBe(norme(lien[p]));
            for (const p of GEOMETRIE_APRES) expect(norme(ssrApres[p]), `${prefixeSsr}::after ${p}`).toBe(norme(apres[p]));
            expect(ssr['text-decoration']).toBe('none');
            // Pas de fond recopié : la marge LCP étirerait le fond d'un élément « inline ».
            expect(ssr.background).toBeUndefined();
        };
        const legal = lireCss('styles/legal-content.css');
        verifier(legal, '', STYLES_SSR.article, '#ssr-content .ssr-article-body');
        verifier(legal, '', STYLES_SSR.code, '#ssr-content .ssr-code .ssr-ac__body');
        verifier(lireCss('pages/Decision/DecisionPage.css'), '\\.legal-content ', STYLES_SSR.decision, '#ssr-content .ssr-decision .legal-content');
    });

    it('polices : seulement les variables du jeu commun (aucune police web, aucun @font-face propre)', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        for (const t of TYPES) {
            const css: string = STYLES_SSR[t];
            expect(css, t).not.toMatch(/@font-face|@import|fonts\.googleapis|Playfair Display|'Inter'|system-ui/);
            for (const [, pile] of css.matchAll(/font-family:([^;}]+)/g)) {
                expect(pile.trim(), t).toMatch(/^(var\(--ssr-(ui|titre|texte)\)|inherit|'Courier New',monospace)$/);
            }
            for (const [, raccourci] of css.matchAll(/[{;]font:([^;}]+)/g)) {
                expect(raccourci, t).toMatch(/var\(--ssr-(ui|titre|texte)\)$/);
            }
        }
    });

    it('jamais de line-height:normal, d\'ombre transparente ni de tiret long', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        for (const t of TYPES) {
            const css: string = STYLES_SSR[t];
            expect(css, t).not.toMatch(/line-height:\s*normal/);
            expect(css, t).not.toMatch(/text-shadow/);
            expect(css, t).not.toMatch(/[\u2014\u2013]/);
        }
    });
});

describe('index.html : cadre générique et jeu unique de polices', () => {
    it('aucun bloc par type dans la coquille (il pèserait sur toutes les pages)', () => {
        // Racines des gabarits (.ssr-article, .ssr-code…) ; les règles génériques d'avant (.ssr-article-body…) restent.
        expect(INDEX).not.toMatch(/\.ssr-(article|code|decision|theme|jurisprudence|guides?|doctrine|codes|ed)(?![\w-])/);
    });
    it('jeu unique : Lx Inter, Lx Inter Roboto, Lx Playfair, Lx Playfair Noto, Lx Georgia, en polices locales', () => {
        const familles = new Set([...INDEX.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]));
        expect([...familles].sort()).toEqual(['Lx Georgia', 'Lx Inter', 'Lx Inter Roboto', 'Lx Playfair', 'Lx Playfair Noto']);
        for (const [regle] of INDEX.matchAll(/@font-face\{[^}]*\}/g)) {
            expect(regle).toMatch(/src:local\(/);
            expect(regle).not.toMatch(/url\(/);
        }
        expect(INDEX).toMatch(/--ssr-ui:'Lx Inter','Lx Inter Roboto'/);
        expect(INDEX).toMatch(/--ssr-titre:'Lx Playfair','Lx Playfair Noto'/);
        expect(INDEX).toMatch(/--ssr-texte:'Lx Georgia',Georgia,/);
    });
    it('Lx Georgia : Georgia lui-même (même chasse que la page React), ses quatre styles, marge LCP seule', () => {
        // Sans size-adjust : mêmes coupures de ligne que React. Quatre styles réels : jamais de gras ni
        // d'italique simulés. Même marge en haut et en bas (api/_ssr/styles.js, MARGE LCP).
        const faces = [...INDEX.matchAll(/@font-face\{font-family:'Lx Georgia';[^}]*\}/g)].map((m) => m[0]);
        expect(faces).toHaveLength(4);
        const sources = faces.map((f) => (f.match(/src:local\('([^']+)'\)/) || [])[1]).sort();
        expect(sources).toEqual(['Georgia', 'Georgia Bold', 'Georgia Bold Italic', 'Georgia Italic']);
        for (const f of faces) {
            expect(f).not.toMatch(/size-adjust/);
            const a = Number((f.match(/ascent-override:([\d.]+)%/) || [])[1]) / 100;
            const d = Number((f.match(/descent-override:([\d.]+)%/) || [])[1]) / 100;
            expect(a - 0.917).toBeCloseTo(d - 0.2192, 6);
            expect(a - 0.917).toBeGreaterThan(0);
        }
    });
    it('marge LCP : Inter 0,95 em (une ligne entière couverte par construction), Georgia 0,05 em, titres 0,135 em', () => {
        // Marge = métrique effective (override x size-adjust) moins la métrique de la police imitée, égale en
        // haut et en bas. Valeurs et justification : api/_ssr/styles.js, MARGE LCP.
        const METRIQUES: Record<string, [number, number, number]> = {
            'Lx Inter': [0.969, 0.241, 0.95], 'Lx Inter Roboto': [0.969, 0.241, 0.95],
            'Lx Playfair': [1.082, 0.251, 0.135], 'Lx Playfair Noto': [1.082, 0.251, 0.135],
            'Lx Georgia': [0.917, 0.2192, 0.05],
        };
        // Une ligne de plus chez React (la boîte de texte grandit d'un interligne) est couverte par construction
        // quand la marge ajoutée en haut ET en bas atteint la moitié de l'interligne le plus grand du texte
        // courant Inter (chapôs et paragraphes : 1,7 ; 1,75 sur les guides) : 2 x 0,95 em >= 1,75 em.
        expect(2 * METRIQUES['Lx Inter'][2]).toBeGreaterThanOrEqual(1.75);
        for (const [regle] of INDEX.matchAll(/@font-face\{[^}]*\}/g)) {
            const famille = (regle.match(/font-family:'([^']+)'/) || [])[1];
            const [asc, desc, marge] = METRIQUES[famille];
            const k = Number((regle.match(/size-adjust:([\d.]+)%/) || [, '100'])[1]) / 100;
            const a = Number((regle.match(/ascent-override:([\d.]+)%/) || [])[1]) / 100 * k;
            const d = Number((regle.match(/descent-override:([\d.]+)%/) || [])[1]) / 100 * k;
            expect(a - asc, regle).toBeCloseTo(marge, 3);
            expect(d - desc, regle).toBeCloseTo(marge, 3);
        }
    });
    it('garde d\'interligne sur le contenu serveur', () => {
        expect(INDEX).toMatch(/#ssr-keep,#ssr-content\{line-height:1\.5;\}/);
    });
    it('règles génériques « #ssr-keep … » réservées aux pages sans bloc (aucune classe de type)', () => {
        const css = [...INDEX.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
        const occurrences = [...css.matchAll(/#ssr-keep(?![\w-])([^,{]*)/g)].map((m) => m[1]);
        expect(occurrences.length).toBeGreaterThan(10);
        for (const suite of occurrences) {
            // Seule exception : la garde d'interligne, qui vaut pour toutes les pages.
            if (suite === '') continue;
            expect(suite).toMatch(/^:where\(:not\(\[class\]\)\)/);
        }
    });
    it('commentaires CSS courts (servis à chaque visiteur, accueil et routes sans version serveur comprises)', () => {
        const css = [...INDEX.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        const commentaires = [...css.matchAll(/\/\*[\s\S]*?\*\//g)].reduce((n, m) => n + m[0].length, 0);
        expect(commentaires).toBeLessThan(900);
    });
});

describe('App.css : navigateurs sans :has()', () => {
    const APP_CSS = readFileSync(decodeURIComponent(new URL('../../App.css', import.meta.url).pathname), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    it('aucune liste de sélecteurs body.ssr-live ne mêle :has() et sélecteurs simples', () => {
        const css = APP_CSS;
        const regles = [...css.matchAll(/((?:body\.ssr-live[^{]*?)+)\{/g)].map((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean));
        expect(regles.length).toBeGreaterThan(1);
        for (const liste of regles) {
            const avecHas = liste.filter((x) => x.includes(':has('));
            expect({ liste, melange: avecHas.length > 0 && avecHas.length < liste.length }).toEqual({ liste, melange: false });
        }
        const simples = regles.filter((l) => !l.some((x) => x.includes(':has('))).flat();
        for (const x of ['body.ssr-live #app .route-fallback', 'body.ssr-live #app .footer', 'body.ssr-live #app .chargement-interrompu']) {
            expect(simples).toContain(x);
        }
    });
    it('repli @supports : sans :has(), chaque conteneur replié par :has() l\'est aussi par sa seule classe', () => {
        // Sans ce repli, le conteneur (min-height:100vh) repoussait d'un écran la version serveur déjà affichée.
        const repli = APP_CSS.match(/@supports not selector\(:has\(\*\)\)\s*\{([\s\S]*?\})\s*\}/);
        expect(repli).not.toBeNull();
        const conteneursRepli = [...repli![1].matchAll(/body\.ssr-live #app \.([\w-]+)\s*[,{]/g)].map((m) => m[1]);
        const conteneursHas = [...APP_CSS.matchAll(/body\.ssr-live #app \.([\w-]+):has\(/g)].map((m) => m[1]);
        expect(conteneursHas.length).toBeGreaterThan(5);
        for (const c of conteneursHas) expect(conteneursRepli, c).toContain(c);
        // « Chargement interrompu » (.app > :has(.chargement-interrompu)) : la page d'article l'enveloppe aussi.
        expect(conteneursRepli).toContain('article-page');
        expect(repli![1]).toMatch(/height:\s*0;[\s\S]*visibility:\s*hidden;/);
    });
});
