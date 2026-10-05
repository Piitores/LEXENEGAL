import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { deriveEntitlements, type Entitlements } from '../lib/entitlements';
import { memoriserDroitsEntete } from '../lib/indiceSession';

export interface AuthState extends Entitlements {
  loading: boolean;
  user: User | null;
}

const ANON: Entitlements = { isConnected: false, isPro: false, isAdmin: false };

/**
 * Source de vérité unique côté React pour l'auth + les droits.
 * Remplace les lectures dispersées de session/role/subscription_tier.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, ...ANON });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        memoriserDroitsEntete(null, false);
        if (active) setState({ loading: false, user: null, ...ANON });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, role')
        .eq('id', user.id)
        .single();
      const droits = deriveEntitlements(profile);
      // Indice pour le premier rendu de l'en-tête à la prochaine ouverture (lib/indiceSession.ts).
      memoriserDroitsEntete(user.id, droits.isAdmin);
      if (active) setState({ loading: false, user, ...droits });
    };

    load();
    // ⛔ Le rappel ne doit PAS renvoyer la promesse de load() (ancienne forme `() => load()`).
    // supabase-js ATTEND ses abonnés : à l'initialisation, une session stockée déclenche
    // SIGNED_IN pendant que le client est encore en cours d'initialisation, verrou d'auth tenu ;
    // load() appelle getSession(), qui attend la fin de cette initialisation… qui attend load().
    // Cycle sans fin : verrou jamais rendu, AUCUNE requête Supabase ne part, la page reste sur
    // « Chargement… » pour un membre connecté (reproduit le 05/10/2026 sous Chrome, selon l'ordre
    // de démarrage). supabase-js déconseille lui-même un rappel qui renvoie une promesse (surcharge
    // dépréciée « risque d'interblocage », GoTrueClient.d.ts) : on sort l'appel du rappel.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(load, 0); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return state;
}

export default useAuth;
