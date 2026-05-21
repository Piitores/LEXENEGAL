import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('/Users/pitores/Downloads/Test code 28-11/landing-page-Lexenegal/.env', 'utf-8');
let URL = '';
let KEY = '';
for (const line of envContent.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) KEY = line.split('=')[1].trim();
}

const supabase = createClient(URL, KEY);

async function runBenchmarkLight() {
    console.log('Début du benchmark FTS (sans le texte intégral)...\n');
    const searchTerms = ['bail', 'contrat de travail', 'divorce', 'licenciement abusif', 'société anonyme'];
    
    for (const term of searchTerms) {
        const start = performance.now();
        // On demande juste l'ID via select() pour voir si la base répond vite sans le poids réseau
        const { data, error } = await supabase.rpc('search_decisions_fts', { query: term }).select('id, reference');
        const end = performance.now();
        const duration = (end - start).toFixed(2);
        
        if (error) {
            console.error(`❌ Erreur pour "${term}": ${error.message}`);
        } else {
            console.log(`✅ Succès pour "${term}": ${data?.length || 0} résultats en ${duration}ms`);
        }
    }
}

runBenchmarkLight();
