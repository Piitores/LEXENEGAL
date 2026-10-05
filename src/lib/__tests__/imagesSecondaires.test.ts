import { describe, it, expect, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LexenegalSymbol from '../../components/LexenegalSymbol/LexenegalSymbol';

/*
 * Images secondaires (rapport « pannes » du 05/10/2026) : avec le premier rendu synchrone (flushSync), le logo de
 * l'en-tête (icon-512.png, 123 Ko pour 44 px) et le filigrane des décisions (1,2 Mo) étaient demandés avant
 * l'événement load et le retenaient : 11,5 s au lieu de 3,7 s en 4G lente, Google Analytics avec.
 */
const racine = (chemin: string) => decodeURIComponent(new URL(`../../../${chemin}`, import.meta.url).pathname);

describe('images secondaires : ni LCP ni événement load retardés', () => {
    it('filigrane : chargé à la demande, priorité basse, décodage asynchrone, sans avertissement React', () => {
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        const html = renderToStaticMarkup(h(LexenegalSymbol, { size: 400, opacity: 0.03 }));
        expect(espion).not.toHaveBeenCalled();
        espion.mockRestore();
        expect(html).toMatch(/loading="lazy"/);
        expect(html).toMatch(/fetchpriority="low"/);
        expect(html).toMatch(/decoding="async"/);
    });

    it('en-tête : icône de taille adaptée (icon-192, pas icon-512), taille réservée, priorité basse', () => {
        const navbar = readFileSync(racine('src/components/Navbar/Navbar.tsx'), 'utf8');
        expect(navbar).not.toMatch(/src="\/icon-512/);
        expect(navbar).toMatch(/<img src="\/icon-192\.png" alt="" className="navbar__logo-img" width=\{44\} height=\{44\} decoding="async" \{\.\.\.PRIORITE_BASSE\} \/>/);
        // 17 Ko au lieu de 123 Ko.
        expect(statSync(racine('public/icon-192.png')).size).toBeLessThan(20_000);
    });
});
