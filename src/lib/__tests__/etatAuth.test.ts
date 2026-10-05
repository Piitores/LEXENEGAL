import { describe, it, expect, vi, afterEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { creerEtatAuth, ETAT_AUTH_INITIAL, type DependancesAuth } from '../etatAuth';

/*
 * État d'authentification partagé (rapport « pannes » du 05/10/2026) : 6 à 12 lectures de
 * profiles par page vue d'un membre, et un échec de cette lecture qui effaçait l'indice « Admin »
 * et faisait passer le membre pour non connecté.
 */

afterEach(() => { vi.useRealTimers(); });

const membre = (id = 'u-1', email = 'aminata.ndiaye@exemple.sn') => ({ id, email, updated_at: '2026-10-01' }) as unknown as User;

/** Fausse session et faux profiles, comptés ; événements d'authentification déclenchés à la main. */
function banc(options: { user?: User | null; profil?: { data: any; error: any } } = {}) {
    const etat = {
        user: options.user === undefined ? membre() : options.user,
        profil: options.profil ?? { data: { role: 'admin', subscription_tier: 'pro' }, error: null },
        lecturesProfil: 0,
        lecturesSession: 0,
        memorises: [] as Array<[string | null, boolean]>,
        desabonne: 0,
        sessionEnAttente: null as null | (() => void),
        bloquerSession: false,
    };
    let rappel: ((e: string) => void) | null = null;
    const dep: DependancesAuth = {
        lireUtilisateur: () => {
            etat.lecturesSession++;
            if (!etat.bloquerSession) return Promise.resolve(etat.user);
            return new Promise((ok) => { etat.sessionEnAttente = () => ok(etat.user); });
        },
        lireProfil: async () => { etat.lecturesProfil++; return etat.profil; },
        ecouterChangements: (r) => { rappel = r; return () => { etat.desabonne++; rappel = null; }; },
        memoriserDroits: (uid, admin) => { etat.memorises.push([uid, admin]); },
    };
    const magasin = creerEtatAuth(dep);
    const evenement = (e: string) => rappel?.(e);
    return { magasin, etat, evenement };
}

/** Laisse passer les tâches (setTimeout 0) et les promesses en attente. */
const finir = () => vi.advanceTimersByTimeAsync(10);

describe('état d’authentification partagé', () => {
    it('4 composants + INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED : UNE seule lecture de profiles', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc();
        const notifs: number[] = [0, 0, 0, 0];
        const desab = notifs.map((_, i) => magasin.abonner(() => { notifs[i]++; }));
        evenement('INITIAL_SESSION');
        evenement('SIGNED_IN');
        await finir();
        evenement('TOKEN_REFRESHED');
        await finir();
        expect(etat.lecturesProfil).toBe(1);
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: true, isPro: true, isAdmin: true });
        expect(magasin.lire().user?.id).toBe('u-1');
        expect(notifs.every((n) => n >= 1)).toBe(true);
        expect(etat.memorises).toEqual([['u-1', true]]);
        desab.forEach((d) => d());
    });

    it('INITIAL_SESSION seul ne relance aucune lecture (la lecture part au premier abonnement)', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc();
        magasin.abonner(() => {});
        await finir();
        const avant = etat.lecturesSession;
        evenement('INITIAL_SESSION');
        await finir();
        expect(etat.lecturesSession).toBe(avant);
    });

    it('une seule lecture en cours : un événement pendant la lecture la fait reprendre UNE fois, après', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc();
        etat.bloquerSession = true;
        magasin.abonner(() => {});
        evenement('SIGNED_IN');
        evenement('TOKEN_REFRESHED');
        await finir();
        expect(etat.lecturesSession).toBe(1); // pas de seconde lecture en parallèle
        etat.bloquerSession = false;
        etat.sessionEnAttente?.();
        await finir();
        expect(etat.lecturesSession).toBe(2); // reprise unique après la première
        expect(etat.lecturesProfil).toBe(1);
    });

    it('lecture de profiles en ÉCHEC : membre toujours connecté, indice « Admin » NON écrasé', async () => {
        vi.useFakeTimers();
        const { magasin, etat } = banc({ profil: { data: null, error: { message: 'TimeoutError: Aucune réponse du serveur après 15 s' } } });
        magasin.abonner(() => {});
        await finir();
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: true, isPro: false, isAdmin: false });
        expect(magasin.lire().user?.id).toBe('u-1');
        expect(etat.memorises).toEqual([]);
    });

    it('après un échec, profiles est relu au prochain événement, puis les droits sont mémorisés', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc({ profil: { data: null, error: { message: 'réseau' } } });
        magasin.abonner(() => {});
        await finir();
        etat.profil = { data: { role: 'admin', subscription_tier: 'free' }, error: null };
        evenement('TOKEN_REFRESHED');
        await finir();
        expect(etat.lecturesProfil).toBe(2);
        expect(magasin.lire()).toMatchObject({ isConnected: true, isPro: true, isAdmin: true });
        expect(etat.memorises).toEqual([['u-1', true]]);
    });

    it('compte sans profil (absence, pas erreur) : comme avant, non connecté pour les droits', async () => {
        vi.useFakeTimers();
        const { magasin, etat } = banc({ profil: { data: null, error: null } });
        magasin.abonner(() => {});
        await finir();
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: false });
        expect(etat.memorises).toEqual([['u-1', false]]);
    });

    it('changement d’utilisateur : profiles relu ; déconnexion : anonyme et indice effacé', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc();
        magasin.abonner(() => {});
        await finir();
        etat.user = membre('u-2', 'moussa.diop@exemple.sn');
        etat.profil = { data: { role: 'user', subscription_tier: 'free' }, error: null };
        evenement('SIGNED_IN');
        await finir();
        expect(etat.lecturesProfil).toBe(2);
        expect(magasin.lire()).toMatchObject({ isConnected: true, isAdmin: false });
        expect(magasin.lire().user?.id).toBe('u-2');
        etat.user = null;
        evenement('SIGNED_OUT');
        await finir();
        expect(magasin.lire()).toEqual({ ...ETAT_AUTH_INITIAL, loading: false });
        expect(etat.memorises[etat.memorises.length - 1]).toEqual([null, false]);
    });

    it('visiteur anonyme : aucune lecture de profiles', async () => {
        vi.useFakeTimers();
        const { magasin, etat } = banc({ user: null });
        magasin.abonner(() => {});
        await finir();
        expect(etat.lecturesProfil).toBe(0);
        expect(magasin.lire()).toMatchObject({ loading: false, user: null, isConnected: false });
    });

    it('dernier composant démonté : minuterie annulée et écoute débranchée', async () => {
        vi.useFakeTimers();
        const { magasin, etat, evenement } = banc();
        const d1 = magasin.abonner(() => {});
        const d2 = magasin.abonner(() => {});
        await finir();
        const avant = etat.lecturesSession;
        evenement('SIGNED_IN'); // lecture programmée (setTimeout 0)…
        d1(); d2();             // … puis tout est démonté avant qu'elle parte
        await finir();
        expect(etat.lecturesSession).toBe(avant);
        expect(etat.desabonne).toBe(1);
    });
});
