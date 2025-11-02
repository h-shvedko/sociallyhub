#!/usr/bin/env node

/**
 * PDF Conversion Script for PRODUCT_OVERVIEW.html
 *
 * Usage: node scripts/convert-to-pdf.js
 *
 * This script uses Puppeteer to convert the HTML product overview
 * to a professionally formatted PDF with proper page breaks and styling.
 */

const fs = require('fs');
const path = require('path');

async function convertToPDF() {
  console.log('🚀 Starting PDF conversion...');

  // Check if puppeteer is installed
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (error) {
    console.error('❌ Puppeteer is not installed.');
    console.log('\nTo install, run:');
    console.log('  npm install --save-dev puppeteer');
    console.log('\nOr use the browser method:');
    console.log('  1. Open PRODUCT_OVERVIEW.html in your browser');
    console.log('  2. Press Ctrl+P (or Cmd+P on Mac)');
    console.log('  3. Select "Save as PDF"');
    console.log('  4. Click "Save"');
    process.exit(1);
  }

  const htmlPath = path.join(__dirname, '..', 'PRODUCT_OVERVIEW.html');
  const pdfPath = path.join(__dirname, '..', 'PRODUCT_OVERVIEW.pdf');

  // Check if HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  console.log('📄 Reading HTML file...');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('📝 Loading content...');
  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0'
  });

  console.log('🖨️  Generating PDF...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    },
    preferCSSPageSize: true,
  });

  await browser.close();

  const stats = fs.statSync(pdfPath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('✅ PDF created successfully!');
  console.log(`📁 Location: ${pdfPath}`);
  console.log(`📊 Size: ${fileSizeInMB} MB`);
  console.log('\n🎉 Done! Your professional product overview is ready.');
}

// Run the conversion
convertToPDF().catch(error => {
  console.error('❌ Error during PDF conversion:', error.message);
  process.exit(1);
});
