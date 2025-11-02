#!/usr/bin/env node

/**
 * PDF Conversion Script using Playwright (already installed in project)
 *
 * Usage: node scripts/convert-to-pdf-playwright.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function convertToPDF() {
  console.log('🚀 Starting PDF conversion with Playwright...');

  const htmlPath = path.join(__dirname, '..', 'PRODUCT_OVERVIEW.html');
  const pdfPath = path.join(__dirname, '..', 'PRODUCT_OVERVIEW.pdf');

  // Check if HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  console.log('📄 Reading HTML file...');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const fileUrl = `file://${htmlPath}`;

  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  console.log('📝 Loading content...');
  await page.goto(fileUrl, {
    waitUntil: 'networkidle'
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
  console.log('\n💡 Tip: Make sure Playwright browsers are installed:');
  console.log('   npx playwright install chromium');
  process.exit(1);
});
