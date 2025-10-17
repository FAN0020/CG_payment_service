#!/usr/bin/env node
/**
 * Test 5: Frontend Page Loading and Content
 * Tests that all frontend HTML pages load correctly with proper content
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync(resolve(__dirname, '../mock-data/test-config.json'), 'utf-8'))
const BASE_URL = config.server.baseUrl

console.log('\n' + '='.repeat(80))
console.log('TEST 5: Frontend Page Loading and Content')
console.log('='.repeat(80))

let testResults = {
  testName: 'Frontend Pages',
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
    if (details) console.log(`   ${details}`)
  }
}

async function testPage(name, path, expectedContent = []) {
  try {
    const response = await fetch(`${BASE_URL}${path}`)
    
    addTest(
      `${name} - loads successfully`,
      response.ok,
      `HTTP ${response.status}`
    )

    if (response.ok) {
      const html = await response.text()
      
      // Check for expected content
      for (const content of expectedContent) {
        const found = html.includes(content)
        addTest(
          `${name} - contains "${content}"`,
          found,
          found ? 'Found' : 'Not found'
        )
      }

      return html
    }
    
    return null
  } catch (error) {
    addTest(`${name} - loads successfully`, false, error.message)
    return null
  }
}

async function runTests() {
  try {
    console.log('\n📋 Step 1: Test Payment Selection Page')
    
    await testPage(
      'Payment page',
      '/payment',
      [
        'ClassGuru',
        'trial-plan',
        'monthly-plan',
        'Start Trial',
        'Subscribe',
        'app.js',
        'styles.css'
      ]
    )

    console.log('\n📋 Step 2: Test Success Page')
    
    await testPage(
      'Success page',
      '/payment/success',
      [
        'Success',
        'Payment',
        'result.js'
      ]
    )

    console.log('\n📋 Step 3: Test Cancel Page')
    
    await testPage(
      'Cancel page',
      '/payment/cancel',
      [
        'Cancel',
        'result.js'
      ]
    )

    console.log('\n📋 Step 4: Test Static Assets')
    
    // Test CSS file
    const cssResponse = await fetch(`${BASE_URL}/payment/styles.css`)
    addTest('CSS file loads', cssResponse.ok, `HTTP ${cssResponse.status}`)
    
    if (cssResponse.ok) {
      const css = await cssResponse.text()
      addTest('CSS contains styles', css.includes('body') || css.includes('.'), 'Valid CSS')
    }

    // Test JavaScript files
    const appJsResponse = await fetch(`${BASE_URL}/payment/app.js`)
    addTest('app.js loads', appJsResponse.ok, `HTTP ${appJsResponse.status}`)
    
    if (appJsResponse.ok) {
      const js = await appJsResponse.text()
      addTest(
        'app.js contains payment logic',
        js.includes('handlePayment') || js.includes('payment'),
        'Payment functions found'
      )
    }

    const resultJsResponse = await fetch(`${BASE_URL}/payment/result.js`)
    addTest('result.js loads', resultJsResponse.ok, `HTTP ${resultJsResponse.status}`)

    console.log('\n📋 Step 5: Test Page Structure')
    
    const paymentHtml = await fetch(`${BASE_URL}/payment`).then(r => r.text())
    
    // Check for required HTML elements
    const hasButtons = paymentHtml.includes('data-plan="trial-plan"') && 
                      paymentHtml.includes('data-plan="monthly-plan"')
    addTest('Payment page has plan buttons', hasButtons, 'Both plan buttons found')
    
    const hasTitle = paymentHtml.includes('<title>')
    addTest('Payment page has title tag', hasTitle, 'Title tag found')
    
    const hasViewport = paymentHtml.includes('viewport')
    addTest('Payment page has viewport meta', hasViewport, 'Responsive design enabled')

    console.log('\n📋 Step 6: Test Content-Type Headers')
    
    const htmlResponse = await fetch(`${BASE_URL}/payment`)
    const htmlContentType = htmlResponse.headers.get('content-type')
    addTest(
      'HTML served with correct content-type',
      htmlContentType?.includes('text/html'),
      htmlContentType
    )

    const cssResponse2 = await fetch(`${BASE_URL}/payment/styles.css`)
    const cssContentType = cssResponse2.headers.get('content-type')
    addTest(
      'CSS served with correct content-type',
      cssContentType?.includes('text/css') || cssContentType?.includes('stylesheet'),
      cssContentType
    )

    const jsResponse2 = await fetch(`${BASE_URL}/payment/app.js`)
    const jsContentType = jsResponse2.headers.get('content-type')
    addTest(
      'JS served with correct content-type',
      jsContentType?.includes('javascript') || jsContentType?.includes('application/javascript'),
      jsContentType
    )

    console.log('\n' + '='.repeat(80))
    console.log(`✅ Frontend Tests: ${testResults.passed} passed, ${testResults.failed} failed`)
    console.log('='.repeat(80))

    // Save results
    writeFileSync(
      resolve(__dirname, '../test-results/5-frontend-test.json'),
      JSON.stringify(testResults, null, 2)
    )

    process.exit(testResults.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n❌ Frontend Test Failed:', error.message)
    addTest('Fatal error', false, error.message)
    process.exit(1)
  }
}

runTests()

