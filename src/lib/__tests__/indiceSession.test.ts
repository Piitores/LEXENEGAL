import { describe, it, expect } from 'vitest';
import { lireIndiceSession, CLE_SESSION, CLE_DROITS_ENTETE } from '../indiceSession';

/*
 * Indice SYNCHRONE de l'en-tête : il choisit seulement l'affichage du premier rendu
 * (avatar ou « Connexion », lien « Admin »), avant la réponse de useAuth.
 */
const stockage = (valeurs: Record<string, string>) => ({ getItem: (k: string) => (k in valeurs ? valeurs[k] : null) });
const SESSION = JSON.stringify({
    access_token: 'a.b.c', refresh_token: 'r', expires_at: 1, token_type: 'bearer',
    user: { id: 'u-1', email: 'aminata.ndiaye@exemple.sn' },
});

describe('lireIndiceSession', () => {
    it('suit la clé par défaut de supabase-js : sb-<ref>-auth-token', () => {
        expect(CLE_SESSION).toMatch(/^sb-[a-z0-9]+-auth-token$/);
    });

    it('aucune session stockée : anonyme', () => {
        expect(lireIndiceSession(stockage({}))).toEqual({ connecte: false, nom: '', admin: false });
    });

    it('session stockée, même au jeton expiré (rafraîchi par supabase-js) : connecté, avec le nom du menu', () => {
        expect(lireIndiceSession(stockage({ [CLE_SESSION]: SESSION }))).toEqual({ connecte: true, nom: 'aminata.ndiaye', admin: false });
    });

    it('« Admin » seulement si les droits mémorisés sont ceux de CE compte', () => {
        const admin = JSON.stringify({ uid: 'u-1', admin: true });
        const autre = JSON.stringify({ uid: 'u-2', admin: true });
        expect(lireIndiceSession(stockage({ [CLE_SESSION]: SESSION, [CLE_DROITS_ENTETE]: admin })).admin).toBe(true);
        expect(lireIndiceSession(stockage({ [CLE_SESSION]: SESSION, [CLE_DROITS_ENTETE]: autre })).admin).toBe(false);
        expect(lireIndiceSession(stockage({ [CLE_DROITS_ENTETE]: admin })).admin).toBe(false);
    });

    it('entrée incomplète ou illisible, stockage bloqué : anonyme, sans exception', () => {
        expect(lireIndiceSession(stockage({ [CLE_SESSION]: '{"access_token":"x"}' })).connecte).toBe(false);
        expect(lireIndiceSession(stockage({ [CLE_SESSION]: '{pas du json' })).connecte).toBe(false);
        expect(lireIndiceSession({ getItem: () => { throw new Error('SecurityError'); } }).connecte).toBe(false);
        expect(lireIndiceSession(null).connecte).toBe(false);
    });
});
