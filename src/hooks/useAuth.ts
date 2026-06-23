import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { deriveEntitlements, type Entitlements } from '../lib/entitlements';

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
        if (active) setState({ loading: false, user: null, ...ANON });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, role')
        .eq('id', user.id)
        .single();
      if (active) setState({ loading: false, user, ...deriveEntitlements(profile) });
    };

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return state;
}

export default useAuth;
