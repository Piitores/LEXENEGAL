import { describe, it, expect, vi, afterEach } from 'vitest';
import { lockAuthBorne, DELAI_ACQUISITION_MS } from '../authLock';

/*
 * Le verrou d'authentification borné.
 *
 * Contexte (incident du 2026-08-04) : supabase-js sérialise ses opérations
 * d'auth avec un verrou Web Locks partagé par TOUS les onglets de l'origine, et
 * `getSession()` le demande avec un délai de -1 — attendre indéfiniment. Un
 * onglet qui détient ce verrou sans jamais le rendre (onglet gelé en arrière-plan)
 * fige alors toute nouvelle page : « Chargement… » perpétuel, aucune erreur,
 * aucune requête réseau. Ces tests verrouillent le comportement qui l'empêche.
 */

/** Gestionnaire de verrous factice, conforme au contrat de `navigator.locks`. */
function fauxLockManager() {
  const tenus = new Set<string>();

  return {
    tenus,
    /** Simule un verrou déjà pris par un autre contexte, et jamais relâché. */
    bloquer(nom: string) {
      tenus.add(nom);
    },
    async request(nom: string, options: any, fn: () => Promise<unknown>) {
      const signal = options?.signal;

      if (!tenus.has(nom)) {
        tenus.add(nom);
        try {
          return await fn();
        } finally {
          tenus.delete(nom);
        }
      }

      // Verrou occupé : on attend. Conformément à la spec, seul le signal peut
      // interrompre une demande EN ATTENTE.
      return new Promise((_resolve, reject) => {
        if (!signal) return; // sans signal : attente infinie — c'est le bug
        if (signal.aborted) {
          const e: any = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
          return;
        }
        signal.addEventListener('abort', () => {
          const e: any = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    },
  };
}

function installerLocks(manager: unknown) {
  vi.stubGlobal('navigator', { locks: manager });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('lockAuthBorne', () => {
  it('exécute l’opération quand le verrou est libre', async () => {
    installerLocks(fauxLockManager());
    const r = await lockAuthBorne('lock:test', -1, async () => 'fait');
    expect(r).toBe('fait');
  });

  it('rend la main quand aucune API Web Locks n’existe (SSR, vieux navigateur)', async () => {
    vi.stubGlobal('navigator', undefined);
    const r = await lockAuthBorne('lock:test', -1, async () => 'sans verrou');
    expect(r).toBe('sans verrou');
  });

  it('ÉCHOUE au lieu d’attendre indéfiniment quand le verrou est mort', async () => {
    // C'est LE cas de l'incident : un autre contexte détient le verrou pour
    // toujours. Sans borne, cette promesse ne se résoudrait jamais.
    // Minuteries simulées : on vérifie le comportement, pas la patience.
    vi.useFakeTimers();
    const m = fauxLockManager();
    m.bloquer('lock:test');
    installerLocks(m);

    const operation = vi.fn(async () => 'ne devrait pas tourner');
    const p = lockAuthBorne('lock:test', -1, operation);
    const attendu = expect(p).rejects.toThrow(/verrou/i);

    await vi.advanceTimersByTimeAsync(DELAI_ACQUISITION_MS);
    await attendu;
    expect(operation).not.toHaveBeenCalled();
  });

  it('marque l’échec avec isAcquireTimeout, comme l’exige le contrat LockFunc', async () => {
    vi.useFakeTimers();
    const m = fauxLockManager();
    m.bloquer('lock:test');
    installerLocks(m);

    // supabase-js teste cette propriété pour distinguer un verrou occupé d'une
    // vraie panne, et l'ignore silencieusement dans sa boucle de
    // rafraîchissement automatique.
    const attendu = expect(lockAuthBorne('lock:test', -1, async () => null)).rejects.toMatchObject({
      isAcquireTimeout: true,
    });
    await vi.advanceTimersByTimeAsync(DELAI_ACQUISITION_MS);
    await attendu;
  });

  it('respecte un délai explicite plutôt que d’imposer le sien', async () => {
    const m = fauxLockManager();
    m.bloquer('lock:test');
    installerLocks(m);

    const debut = Date.now();
    await lockAuthBorne('lock:test', 40, async () => null).catch(() => {});
    const ecoule = Date.now() - debut;

    // Le délai fourni (40 ms) doit primer sur le défaut (plusieurs secondes).
    expect(ecoule).toBeLessThan(DELAI_ACQUISITION_MS);
  });

  it('n’interrompt PAS une opération déjà en cours', async () => {
    // Le signal ne doit annuler qu'une demande en attente : une fois le verrou
    // obtenu, l'opération va au bout, même plus longue que le délai.
    installerLocks(fauxLockManager());
    const r = await lockAuthBorne('lock:test', 20, async () => {
      await new Promise((res) => setTimeout(res, 60));
      return 'terminée';
    });
    expect(r).toBe('terminée');
  });

  it('propage l’erreur de l’opération sans la déguiser', async () => {
    installerLocks(fauxLockManager());
    await expect(
      lockAuthBorne('lock:test', -1, async () => {
        throw new Error('panne métier');
      }),
    ).rejects.toThrow('panne métier');
  });
});
