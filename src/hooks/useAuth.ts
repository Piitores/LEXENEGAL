import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { avecReprise } from '../lib/reprise';
import { creerEtatAuth, type EtatAuth } from '../lib/etatAuth';
import { memoriserDroitsEntete } from '../lib/indiceSession';

export type AuthState = EtatAuth;

/**
 * État d'authentification UNIQUE de la page, partagé par toutes les instances de useAuth
 * (règles : lib/etatAuth.ts). Une page de décision en monte quatre (Navbar, AccountNudge,
 * DecisionPage, DecisionActions) : une seule lecture de `profiles` par changement d'utilisateur,
 * au lieu de 3 par instance (6 à 12 par page vue, rapport « pannes » du 05/10/2026).
 */
const magasin = creerEtatAuth({
  lireUtilisateur: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  },
  // maybeSingle : un compte sans profil est une ABSENCE (data null), pas une erreur ; toute
  // erreur est technique (droits inconnus, cf. lib/etatAuth.ts). Une reprise après 1,5 s.
  lireProfil: (uid) => avecReprise(() => supabase
    .from('profiles')
    .select('subscription_tier, role')
    .eq('id', uid)
    .maybeSingle()),
  // ⛔ Le rappel ne doit PAS attendre la lecture (ancienne forme `() => load()`). supabase-js
  // ATTEND ses abonnés : à l'initialisation, une session stockée déclenche SIGNED_IN pendant que
  // le client est encore en cours d'initialisation, verrou d'auth tenu ; la lecture appelle
  // getSession(), qui attend la fin de cette initialisation… qui attend le rappel. Cycle sans fin :
  // AUCUNE requête Supabase ne part, la page reste sur « Chargement… » pour un membre connecté
  // (reproduit le 05/10/2026 sous Chrome). lib/etatAuth.ts lance donc la lecture dans une tâche à
  // part (setTimeout), et le rappel rend la main tout de suite.
  ecouterChangements: (rappel) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evenement) => { rappel(evenement); });
    return () => subscription.unsubscribe();
  },
  memoriserDroits: memoriserDroitsEntete,
});

/**
 * Source de vérité unique côté React pour l'auth + les droits.
 * Remplace les lectures dispersées de session/role/subscription_tier.
 */
export function useAuth(): AuthState {
  return useSyncExternalStore(magasin.abonner, magasin.lire, magasin.lire);
}

export default useAuth;
