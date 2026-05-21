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

async function checkFts() {
    console.log('Vérification de l\'état de la base de données...\n');
    
    // Check if the column exists by requesting it
    const { data, error } = await supabase.from('decisions').select('fts_vector').limit(1);
    
    if (error) {
        if (error.message.includes('Could not find the "fts_vector" column') || error.message.includes('fts_vector')) {
            console.log('❌ La colonne fts_vector n\'existe pas encore. L\'opération a été annulée par le timeout.');
        } else {
            console.error('Erreur:', error.message);
        }
    } else {
        console.log('✅ La colonne fts_vector existe ! Le calcul a continué en arrière-plan malgré le message d\'erreur.');
    }
}

checkFts();
