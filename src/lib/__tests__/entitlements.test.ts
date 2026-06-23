import { describe, it, expect } from 'vitest';
import { deriveEntitlements } from '../entitlements';

describe('deriveEntitlements', () => {
  it('anonyme (profil null) : aucun droit', () => {
    expect(deriveEntitlements(null)).toEqual({
      isConnected: false,
      isPro: false,
      isAdmin: false,
    });
  });

  it('connecté gratuit : connecté, ni pro ni admin', () => {
    const e = deriveEntitlements({ subscription_tier: 'free', role: 'user' });
    expect(e).toEqual({ isConnected: true, isPro: false, isAdmin: false });
  });

  it('pro : isPro=true', () => {
    const e = deriveEntitlements({ subscription_tier: 'pro', role: 'user' });
    expect(e.isPro).toBe(true);
  });

  it('admin : isAdmin=true ET isPro=true (l’admin a tout)', () => {
    const e = deriveEntitlements({ subscription_tier: 'free', role: 'admin' });
    expect(e.isAdmin).toBe(true);
    expect(e.isPro).toBe(true);
  });

  it('tier inconnu/legacy "trial" : traité comme non-pro', () => {
    const e = deriveEntitlements({ subscription_tier: 'trial', role: 'user' });
    expect(e.isPro).toBe(false);
  });
});
