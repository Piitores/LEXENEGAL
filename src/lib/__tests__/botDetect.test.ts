import { describe, it, expect } from 'vitest';
import { detectBot, type BotEnv } from '../botDetect';

const base: BotEnv = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
    webdriver: false,
    hasChromeGlobal: true,
    hasPhantom: false,
    pluginCount: 0,
    screenWidth: 412,
    screenHeight: 915,
    languages: ['fr-FR', 'fr'],
};

describe('detectBot', () => {
    it('laisse passer le moteur de rendu de Google (smartphone), même sans plugins ni window.chrome', () => {
        const r = detectBot({
            ...base,
            userAgent: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            hasChromeGlobal: false,
        });
        expect(r.isBot).toBe(false);
        expect(r.reasons).toContain('verified_crawler');
    });

    it("laisse passer l'outil d'inspection d'URL de Search Console", () => {
        const r = detectBot({
            ...base,
            userAgent: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0)',
            hasChromeGlobal: false,
            webdriver: true,
        });
        expect(r.isBot).toBe(false);
    });

    it('laisse passer Bingbot, Applebot et les robots de recherche IA autorisés par robots.txt', () => {
        for (const ua of [
            'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
            'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
            'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
        ]) {
            expect(detectBot({ ...base, userAgent: ua, hasChromeGlobal: false, webdriver: true }).isBot).toBe(false);
        }
    });

    it("ne compte plus l'absence de plugins : un Chrome Android réel n'en a aucun", () => {
        const r = detectBot({ ...base, pluginCount: 0 });
        expect(r.isBot).toBe(false);
        expect(r.reasons).not.toContain('no_plugins');
    });

    it('un vrai Chrome Android avec window.chrome manquant reste sous le seuil', () => {
        expect(detectBot({ ...base, hasChromeGlobal: false }).isBot).toBe(false);
    });

    it('bloque toujours un navigateur automatisé (webdriver + Chrome sans window.chrome)', () => {
        const r = detectBot({ ...base, webdriver: true, hasChromeGlobal: false });
        expect(r.isBot).toBe(true);
        expect(r.reasons).toEqual(expect.arrayContaining(['webdriver', 'fake_chrome']));
    });

    it('bloque un user-agent headless sans écran', () => {
        const r = detectBot({ ...base, userAgent: 'Mozilla/5.0 HeadlessChrome/128.0', screenWidth: 0, hasChromeGlobal: true });
        expect(r.isBot).toBe(true);
    });

    it('un signal isolé ne suffit pas', () => {
        expect(detectBot({ ...base, webdriver: true }).isBot).toBe(false);
        expect(detectBot({ ...base, languages: [] }).isBot).toBe(false);
    });
});
