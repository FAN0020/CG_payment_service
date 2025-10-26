#!/usr/bin/env node

/**
 * Export Promo Codes to Excel
 * 
 * This script exports all promo codes from the database to an Excel file
 * with separate sheets for available and unavailable codes.
 */

import sqlite3 from 'sqlite3';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = path.join(__dirname, '..', 'data', 'payment.db');

// Output file path
const outputPath = path.join(__dirname, '..', 'promo-codes-export.xlsx');

function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatExpirationDate(timestamp) {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return expiresAt < Date.now();
}

function getStatus(isUsed, expiresAt) {
  if (isUsed) return 'Used';
  if (isExpired(expiresAt)) return 'Expired';
  return 'Available';
}

function exportPromoCodes() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Query all promo codes
    const query = `
      SELECT 
        code,
        plan_type,
        plan_amount,
        plan_currency,
        is_used,
        used_by,
        created_at,
        used_at,
        expires_at
      FROM promo_codes 
      ORDER BY created_at DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error querying database:', err.message);
        reject(err);
        return;
      }

      console.log(`Found ${rows.length} promo codes in database`);

      // Process data for Excel
      const allCodes = rows.map(row => ({
        'Promo Code': row.code,
        'Plan Type': row.plan_type,
        'Amount': `$${row.plan_amount} ${row.plan_currency}`,
        'Status': getStatus(row.is_used, row.expires_at),
        'Used By': row.used_by || 'N/A',
        'Created Date': formatTimestamp(row.created_at),
        'Used Date': formatTimestamp(row.used_at),
        'Expires Date': formatExpirationDate(row.expires_at),
        'Is Used': row.is_used ? 'Yes' : 'No',
        'Is Expired': isExpired(row.expires_at) ? 'Yes' : 'No'
      }));

      // Separate available and unavailable codes
      const availableCodes = allCodes.filter(code => code.Status === 'Available');
      const unavailableCodes = allCodes.filter(code => code.Status !== 'Available');

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add summary sheet
      const summaryData = [
        ['Promo Code Export Summary'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Total Codes:', allCodes.length],
        ['Available Codes:', availableCodes.length],
        ['Used Codes:', unavailableCodes.filter(c => c.Status === 'Used').length],
        ['Expired Codes:', unavailableCodes.filter(c => c.Status === 'Expired').length],
        [''],
        ['Code Format:', 'CG-XXXX-XXXX'],
        ['Discount:', '100% off daily plan ($1.99 SGD)'],
        ['Single Use:', 'Yes'],
        ['Expiration:', '1 year from creation']
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Add all codes sheet
      const allCodesSheet = XLSX.utils.json_to_sheet(allCodes);
      XLSX.utils.book_append_sheet(workbook, allCodesSheet, 'All Codes');

      // Add available codes sheet
      const availableSheet = XLSX.utils.json_to_sheet(availableCodes);
      XLSX.utils.book_append_sheet(workbook, availableSheet, 'Available Codes');

      // Add unavailable codes sheet
      const unavailableSheet = XLSX.utils.json_to_sheet(unavailableCodes);
      XLSX.utils.book_append_sheet(workbook, unavailableSheet, 'Unavailable Codes');

      // Write file
      XLSX.writeFile(workbook, outputPath);

      console.log('\n=== EXPORT COMPLETE ===');
      console.log(`File saved to: ${outputPath}`);
      console.log(`\nSummary:`);
      console.log(`- Total codes: ${allCodes.length}`);
      console.log(`- Available: ${availableCodes.length}`);
      console.log(`- Used: ${unavailableCodes.filter(c => c.Status === 'Used').length}`);
      console.log(`- Expired: ${unavailableCodes.filter(c => c.Status === 'Expired').length}`);
      console.log(`\nSheets created:`);
      console.log(`- Summary: Overview and statistics`);
      console.log(`- All Codes: Complete list with all details`);
      console.log(`- Available Codes: Only unused, non-expired codes`);
      console.log(`- Unavailable Codes: Used and expired codes`);

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('\nDatabase connection closed');
        }
        resolve();
      });
    });
  });
}

// Run the export
if (import.meta.url === `file://${process.argv[1]}`) {
  exportPromoCodes()
    .then(() => {
      console.log('\nExport completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Export failed:', error);
      process.exit(1);
    });
}

export { exportPromoCodes };
