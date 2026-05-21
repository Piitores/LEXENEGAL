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

async function generateSitemap() {
    console.log('📍 Generating sitemap.xml from Supabase...');

    // Fetch data
    console.log('⏳ Fetching decisions...');
    const decisions = await fetchAllRows('decisions', 'slug,date_decision');
    
    console.log('⏳ Fetching codes...');
    const codes = await fetchAllRows('laws_and_codes', 'id,slug,updated_at');

    console.log(`📄 Found ${decisions.length} decisions`);
    console.log(`📚 Found ${codes.length} codes`);

    // Static pages
    const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/search', priority: '0.9', changefreq: 'daily' },
        { url: '/codes', priority: '0.9', changefreq: 'daily' },
        { url: '/solutions', priority: '0.7', changefreq: 'monthly' },
        { url: '/espace-professionnel', priority: '0.7', changefreq: 'monthly' },
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
        const lastmod = code.updated_at 
            ? new Date(code.updated_at).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        xml += `  <url>
    <loc>${BASE_URL}/code/${code.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
    }

    // 4. Add decision pages
    for (const decision of decisions) {
        if (!decision.slug) continue;

        const lastmod = decision.date_decision
            ? new Date(decision.date_decision).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        xml += `  <url>
    <loc>${BASE_URL}/decision/${decision.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    // Write to public folder
    const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml);

    console.log(`✅ Sitemap saved to ${outputPath}`);
    console.log(`📊 Total URLs generated: ${staticPages.length + codes.length + decisions.length}`);
}

generateSitemap().catch(console.error);
