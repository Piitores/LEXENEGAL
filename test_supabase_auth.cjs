const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/pitores/Downloads/Test code 28-11/landing-page-Lexenegal/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

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
