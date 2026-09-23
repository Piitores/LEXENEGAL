/*
 * Détection heuristique des navigateurs automatisés (BotBlocker).
 *
 * Fonction PURE : elle reçoit les signaux déjà lus dans le navigateur, ce qui
 * la rend testable sous Node. `readBotEnv()` fait la lecture côté navigateur.
 *
 * Historique : le 2026-09-23, Search Console (test en direct) montrait que le
 * moteur de rendu de Google déclenchait la modale sur TOUTES les pages, avec les
 * raisons `no_plugins` + `fake_chrome`. Google indexait donc des pages rendues
 * comme « activité automatisée détectée ». D'où deux règles :
 *   1. les robots d'indexation autorisés par robots.txt ne sont JAMAIS traités
 *      comme des bots à bloquer (ils sont vérifiés en amont par Cloudflare) ;
 *   2. l'absence de plugins n'est plus un signal : c'est l'état normal de Chrome
 *      Android et de Safari iOS (un vrai mobile partait déjà avec 1 signal sur 2).
 * Le vrai rempart anti-scraping est Cloudflare, pas ce composant.
 */

export interface BotEnv {
    userAgent: string;
    webdriver: boolean;
    hasChromeGlobal: boolean;
    hasPhantom: boolean;
    pluginCount: number;
    screenWidth: number;
    screenHeight: number;
    languages: readonly string[] | undefined;
}

export interface BotDetection {
    isBot: boolean;
    reasons: string[];
}

/* Robots d'indexation et de recherche autorisés dans public/robots.txt. */
const VERIFIED_CRAWLERS = [
    'googlebot',
    'google-inspectiontool',
    'adsbot-google',
    'mediapartners-google',
    'storebot-google',
    'bingbot',
    'applebot',
    'duckduckbot',
    'oai-searchbot',
    'chatgpt-user',
    'claude-searchbot',
    'claude-user',
    'perplexitybot',
    'perplexity-user',
];

const SUSPICIOUS_UA = ['headless', 'phantom', 'selenium', 'puppeteer', 'playwright'];

/* Seuil : 2 signaux ou plus = navigateur automatisé probable. */
export const BOT_THRESHOLD = 2;

export function detectBot(env: BotEnv): BotDetection {
    const ua = (env.userAgent || '').toLowerCase();

    if (VERIFIED_CRAWLERS.some((c) => ua.includes(c))) {
        return { isBot: false, reasons: ['verified_crawler'] };
    }

    const reasons: string[] = [];

    // 1. navigator.webdriver (Selenium, Puppeteer, Playwright)
    if (env.webdriver) reasons.push('webdriver');

    // 2. Cadres d'automatisation historiques
    if (env.hasPhantom) reasons.push('phantom');

    // 3. User-agent explicite
    if (SUSPICIOUS_UA.some((s) => ua.includes(s))) reasons.push('suspicious_ua');

    // 4. Se dit Chrome mais sans l'objet global `chrome`
    if (ua.includes('chrome') && !env.hasChromeGlobal) reasons.push('fake_chrome');

    // 5. Pas d'environnement graphique
    if (env.screenWidth === 0 || env.screenHeight === 0) reasons.push('no_screen');

    // 6. Aucune langue déclarée
    if (!env.languages || env.languages.length === 0) reasons.push('no_languages');

    return { isBot: reasons.length >= BOT_THRESHOLD, reasons };
}

/* Lecture des signaux dans le navigateur (jamais appelée sous Node). */
export function readBotEnv(): BotEnv {
    const w = window as unknown as Record<string, unknown>;
    return {
        userAgent: navigator.userAgent || '',
        webdriver: navigator.webdriver === true,
        hasChromeGlobal: Boolean(w.chrome),
        hasPhantom: Boolean(w._phantom || w.__nightmare || w.callPhantom),
        pluginCount: navigator.plugins ? navigator.plugins.length : 0,
        screenWidth: window.screen ? window.screen.width : 1,
        screenHeight: window.screen ? window.screen.height : 1,
        languages: navigator.languages,
    };
}
