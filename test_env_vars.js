#!/usr/bin/env node
/**
 * Test if Supabase environment variables are loaded correctly in Next.js
 */

// Simulate Next.js environment loading
require('dotenv').config({ path: '.env' });

console.log('='.repeat(60));
console.log('NEXT.JS ENVIRONMENT VARIABLE TEST');
console.log('='.repeat(60));
console.log();

const vars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_API_URL',
];

let allGood = true;

vars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        // Check if value has quotes
        if (value.startsWith("'") || value.startsWith('"')) {
            console.log(`❌ ${varName}`);
            console.log(`   Value starts with quote: ${value.substring(0, 50)}...`);
            console.log(`   This will break authentication!`);
            allGood = false;
        } else {
            const display = varName.includes('KEY') ? value.substring(0, 20) + '...' : value;
            console.log(`✅ ${varName}`);
            console.log(`   ${display}`);
        }
    } else {
        console.log(`❌ ${varName} is NOT SET`);
        allGood = false;
    }
    console.log();
});

console.log('='.repeat(60));
if (allGood) {
    console.log('✅ ALL ENVIRONMENT VARIABLES ARE CORRECT!');
    console.log('Login should work now at: http://localhost:3001/login');
} else {
    console.log('❌ SOME ENVIRONMENT VARIABLES HAVE ISSUES');
    console.log('Please fix the .env file and restart the dev server');
}
console.log('='.repeat(60));
