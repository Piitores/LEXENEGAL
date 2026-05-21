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

async function checkRows() {
    console.log('Analyse des données...\n');
    
    const { count: total, error: err1 } = await supabase
        .from('decisions')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Nombre total de décisions : ${total}`);
    
    const { count: nullCount, error: err2 } = await supabase
        .from('decisions')
        .select('*', { count: 'exact', head: true })
        .is('fts_vector', null);
        
    console.log(`Nombre de décisions avec fts_vector vide (NULL) : ${nullCount}`);
}

checkRows();
