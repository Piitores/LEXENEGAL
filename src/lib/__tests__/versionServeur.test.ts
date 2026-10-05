import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    surveillerVersionServeur, SELECTEUR_CHARGEMENT, SELECTEUR_INTERROMPU, FILET_VERSION_SERVEUR_MS,
} from '../versionServeur';

/*
 * Retrait de la version serveur (#ssr-keep) : un « Chargement interrompu » doit la GARDER
 * (jamais d'écran vide ni d'« introuvable » à la place du texte serveur), et un « Réessayer »
 * réussi doit la retirer comme un premier chargement.
 */

/** Faux #app : l'ensemble des sélecteurs « montés », et un observateur déclenché à la main. */
function fauxDom() {
    const montes = new Set<string>();
    let rappel: (() => void) | null = null;
    const etat = { retiree: false, deconnecte: false, bandeau: false, bandeauxAffiches: 0 };
    const env = {
        present: (selecteur: string) => selecteur.split(',').map((s) => s.trim()).some((s) => montes.has(s)),
        observer: (r: () => void) => { rappel = r; return { disconnect: () => { etat.deconnecte = true; } }; },
        retirer: () => { etat.retiree = true; },
        bandeau: (visible: boolean) => { etat.bandeau = visible; if (visible) etat.bandeauxAffiches++; },
    };
    /** React remplace le contenu de #app : nouveaux états montés, puis rappel de l'observateur. */
    const rendre = (...selecteurs: string[]) => {
        montes.clear();
        selecteurs.forEach((s) => montes.add(s));
        if (!etat.deconnecte) rappel?.();
    };
    return { env, etat, rendre, montes };
}

const CODE_LOADING = '#app .code-loading';

afterEach(() => { vi.useRealTimers(); });

describe('surveillerVersionServeur', () => {
    it('chaque état de chargement surveillé figure dans le sélecteur', () => {
        expect(SELECTEUR_CHARGEMENT.split(', ')).toContain(CODE_LOADING);
        expect(SELECTEUR_INTERROMPU).toBe('#app .chargement-interrompu');
        // Pages dont la version serveur est habillée comme React (05/10/2026) : sans leur état de
        // chargement ici, #ssr-keep serait retiré dès le montage du morceau de route.
        for (const s of ['#app .juris-hub__loading', '#app .corpus-loading > .spinner', '#app .doctrine-detail__container > .doctrine-loading']) {
            expect(SELECTEUR_CHARGEMENT.split(', ')).toContain(s);
        }
    });

    it('chaque état surveillé est aussi replié dans le bloc body.ssr-live d\'App.css (les deux listes)', async () => {
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(decodeURIComponent(new URL('../../App.css', import.meta.url).pathname), 'utf8');
        const regles = css.split('\n').filter((l) => l.startsWith('body.ssr-live #app')).join('\n');
        for (const s of SELECTEUR_CHARGEMENT.split(', ')) {
            const classe = s.match(/\.[\w-]+(?![\s\S]*\.[\w-]+)/)?.[0];
            expect(classe, s).toBeTruthy();
            expect(regles, s).toContain(classe as string);
        }
    });

    it('garde la version serveur pendant le chargement, la retire quand la page est prête', () => {
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        expect(etat.retiree).toBe(false);
        rendre('#app .code-page');
        expect(etat.retiree).toBe(true);
        expect(etat.deconnecte).toBe(true);
    });

    it('GARDE la version serveur quand le chargement est interrompu', () => {
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        rendre(SELECTEUR_INTERROMPU);
        expect(etat.retiree).toBe(false);
        expect(etat.deconnecte).toBe(false);
    });

    it('le filet de 20 s ne retire PAS la version serveur d’une page en échec', () => {
        vi.useFakeTimers();
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        rendre(SELECTEUR_INTERROMPU);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS);
        expect(etat.retiree).toBe(false);
        expect(etat.deconnecte).toBe(false);
    });

    it('« Réessayer » réussi après l’échec : la version serveur cède la place à la page', () => {
        vi.useFakeTimers();
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        rendre(SELECTEUR_INTERROMPU);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS);
        rendre(CODE_LOADING); // nouvelle tentative : roue (repliée sous la version serveur)
        expect(etat.retiree).toBe(false);
        rendre('#app .code-page'); // succès
        expect(etat.retiree).toBe(true);
    });

    it('filet de 20 s, page ENCORE en chargement : la version serveur reste, le bandeau « Réessayer » paraît', () => {
        vi.useFakeTimers();
        const { env, etat, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS - 1);
        expect(etat.bandeau).toBe(false);
        vi.advanceTimersByTime(1);
        expect(etat.retiree).toBe(false);
        expect(etat.deconnecte).toBe(false);
        expect(etat.bandeau).toBe(true);
    });

    it('« Réessayer » cliqué AVANT 20 s (interrompu -> chargement) : à l’échéance, version serveur gardée + bandeau', () => {
        // Rapport « pannes » (s1b) : interrompu à 15,5 s, clic à 16,5 s, version serveur retirée à 20,4 s.
        vi.useFakeTimers();
        const { env, etat, rendre, montes } = fauxDom();
        montes.add('#app .article-loading');
        surveillerVersionServeur(env);
        vi.advanceTimersByTime(15_500);
        rendre(SELECTEUR_INTERROMPU);
        expect(etat.bandeau).toBe(false); // celui de ChargementInterrompu suffit
        vi.advanceTimersByTime(1_000);
        rendre('#app .article-loading'); // clic sur « Réessayer »
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS - 16_500);
        expect(etat.retiree).toBe(false);
        expect(etat.bandeau).toBe(true);
        // La nouvelle tentative échoue : bandeau de ChargementInterrompu seul, version serveur gardée.
        rendre(SELECTEUR_INTERROMPU);
        expect(etat.bandeau).toBe(false);
        expect(etat.retiree).toBe(false);
        // Puis réussit : la version serveur cède la place à la page, comme un premier chargement.
        rendre('#app .article-loading');
        expect(etat.bandeau).toBe(true);
        rendre('#app .article-page');
        expect(etat.retiree).toBe(true);
        expect(etat.bandeau).toBe(false);
        expect(etat.deconnecte).toBe(true);
    });

    it('chargement lent qui aboutit après 20 s : bandeau, puis retrait de la version serveur', () => {
        vi.useFakeTimers();
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS + 30_000);
        expect(etat.retiree).toBe(false);
        expect(etat.bandeauxAffiches).toBe(1);
        rendre('#app .code-page');
        expect(etat.retiree).toBe(true);
        expect(etat.bandeau).toBe(false);
    });

    it('le bandeau du filet n’apparaît jamais avant 20 s, ni sur une page en échec', () => {
        vi.useFakeTimers();
        const { env, etat, rendre, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        rendre(SELECTEUR_INTERROMPU);
        rendre(CODE_LOADING);
        rendre(SELECTEUR_INTERROMPU);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS * 3);
        expect(etat.bandeauxAffiches).toBe(0);
        expect(etat.retiree).toBe(false);
    });

    it('retire tout de suite si aucune page n’attend (page sans état de chargement)', () => {
        const { env, etat } = fauxDom();
        surveillerVersionServeur(env);
        expect(etat.retiree).toBe(true);
    });

    it('le nettoyage débranche l’observateur et le filet', () => {
        vi.useFakeTimers();
        const { env, etat, montes } = fauxDom();
        montes.add(CODE_LOADING);
        const nettoyer = surveillerVersionServeur(env);
        nettoyer();
        expect(etat.deconnecte).toBe(true);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS);
        expect(etat.retiree).toBe(false);
        expect(etat.bandeauxAffiches).toBe(0);
    });
});
