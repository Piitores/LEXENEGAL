import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estErreurChargementModule, affichageErreur } from '../erreurChargement';
import { SELECTEUR_INTERROMPU } from '../versionServeur';

/*
 * ErrorBoundary (diagnostic Search Console du 07/10/2026) : un morceau de code introuvable après un
 * déploiement, ou une erreur pendant que la version serveur est affichée, ne doit JAMAIS remplacer le
 * texte par « Une erreur inattendue est survenue » (Soft 404). On monte « Chargement interrompu ».
 */
const lire = (chemin: string) => readFileSync(decodeURIComponent(new URL(chemin, import.meta.url).pathname), 'utf8');

describe('estErreurChargementModule', () => {
    it('reconnaît les erreurs d’import dynamique des navigateurs', () => {
        for (const message of [
            'Failed to fetch dynamically imported module: https://www.lexenegal.sn/assets/DecisionPage-Cot-Doef.js',
            'error loading dynamically imported module: https://www.lexenegal.sn/assets/ArticlePage-x.js',
            'Importing a module script failed.',
            "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\".",
            "'text/html' is not a valid JavaScript MIME type.",
            'Unable to preload CSS for /assets/ArticlePage-x.css',
        ]) expect(estErreurChargementModule(new TypeError(message)), message).toBe(true);
        expect(estErreurChargementModule({ name: 'ChunkLoadError', message: 'Loading chunk 12 failed.' })).toBe(true);
    });

    it('ne confond pas un bug d’affichage avec un chargement', () => {
        expect(estErreurChargementModule(new TypeError("Cannot read properties of undefined (reading 'slug')"))).toBe(false);
        expect(estErreurChargementModule(new Error('Minified React error #31'))).toBe(false);
        expect(estErreurChargementModule(null)).toBe(false);
        expect(estErreurChargementModule(undefined)).toBe(false);
    });
});

describe('affichageErreur', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'slug')");
    const module = new TypeError('Failed to fetch dynamically imported module: /assets/DecisionPage-x.js');

    it('version serveur affichée : toujours « Chargement interrompu », quelle que soit l’erreur', () => {
        expect(affichageErreur(bug, true)).toBe('interrompu');
        expect(affichageErreur(module, true)).toBe('interrompu');
    });

    it('page déjà remplacée par React : morceau de code introuvable « interrompu », vrai bug « erreur »', () => {
        expect(affichageErreur(module, false)).toBe('interrompu');
        expect(affichageErreur(bug, false)).toBe('erreur');
    });

    it('l’ErrorBoundary monte bien le composant que versionServeur.ts garde, et App le remet à zéro à chaque adresse', () => {
        const boundary = lire('../../components/ErrorBoundary/ErrorBoundary.tsx');
        expect(boundary).toContain("import ChargementInterrompu from '../ChargementInterrompu/ChargementInterrompu'");
        expect(boundary).toContain('affichageErreur(this.state.error, versionServeurAffichee)');
        // ChargementInterrompu porte la classe que la surveillance de la version serveur garde.
        expect(SELECTEUR_INTERROMPU).toBe('#app .chargement-interrompu');
        expect(lire('../../components/ChargementInterrompu/ChargementInterrompu.tsx')).toContain('className={`chargement-interrompu${');
        // ⛔ Le composant de secours ne doit pas être chargé à la demande : il doit survivre à un
        // morceau de code introuvable.
        const app = lire('../../App.tsx');
        expect(app).toMatch(/^import ErrorBoundary from '\.\/components\/ErrorBoundary\/ErrorBoundary';$/m);
        expect(app).toContain('<ErrorBoundary cleNavigation={location.key}>');
    });
});
