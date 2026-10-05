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

    it('chaque bloc annule le cadre générique de #ssr-keep pour sa propre racine', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        const RACINE: Record<string, string> = { article: 'ssr-article', code: 'ssr-code', decision: 'ssr-decision', theme: 'ssr-theme',
            jurisprudence: 'ssr-jurisprudence', guides: 'ssr-ed', guide: 'ssr-ed', doctrine: 'ssr-ed', codes: 'ssr-ed' };
        for (const t of TYPES) {
            const regle = new RegExp(`#ssr-keep:has\\(\\.${RACINE[t]}\\)[^{]*\\{[^}]*padding:0`);
            expect(STYLES_SSR[t], t).toMatch(regle);
        }
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
    it('jeu unique : Lx Inter, Lx Inter Roboto, Lx Playfair, Lx Playfair Noto, en polices locales', () => {
        const familles = new Set([...INDEX.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]));
        expect([...familles].sort()).toEqual(['Lx Inter', 'Lx Inter Roboto', 'Lx Playfair', 'Lx Playfair Noto']);
        for (const [regle] of INDEX.matchAll(/@font-face\{[^}]*\}/g)) {
            expect(regle).toMatch(/src:local\(/);
            expect(regle).not.toMatch(/url\(/);
        }
        expect(INDEX).toMatch(/--ssr-ui:'Lx Inter','Lx Inter Roboto'/);
        expect(INDEX).toMatch(/--ssr-titre:'Lx Playfair','Lx Playfair Noto'/);
    });
    it('garde d\'interligne sur le contenu serveur', () => {
        expect(INDEX).toMatch(/#ssr-keep,#ssr-content\{line-height:1\.5;\}/);
    });
});
