#!/usr/bin/env node

/**
 * Generate test JWT token for development
 */

import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    process.exit(1);
  }
}

function generateToken() {
  const env = loadEnv();
  const jwtSecret = env.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    console.error('❌ Error: JWT_SECRET not properly configured in .env');
    process.exit(1);
  }

  const payload = {
    sub: 'test-user-123456',
    email: 'testuser@classguru.com',
    iss: 'classguru-ad-service',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    role: 'admin',
  };

  const token = jwt.sign(payload, jwtSecret);

  console.log('🎫 Test JWT Token Generated\n');
  console.log('Token Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');
  console.log('Token (copy this):');
  console.log(token);
  console.log('\n' + '='.repeat(80) + '\n');
  console.log('Usage:');
  console.log('  curl -H "Authorization: Bearer <token>" http://localhost:8791/api/ads/metrics');
  console.log('\nOr in JavaScript:');
  console.log(`  headers: { 'Authorization': 'Bearer ${token.substring(0, 20)}...' }`);
  console.log('\n');
}

generateToken();
