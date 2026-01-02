/**
 * LEXENEGAL - Sitemap Generator
 * Generates a sitemap.xml with all decision slugs from Meilisearch
 * Run: node scripts/generate-sitemap.cjs
 */

const { MeiliSearch } = require('meilisearch');
const fs = require('fs');
const path = require('path');

const client = new MeiliSearch({
    host: 'https://ms-9c13e7ae24b5-37398.fra.meilisearch.io',
    apiKey: 'eabe07740906b7bad2b7dcbe72ab6c010888bc827d3e7ec28b365810a5cad73a',
});

const BASE_URL = 'https://lexenegal.sn';

async function generateSitemap() {
    console.log('📍 Generating sitemap.xml...');

    const index = client.index('decisions');

    // Fetch all decisions
    const results = await index.search('', { limit: 1000 });
    const decisions = results.hits;

    console.log(`📄 Found ${decisions.length} decisions`);

    // Static pages
    const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'weekly' },
        { url: '/search', priority: '0.9', changefreq: 'daily' },
        { url: '/solutions', priority: '0.7', changefreq: 'monthly' },
        { url: '/espace-professionnel', priority: '0.7', changefreq: 'monthly' },
    ];

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Add static pages
    for (const page of staticPages) {
        xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // Add decision pages
    for (const decision of decisions) {
        if (!decision.slug) continue;

        const lastmod = decision.date_decision
            ? new Date(decision.date_decision).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        xml += `  <url>
    <loc>${BASE_URL}/decision/${decision.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    // Write to public folder
    const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml);

    console.log(`✅ Sitemap saved to ${outputPath}`);
    console.log(`📊 Total URLs: ${staticPages.length + decisions.length}`);
}

generateSitemap().catch(console.error);
