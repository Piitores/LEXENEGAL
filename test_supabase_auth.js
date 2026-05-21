import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env
const envContent = fs.readFileSync('/Users/pitores/Downloads/Test code 28-11/landing-page-Lexenegal/.env', 'utf-8');
let URL = '';
let KEY = '';
for (const line of envContent.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) KEY = line.split('=')[1].trim();
}

const supabase = createClient(URL, KEY);

async function testAuth() {
    console.log('Testing Supabase Auth...');
    const email = 'test_otp_' + Date.now() + '@lexenegal.sn';
    
    console.log('Signing up with:', email);
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: 'Password123!',
        options: {
            data: { full_name: 'Test User' }
        }
    });

    if (error) {
        console.error('Signup error:', error.message);
        return;
    }

    console.log('Signup success! User ID:', data.user?.id);
    
    // Let's try to verify with a dummy OTP
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: '12345678',
        type: 'signup'
    });
    
    console.log('Verify with 12345678 result:', verifyError ? verifyError.message : 'Success');
}

testAuth();
