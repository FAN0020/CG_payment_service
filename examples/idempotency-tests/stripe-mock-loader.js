// This module intercepts 'stripe' imports and replaces them with our mock

const Module = require('module');
const path = require('path');

const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'stripe') {
    console.log('[MOCK-LOADER] Intercepting Stripe import, loading mock instead');
    const MockStripe = require('./mock-stripe.js');
    return MockStripe;
  }
  return originalRequire.apply(this, arguments);
};

console.log('[MOCK-LOADER] Stripe mock loader installed');

