/**
 * Test Runner for Ad Service Tests
 */

import { runAdServiceTests } from './ad-service-tests.js';

async function main() {
  console.log('🎯 Starting Ad Service Integration Tests');
  console.log('============================================================\n');
  
  try {
    const results = await runAdServiceTests();
    
    console.log('\n============================================================');
    console.log('📊 Test Results Summary');
    console.log('============================================================');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}`);
        if (r.errors) {
          r.errors.forEach(e => console.log(`     ${e}`));
        }
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

main();

