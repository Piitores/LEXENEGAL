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

/*
 * Relecture finale (05/10/2026) : getSession() en échec à la PREMIÈRE lecture (verrou d'authentification
 * indisponible 5 s, cf. authLock.ts : un autre onglet le tient, par exemple pendant un rafraîchissement
 * lent). `loading` restait vrai jusqu'au prochain événement d'authentification : un membre connecté voyait
 * la doctrine « réservée aux membres ».
 */
describe('échec transitoire de la lecture de session', () => {
    const verrou = () => new Error("Verrou d'authentification « lock:x » indisponible après 5000 ms.");
    function bancEchec(echecsInitiaux: number) {
        let echecs = echecsInitiaux;
        const compte = { lectures: 0 };
        let rappel: ((e: string) => void) | null = null;
        const dep: DependancesAuth = {
            lireUtilisateur: async () => {
                compte.lectures++;
                if (echecs-- > 0) throw verrou();
                return membre();
            },
            lireProfil: async () => ({ data: { role: 'user', subscription_tier: 'free' }, error: null }),
            ecouterChangements: (r) => { rappel = r; return () => { rappel = null; }; },
            memoriserDroits: () => {},
        };
        return { magasin: creerEtatAuth(dep), compte, evenement: (e: string) => rappel?.(e) };
    }

    it('un composant monté APRÈS l’échec relance la lecture : loading retombe, membre connecté', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { magasin, compte } = bancEchec(1);
        magasin.abonner(() => {}); // Navbar
        await finir();
        expect(compte.lectures).toBe(1);
        expect(magasin.lire().loading).toBe(true);
        // Navigation interne : la page de doctrine monte son useAuth (verrou de nouveau libre).
        magasin.abonner(() => {});
        await finir();
        expect(compte.lectures).toBe(2);
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: true });
        vi.mocked(console.error).mockRestore();
    });

    it('sans nouvel abonné, une minuterie relance la lecture (1 s, puis 2 s…), puis s’arrête au succès', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { magasin, compte } = bancEchec(2);
        const desab = magasin.abonner(() => {});
        await finir(); // premier échec à t = 0, relance à 1 s
        expect(compte.lectures).toBe(1);
        await vi.advanceTimersByTimeAsync(989);
        expect(compte.lectures).toBe(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(compte.lectures).toBe(2); // second échec à 1 s, relance à 3 s
        await vi.advanceTimersByTimeAsync(1_999);
        expect(compte.lectures).toBe(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(compte.lectures).toBe(3);
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: true });
        await vi.advanceTimersByTimeAsync(120_000);
        expect(compte.lectures).toBe(3); // plus aucune relance après le succès
        desab();
        vi.mocked(console.error).mockRestore();
    });

    it('plus aucun abonné : aucune relance', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { magasin, compte } = bancEchec(5);
        const desab = magasin.abonner(() => {});
        desab();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(compte.lectures).toBe(1);
        vi.mocked(console.error).mockRestore();
    });

    it('un événement reçu pendant une lecture qui échoue est repris tout de suite (reprise jamais perdue)', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let ouvrir: (() => void) | null = null;
        let lectures = 0;
        let rappel: ((e: string) => void) | null = null;
        const magasin = creerEtatAuth({
            lireUtilisateur: () => {
                lectures++;
                if (lectures === 1) return new Promise((_ok, ko) => { ouvrir = () => ko(verrou()); });
                return Promise.resolve(membre());
            },
            lireProfil: async () => ({ data: { role: 'user', subscription_tier: 'free' }, error: null }),
            ecouterChangements: (r) => { rappel = r; return () => {}; },
            memoriserDroits: () => {},
        });
        magasin.abonner(() => {});
        await finir();
        rappel!('SIGNED_IN'); // pendant la première lecture
        await finir();
        ouvrir!(); // la première lecture échoue
        await finir();
        expect(lectures).toBe(2);
        expect(magasin.lire()).toMatchObject({ loading: false, isConnected: true });
        vi.mocked(console.error).mockRestore();
    });
});
