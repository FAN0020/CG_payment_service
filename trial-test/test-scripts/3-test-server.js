#!/usr/bin/env node
/**
 * Test 3: Server Startup and Health Check
 * Tests server initialization, health endpoints, and basic API availability
 */

import { spawn } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync(resolve(__dirname, '../mock-data/test-config.json'), 'utf-8'))
const BASE_URL = config.server.baseUrl
const PORT = config.server.port

console.log('\n' + '='.repeat(80))
console.log('TEST 3: Server Startup and Health Check')
console.log('='.repeat(80))

let testResults = {
  testName: 'Server Operations',
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0
}

function addTest(name, passed, details) {
  testResults.tests.push({ name, passed, details })
  if (passed) {
    testResults.passed++
    console.log(`✅ ${name}`)
  } else {
    testResults.failed++
    console.log(`❌ ${name}`)
    console.log(`   Error: ${details}`)
  }
}

async function checkServerRunning() {
  try {
    const response = await fetch(`${BASE_URL}/api/payment/health`)
    return response.ok
  } catch {
    return false
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('\n📋 Step 1: Starting Payment Service Server...')
    console.log(`   Port: ${PORT}`)
    console.log(`   Command: npm run start:direct`)
    
    const serverProcess = spawn('npm', ['run', 'start:direct'], {
      cwd: resolve(__dirname, '../..'),
      env: { ...process.env, PORT: PORT.toString() },
      detached: false
    })

    let serverReady = false
    let startupOutput = ''

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      startupOutput += output
      
      if (output.includes(`Server listening on`) || output.includes(`port ${PORT}`)) {
        serverReady = true
        resolve({ process: serverProcess, output: startupOutput })
      }
    })

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString()
      startupOutput += output
    })

    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`))
    })

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!serverReady) {
        serverProcess.kill()
        reject(new Error('Server startup timeout (15s)'))
      }
    }, 15000)
  })
}

async function testEndpoint(name, path, expectedStatus = 200) {
  try {
    const response = await fetch(`${BASE_URL}${path}`)
    const success = response.status === expectedStatus
    addTest(
      name,
      success,
      success ? `HTTP ${response.status}` : `Expected ${expectedStatus}, got ${response.status}`
    )
    return response
  } catch (error) {
    addTest(name, false, error.message)
    return null
  }
}

async function runTests() {
  let serverProcess = null

  try {
    // Check if server is already running
    const alreadyRunning = await checkServerRunning()
    
    if (alreadyRunning) {
      console.log('\n✅ Server is already running')
      addTest('Server running check', true, 'Server already active')
    } else {
      // Start server
      const result = await startServer()
      serverProcess = result.process
      
      // Wait for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const nowRunning = await checkServerRunning()
      addTest('Server startup', nowRunning, nowRunning ? 'Server started successfully' : 'Server not responding')
      
      if (!nowRunning) {
        throw new Error('Server failed to start properly')
      }
    }

    console.log('\n📋 Step 2: Test Health Endpoint')
    const healthResponse = await testEndpoint('GET /api/payment/health', '/api/payment/health')
    
    if (healthResponse) {
      const healthData = await healthResponse.json()
      console.log(`   Response: ${JSON.stringify(healthData)}`)
      addTest('Health endpoint returns valid JSON', healthData.status === 'healthy', `Status: ${healthData.status}`)
    }

    console.log('\n📋 Step 3: Test Frontend Routes')
    await testEndpoint('GET /payment (payment page)', '/payment')
    await testEndpoint('GET /payment/success (success page)', '/payment/success')
    await testEndpoint('GET /payment/cancel (cancel page)', '/payment/cancel')

    console.log('\n📋 Step 4: Test API Endpoints (Without Auth)')
    
    // These should fail without proper auth
    const createSubResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    })
    addTest(
      'POST /api/payment/create-subscription requires auth',
      createSubResponse.status === 400 || createSubResponse.status === 401,
      `HTTP ${createSubResponse.status} (correctly rejected)`
    )

    const verifySubResponse = await fetch(`${BASE_URL}/api/payment/verify-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    })
    addTest(
      'POST /api/payment/verify-subscription requires auth',
      verifySubResponse.status === 400 || verifySubResponse.status === 401,
      `HTTP ${verifySubResponse.status} (correctly rejected)`
    )

    console.log('\n📋 Step 5: Test Static File Serving')
    
    const cssResponse = await fetch(`${BASE_URL}/payment/styles.css`)
    addTest('CSS file served', cssResponse.ok, `HTTP ${cssResponse.status}`)
    
    const jsResponse = await fetch(`${BASE_URL}/payment/app.js`)
    addTest('JavaScript file served', jsResponse.ok, `HTTP ${jsResponse.status}`)

    console.log('\n📋 Step 6: Test CORS Headers')
    
    const corsResponse = await fetch(`${BASE_URL}/api/payment/health`, {
      method: 'OPTIONS'
    })
    const hasCors = corsResponse.headers.has('access-control-allow-origin')
    addTest('CORS headers present', hasCors, hasCors ? 'CORS enabled' : 'CORS missing')

    console.log('\n' + '='.repeat(80))
    console.log(`✅ Server Tests: ${testResults.passed} passed, ${testResults.failed} failed`)
    console.log('='.repeat(80))

    // Save results
    writeFileSync(
      resolve(__dirname, '../test-results/3-server-test.json'),
      JSON.stringify(testResults, null, 2)
    )

    // Keep server running for subsequent tests
    if (serverProcess) {
      console.log('\n⚠️  Server is still running for subsequent tests')
      console.log('   To stop: lsof -ti :8790 | xargs kill')
    }

    process.exit(testResults.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n❌ Server Test Failed:', error.message)
    addTest('Fatal error', false, error.message)
    
    if (serverProcess) {
      serverProcess.kill()
    }
    
    process.exit(1)
  }
}

runTests()

