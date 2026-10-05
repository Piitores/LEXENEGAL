import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    SERVICE_WORKER_ACTIF, registerServiceWorker, brancherServiceWorker, type ConteneurServiceWorker,
} from '../pwa';

/*
 * Service worker (rapport « pannes » du 05/10/2026) : le premier rendu synchrone faisait
 * enregistrer, pour la première fois, un service worker dont le clients.claim() rechargeait la
 * page à la première visite. Décision : service worker désactivé, explicitement ; et pour le jour
 * où il sera activé, plus aucun rechargement qui ne soit demandé par le lecteur.
 */

afterEach(() => { vi.unstubAllGlobals(); });

/** Faux navigator.serviceWorker : enregistrement résolu, controllerchange déclenché à la main. */
function fauxConteneur(controleurInitial: ServiceWorker | null, attente: ServiceWorker | null = null) {
    const ecouteurs: Array<() => void> = [];
    const conteneur = {
        controller: controleurInitial,
        register: vi.fn(async () => ({ waiting: attente, addEventListener: () => {} }) as unknown as ServiceWorkerRegistration),
        addEventListener: (_type: 'controllerchange', f: () => void) => { ecouteurs.push(f); },
    } satisfies ConteneurServiceWorker;
    const changerDeControleur = () => ecouteurs.forEach((f) => f());
    return { conteneur, changerDeControleur };
}

describe('service worker désactivé (décision du 05/10/2026)', () => {
    it('la désactivation est explicite', () => {
        expect(SERVICE_WORKER_ACTIF).toBe(false);
    });

    it('registerServiceWorker n’enregistre rien, même page déjà chargée et navigateur compatible', () => {
        const register = vi.fn(async () => ({}));
        const addEventListener = vi.fn();
        vi.stubGlobal('navigator', { serviceWorker: { register, addEventListener, controller: null } });
        vi.stubGlobal('window', { addEventListener, location: { reload: vi.fn() } });
        vi.stubGlobal('document', { readyState: 'complete' });
        registerServiceWorker(() => {});
        expect(register).not.toHaveBeenCalled();
        expect(addEventListener).not.toHaveBeenCalled();
    });
});

describe('brancherServiceWorker : jamais de rechargement non demandé', () => {
    it('première installation (clients.claim -> controllerchange) : AUCUN rechargement', async () => {
        const { conteneur, changerDeControleur } = fauxConteneur(null);
        const recharger = vi.fn();
        brancherServiceWorker(conteneur, undefined, recharger);
        await Promise.resolve();
        expect(conteneur.register).toHaveBeenCalledWith('/sw.js');
        changerDeControleur();
        expect(recharger).not.toHaveBeenCalled();
    });

    it('remplacement non demandé par le lecteur (autre onglet) : aucun rechargement', async () => {
        const { conteneur, changerDeControleur } = fauxConteneur({} as ServiceWorker);
        const recharger = vi.fn();
        brancherServiceWorker(conteneur, undefined, recharger);
        await Promise.resolve();
        changerDeControleur();
        expect(recharger).not.toHaveBeenCalled();
    });

    it('mise à jour demandée : SKIP_WAITING, puis UN seul rechargement au changement de contrôleur', async () => {
        const postMessage = vi.fn();
        const enAttente = { postMessage } as unknown as ServiceWorker;
        const { conteneur, changerDeControleur } = fauxConteneur({} as ServiceWorker, enAttente);
        const recharger = vi.fn();
        const pret = vi.fn();
        const session = brancherServiceWorker(conteneur, pret, recharger);
        await Promise.resolve(); await Promise.resolve();
        expect(pret).toHaveBeenCalledTimes(1); // bandeau « Une nouvelle version est disponible »
        session.appliquerMiseAJour();
        expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        expect(recharger).not.toHaveBeenCalled();
        changerDeControleur();
        changerDeControleur();
        expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('mise à jour demandée sans version en attente : rechargement simple, une seule fois', async () => {
        const { conteneur, changerDeControleur } = fauxConteneur({} as ServiceWorker);
        const recharger = vi.fn();
        const session = brancherServiceWorker(conteneur, undefined, recharger);
        await Promise.resolve();
        session.appliquerMiseAJour();
        changerDeControleur();
        expect(recharger).toHaveBeenCalledTimes(1);
    });
});
