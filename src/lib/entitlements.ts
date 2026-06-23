/** Profil minimal nécessaire au calcul des droits. */
export interface ProfileRights {
  subscription_tier?: string | null;
  role?: string | null;
}

export interface Entitlements {
  isConnected: boolean;
  isPro: boolean;
  isAdmin: boolean;
}

/**
 * Source de vérité UNIQUE des droits (design doc 2026-06-23).
 * - isPro = abonnement 'pro' (l'admin est implicitement pro).
 * - isAdmin = role 'admin' (seul usage conservé de `role`).
 * `profile === null` => utilisateur anonyme.
 */
export function deriveEntitlements(profile: ProfileRights | null): Entitlements {
  if (!profile) {
    return { isConnected: false, isPro: false, isAdmin: false };
  }
  const isAdmin = profile.role === 'admin';
  const isPro = profile.subscription_tier === 'pro' || isAdmin;
  return { isConnected: true, isPro, isAdmin };
}
