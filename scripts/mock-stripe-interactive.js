#!/usr/bin/env node

/**
 * Interactive Mock Stripe Script
 * 
 * This script lets you choose different Stripe scenarios to test
 * the payment flow without needing actual Stripe credentials.
 */

import readline from 'readline';
import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║        🧪 Mock Stripe Interactive Testing Tool             ║'));
console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗\n'));

console.log(chalk.yellow('Choose a scenario to test:\n'));

const scenarios = [
  {
    id: 'success',
    name: '✅ Successful Payment',
    description: 'Simulates a successful Stripe checkout',
    envVars: {
      MOCK_STRIPE_MODE: 'true',
      MOCK_STRIPE_SCENARIO: 'success'
    }
  },
  {
    id: 'cancel',
    name: '❌ Cancelled Payment',
    description: 'User cancels during Stripe checkout',
    envVars: {
      MOCK_STRIPE_MODE: 'true',
      MOCK_STRIPE_SCENARIO: 'cancel'
    }
  },
  {
    id: 'expired',
    name: '⏰ Expired Session',
    description: 'Checkout session has expired',
    envVars: {
      MOCK_STRIPE_MODE: 'true',
      MOCK_STRIPE_SCENARIO: 'expired'
    }
  },
  {
    id: 'invalid_card',
    name: '💳 Invalid Card',
    description: 'Card payment fails',
    envVars: {
      MOCK_STRIPE_MODE: 'true',
      MOCK_STRIPE_SCENARIO: 'invalid_card'
    }
  },
  {
    id: 'webhook_fail',
    name: '🔗 Webhook Failure',
    description: 'Webhook processing fails',
    envVars: {
      MOCK_STRIPE_MODE: 'true',
      MOCK_STRIPE_SCENARIO: 'webhook_fail'
    }
  },
  {
    id: 'real',
    name: '🌐 Real Stripe (requires setup)',
    description: 'Use actual Stripe API',
    envVars: {
      MOCK_STRIPE_MODE: 'false'
    }
  }
];

scenarios.forEach((scenario, index) => {
  console.log(chalk.bold(`  ${index + 1}. ${scenario.name}`));
  console.log(chalk.gray(`     ${scenario.description}\n`));
});

rl.question(chalk.cyan('Enter your choice (1-6): '), (answer) => {
  const choice = parseInt(answer) - 1;
  
  if (choice < 0 || choice >= scenarios.length) {
    console.log(chalk.red('\n❌ Invalid choice. Exiting.\n'));
    rl.close();
    process.exit(1);
  }
  
  const scenario = scenarios[choice];
  
  console.log(chalk.green(`\n✅ Selected: ${scenario.name}\n`));
  console.log(chalk.bold('Set these environment variables:\n'));
  
  Object.entries(scenario.envVars).forEach(([key, value]) => {
    console.log(chalk.yellow(`  export ${key}="${value}"`));
  });
  
  console.log(chalk.gray('\nOr run the server with:\n'));
  const envString = Object.entries(scenario.envVars)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  console.log(chalk.cyan(`  ${envString} npm run dev\n`));
  
  console.log(chalk.bold.green('📝 Next Steps:\n'));
  console.log('  1. Set the environment variables above');
  console.log('  2. Restart the payment service');
  console.log('  3. Click a payment button on http://localhost:8790/payment');
  console.log('  4. Watch the mock response!\n');
  
  rl.close();
});

