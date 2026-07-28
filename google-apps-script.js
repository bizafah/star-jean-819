/**
 * ============================================================
 *  STAR JEANS 819  –  Google Apps Script
 *  Paste this ENTIRE file into the Google Apps Script editor.
 *
 *  HOW TO SET UP:
 *  1. Go to https://sheets.google.com and create a new spreadsheet.
 *  2. Name it "Star Jeans 819".
 *  3. Click Extensions → Apps Script.
 *  4. Delete all existing code in the editor.
 *  5. Paste THIS entire file.
 *  6. Click Save (Ctrl+S).
 *  7. Click Deploy → New Deployment.
 *  8. Click the gear icon next to "Select type" → Web App.
 *  9. Set "Execute as" = Me, "Who has access" = Anyone.
 * 10. Click Deploy → Authorize → Allow.
 * 11. Copy the Web App URL shown.
 * 12. Open data.js in your website folder.
 * 13. Replace 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' with that URL.
 * ============================================================
 */

const SHEET_NAME_PRODUCTS = 'Products';
const SHEET_NAME_ORDERS   = 'Orders';

// Column headers
const PRODUCT_HEADERS = [
  'ID', 'Name', 'Category', 'Price', 'Discount', 'Final Price',
  'Colors', 'Description', 'Top Selling', 'Stock XS', 'Stock S',
  'Stock M', 'Stock L', 'Stock XL', 'Images Count', 'Created At', 'Updated At'
];

const ORDER_HEADERS = [
  'Order ID', 'Date', 'Status',
  'Customer Name', 'Phone', 'Address', 'Notes',
  'Items (JSON)', 'Item Count', 'Subtotal (Rs)', 'Delivery (Rs)', 'Total (Rs)',
  'Payment Method'
];

// ─── Entry point ────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const type    = payload.type;
    const data    = payload.data;

    if (type === 'product') {
      saveProduct(data);
    } else if (type === 'order') {
      saveOrder(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Allow GET requests to check the script is alive
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'Star Jeans 819 script is running.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Sheet helpers ──────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Style the header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

// ─── Save / Update Product ──────────────────────────────────
function saveProduct(p) {
  const sheet   = getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  const allData = sheet.getDataRange().getValues();
  const idCol   = 0; // Column A = ID

  // Calculate final price
  const price    = parseFloat(p.price) || 0;
  const discount = parseFloat(p.discount) || 0;
  const final    = discount > 0 ? Math.round(price - (price * discount / 100)) : price;

  const stock  = p.stock || {};
  const row = [
    p.id,
    p.name,
    p.category,
    price,
    discount,
    final,
    p.colors || '',
    p.description || '',
    p.topSelling ? 'Yes' : 'No',
    stock.XS || 0,
    stock.S  || 0,
    stock.M  || 0,
    stock.L  || 0,
    stock.XL || 0,
    p.images ? p.images.length : 0,
    p.createdAt  || new Date().toISOString(),
    p.updatedAt  || ''
  ];

  // Search for existing row to update (skip header row)
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === p.id) {
      // Update existing row
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }

  // Append new row
  sheet.appendRow(row);
  sheet.autoResizeColumns(1, PRODUCT_HEADERS.length);
}

// ─── Save Order ─────────────────────────────────────────────
function saveOrder(o) {
  const sheet = getOrCreateSheet(SHEET_NAME_ORDERS, ORDER_HEADERS);

  const itemsSummary = (o.items || [])
    .map(i => `${i.name} (${i.size}/${i.color}) x${i.quantity}`)
    .join('; ');

  const row = [
    o.id,
    o.createdAt || new Date().toISOString(),
    o.status || 'Pending',
    o.customer.name,
    o.customer.phone,
    o.customer.address,
    o.customer.notes || '',
    itemsSummary,
    o.items ? o.items.length : 0,
    o.subtotal || 0,
    o.deliveryCharge || 350,
    o.total || 0,
    o.paymentMethod || 'Cash on Delivery'
  ];

  sheet.appendRow(row);

  // Color-code by status
  const lastRow   = sheet.getLastRow();
  const statusMap = {
    'Pending':   '#fff3cd',
    'Confirmed': '#d1ecf1',
    'Shipped':   '#cce5ff',
    'Delivered': '#d4edda',
    'Cancelled': '#f8d7da'
  };
  const bgColor = statusMap[o.status] || '#ffffff';
  sheet.getRange(lastRow, 1, 1, ORDER_HEADERS.length).setBackground(bgColor);
  sheet.autoResizeColumns(1, ORDER_HEADERS.length);
}

/**
 * ── MANUAL SETUP FUNCTION ──────────────────────────────────
 * Run this once from the Apps Script editor to create
 * both sheets with headers automatically.
 * Go to the editor, select "setupSheets" from the function
 * dropdown at the top, and click Run.
 */
function setupSheets() {
  getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  getOrCreateSheet(SHEET_NAME_ORDERS,   ORDER_HEADERS);
  SpreadsheetApp.getUi().alert('✅ Sheets created! Products and Orders tabs are ready.');
}
