/**
 * LEXENEGAL - Sitemap Generator (Supabase Edition)
 * Generates a sitemap.xml with all decisions, codes, and articles from Supabase.
 * Run: node scripts/generate-sitemap-supabase.cjs
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file manually
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in .env');
    process.exit(1);
}

const BASE_URL = 'https://www.lexenegal.sn';

async function fetchAllRows(tableName, columns = '*') {
    const rows = [];
    let page = 0;
    const pageSize = 1000;
    
    // We make raw HTTP requests to avoid needing @supabase/supabase-js dependency in the CI environment
    // if it's not installed, although it should be. Using native fetch is foolproof.
    while (true) {
        const offset = page * pageSize;
        const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=${columns}&offset=${offset}&limit=${pageSize}`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        if (!response.ok) {
            console.error(`Error fetching ${tableName}:`, response.status, response.statusText);
            break;
        }
        
        const data = await response.json();
        if (!data || data.length === 0) {
            break;
        }
        
        rows.push(...data);
        if (data.length < pageSize) {
            break;
        }
        page++;
    }
    
    return rows;
}

// Construit une balise <lastmod> uniquement si la date est valide ET plausible.
// Évite les dates parasites de la base (ex. 1900, ou timestamps produisant 1970).
function lastmodTagFor(dateVal) {
    if (!dateVal) return '';
    // Garde-fou : on n'émet un lastmod que pour une date valide et plausible
    // (évite les dates parasites 1900/epoch que Search Console rejette).
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    if (year < 1950 || year > new Date().getUTCFullYear() + 1) return '';
    return `\n    <lastmod>${d.toISOString().split('T')[0]}</lastmod>`;
}

async function generateSitemap() {
    console.log('📍 Generating sitemap.xml from Supabase...');

    // Fetch data
    console.log('⏳ Fetching decisions...');
    const decisions = await fetchAllRows('decisions', 'slug,date_decision');
    
    console.log('⏳ Fetching codes...');
    const allCodes = await fetchAllRows('laws_and_codes', 'id,slug,updated_at,is_active');
    // Seuls les codes PUBLIÉS (is_active) doivent figurer dans le sitemap.
    const codes = allCodes.filter((c) => c.is_active && c.slug);
    const codeSlugById = new Map(codes.map((c) => [c.id, c.slug]));

    console.log('⏳ Fetching articles...');
    const articles = await fetchAllRows('articles', 'code_id,slug');
    // On ne garde que les articles appartenant à un code publié.
    const activeArticles = articles.filter((a) => a.slug && codeSlugById.has(a.code_id));

    console.log(`📄 Found ${decisions.length} decisions`);
    console.log(`📚 Found ${codes.length} codes publiés (${allCodes.length} au total)`);
    console.log(`📃 Found ${activeArticles.length} articles (codes publiés)`);

    console.log('⏳ Fetching doctrine...');
    // Doctrine fiscale : page teaser publique indexable par document (corps gaté). Pas de is_active → tout est public.
    const doctrines = (await fetchAllRows('doctrine', 'slug,date')).filter((d) => d.slug);
    console.log(`📑 Found ${doctrines.length} doctrines fiscales`);

    console.log('⏳ Fetching pages-thèmes...');
    // Pages-thèmes de jurisprudence (hub /jurisprudence + /jurisprudence/theme/:slug)
    const seoThemes = (await fetchAllRows('seo_themes', 'slug,updated_at&is_active=eq.true')).filter((t) => t.slug);
    console.log(`🏷️ Found ${seoThemes.length} pages-thèmes`);

    // Static pages
    const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/jurisprudence', priority: '0.9', changefreq: 'weekly' },
        { url: '/search', priority: '0.9', changefreq: 'daily' },
        { url: '/codes', priority: '0.9', changefreq: 'daily' },
        { url: '/droit-communautaire', priority: '0.8', changefreq: 'weekly' },
        { url: '/doctrine-fiscale', priority: '0.8', changefreq: 'weekly' },
    ];

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // 1. Add static pages
    for (const page of staticPages) {
        xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // 2. Add codes
    for (const code of codes) {
        if (!code.slug) continue;
        
        const lastmodTag = lastmodTagFor(code.updated_at);

        xml += `  <url>
    <loc>${BASE_URL}/code/${code.slug}</loc>${lastmodTag}
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
    }

    // 3. Add article pages (codes publiés)
    for (const article of activeArticles) {
        const codeSlug = codeSlugById.get(article.code_id);
        if (!codeSlug) continue;
        xml += `  <url>
    <loc>${BASE_URL}/code/${codeSlug}/${article.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // 4. Add decision pages
    for (const decision of decisions) {
        if (!decision.slug) continue;

        const lastmodTag = lastmodTagFor(decision.date_decision);

        xml += `  <url>
    <loc>${BASE_URL}/decision/${decision.slug}</loc>${lastmodTag}
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // 5. Add doctrine fiscale pages (teaser public par document)
    for (const doctrine of doctrines) {
        const lastmodTag = lastmodTagFor(doctrine.date);
        xml += `  <url>
    <loc>${BASE_URL}/doctrine-fiscale/${doctrine.slug}</loc>${lastmodTag}
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }

    // 6. Add pages-thèmes de jurisprudence
    for (const theme of seoThemes) {
        xml += `  <url>
    <loc>${BASE_URL}/jurisprudence/theme/${theme.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    // Write to public folder
    const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml);

    console.log(`✅ Sitemap saved to ${outputPath}`);
    console.log(`📊 Total URLs generated: ${staticPages.length + codes.length + activeArticles.length + decisions.length + doctrines.length + seoThemes.length}`);
}

generateSitemap().catch(console.error);
