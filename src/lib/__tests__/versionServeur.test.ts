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
    const etat = { retiree: false, deconnecte: false };
    const env = {
        present: (selecteur: string) => selecteur.split(',').map((s) => s.trim()).some((s) => montes.has(s)),
        observer: (r: () => void) => { rappel = r; return { disconnect: () => { etat.deconnecte = true; } }; },
        retirer: () => { etat.retiree = true; },
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

    it('le filet de 20 s retire la version serveur d’un chargement qui ne finit pas (comportement d’avant)', () => {
        vi.useFakeTimers();
        const { env, etat, montes } = fauxDom();
        montes.add(CODE_LOADING);
        surveillerVersionServeur(env);
        vi.advanceTimersByTime(FILET_VERSION_SERVEUR_MS - 1);
        expect(etat.retiree).toBe(false);
        vi.advanceTimersByTime(1);
        expect(etat.retiree).toBe(true);
        expect(etat.deconnecte).toBe(true);
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
    });
});
