#!/usr/bin/env node

/**
 * Validate environment configuration
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requiredVars = [
  'PORT',
  'JWT_SECRET',
  'DB_PATH',
];

const optionalVars = [
  'GOOGLE_ADS_ENABLED',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'ADSENSE_CLIENT_ID',
  'ADSENSE_SLOT_ID',
  'MOCK_ADS_MODE',
  'CORS_ORIGIN',
];

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const env = {};

    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    console.error('❌ Error: .env file not found');
    console.log('ℹ️  Copy .env.example to .env and configure it');
    process.exit(1);
  }
}

function validateEnv(env) {
  let valid = true;
  const warnings = [];

  console.log('🔍 Validating environment configuration...\n');

  // Check required variables
  console.log('Required variables:');
  requiredVars.forEach(varName => {
    const value = env[varName];
    if (!value || value === '') {
      console.log(`  ❌ ${varName}: Missing`);
      valid = false;
    } else {
      console.log(`  ✅ ${varName}: Set`);
    }
  });

  // Validate JWT_SECRET length
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    console.log(`  ⚠️  JWT_SECRET is too short (${env.JWT_SECRET.length} chars, minimum 32)`);
    warnings.push('JWT_SECRET should be at least 32 characters for security');
  }

  // Check optional variables
  console.log('\nOptional variables:');
  optionalVars.forEach(varName => {
    const value = env[varName];
    if (!value || value === '') {
      console.log(`  ⚠️  ${varName}: Not set`);
    } else {
      console.log(`  ✅ ${varName}: Set`);
    }
  });

  // Check mode configuration
  console.log('\nMode configuration:');
  const mockMode = env.MOCK_ADS_MODE === 'true';
  const googleAdsEnabled = env.GOOGLE_ADS_ENABLED === 'true';

  if (mockMode) {
    console.log('  🎭 Mock mode: Enabled');
    console.log('  ℹ️  Running in mock mode - no Google Ads credentials needed');
  } else if (googleAdsEnabled) {
    console.log('  🌐 Production mode: Enabled');
    console.log('  ℹ️  Running with real Google Ads');

    if (!env.ADSENSE_CLIENT_ID) {
      warnings.push('ADSENSE_CLIENT_ID not set for production mode');
    }
  } else {
    console.log('  ⚠️  Neither mock mode nor production mode is properly configured');
    warnings.push('Set either MOCK_ADS_MODE=true or GOOGLE_ADS_ENABLED=true');
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (valid && warnings.length === 0) {
    console.log('✅ Configuration is valid and ready to use!');
    console.log('\nYou can start the server with: npm run dev');
  } else if (valid) {
    console.log('⚠️  Configuration is valid but has warnings');
    console.log('\nYou can start the server, but review the warnings above');
  } else {
    console.log('❌ Configuration is invalid');
    console.log('\nPlease fix the errors above before starting the server');
    process.exit(1);
  }
  console.log('='.repeat(50) + '\n');
}

// Run validation
const env = loadEnv();
validateEnv(env);
