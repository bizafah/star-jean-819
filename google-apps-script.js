/**
 * ============================================================
 *  STAR JEANS 819  –  Google Apps Script  (v2 – centralized)
 *
 *  HOW TO SET UP (or RE-DEPLOY after changes):
 *  1. Open your Google Spreadsheet → Extensions → Apps Script
 *  2. Replace ALL existing code with this file
 *  3. Save (Ctrl+S)
 *  4. Click Deploy → Manage Deployments
 *  5. Click the pencil ✏ on your existing deployment
 *  6. Change "Version" to "New version"  → click Deploy
 *  7. The URL stays the same – no need to update data.js again
 *
 *  If deploying for the FIRST TIME follow the full setup in README.
 * ============================================================
 */

const SHEET_NAME_PRODUCTS = 'Products';
const SHEET_NAME_ORDERS   = 'Orders';

const PRODUCT_HEADERS = [
  'ID', 'Name', 'Category', 'Price (Rs)', 'Discounted Amount (Rs)', 'Final Price (Rs)',
  'Colors', 'Description', 'Top Selling',
  'Stock (JSON)', 'Stock Summary',
  'Images Count', 'Images (URLs)',
  'Created At', 'Updated At'
];

const ORDER_HEADERS = [
  'Order ID', 'Date', 'Status',
  'Customer Name', 'Phone', 'Address', 'Notes',
  'Items Summary', 'Item Count',
  'Subtotal (Rs)', 'Delivery (Rs)', 'Total (Rs)',
  'Payment Method'
];

// ── CORS helper ─────────────────────────────────────────────
function corsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET  →  return all products + orders as JSON ─────────────
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === 'getProducts') {
      return corsOutput({ success: true, data: getAllProducts() });
    }
    if (action === 'getOrders') {
      return corsOutput({ success: true, data: getAllOrders() });
    }
    // Default: return both
    return corsOutput({
      success:  true,
      products: getAllProducts(),
      orders:   getAllOrders()
    });
  } catch (err) {
    return corsOutput({ success: false, error: err.message });
  }
}

// ── POST  →  write / update data ────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { type, data } = payload;

    if (type === 'product')             { saveProduct(data);                          }
    else if (type === 'deleteProduct')  { deleteProductRow(data.id);                  }
    else if (type === 'order')          { saveOrder(data);                             }
    else if (type === 'updateStock')    { applyStockDeduction(data.items);             }
    else if (type === 'updateOrderStatus') { updateOrderStatusInSheet(data.id, data.status); }

    return corsOutput({ success: true });
  } catch (err) {
    return corsOutput({ success: false, error: err.message });
  }
}

// ── READ ALL PRODUCTS ────────────────────────────────────────
function getAllProducts() {
  const sheet = getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

    // Col 9 = Stock JSON, no images column anymore
    let stock = {};
    const col9 = String(r[9] || '').trim();
    if (col9.startsWith('{')) {
      try { stock = JSON.parse(col9); } catch { stock = {}; }
    } else if (col9 !== '' && !isNaN(Number(col9))) {
      stock = {
        XS: Number(r[9])  || 0,
        S:  Number(r[10]) || 0,
        M:  Number(r[11]) || 0,
        L:  Number(r[12]) || 0,
        XL: Number(r[13]) || 0
      };
    }

    // Col 12 = Images URLs JSON array, col 13 = createdAt, col 14 = updatedAt
    let images = [];
    try { images = JSON.parse(String(r[12] || '[]')); } catch { images = []; }
    // Handle old rows that had no images column (empty string or missing)
    if (!Array.isArray(images)) images = [];

    products.push({
      id:               String(r[0]),
      name:             String(r[1]),
      category:         String(r[2]),
      price:            Number(r[3]) || 0,
      discountedAmount: Number(r[4]) || 0,
      finalPrice:       Number(r[5]) || 0,
      colors:           String(r[6] || ''),
      description:      String(r[7] || ''),
      topSelling:       r[8] === 'Yes' || r[8] === true,
      stock,
      images,                          // CDN URLs – visible on all devices
      imagesCount:      images.length,
      createdAt:        String(r[13] || ''),
      updatedAt:        String(r[14] || '')
    });
  }
  return products;
}

// ── READ ALL ORDERS ──────────────────────────────────────────
function getAllOrders() {
  const sheet = getOrCreateSheet(SHEET_NAME_ORDERS, ORDER_HEADERS);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const orders = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

    let items = [];
    try { items = JSON.parse(r[13] || '[]'); } catch { items = []; }

    orders.push({
      id:             String(r[0]),
      createdAt:      String(r[1] || ''),
      status:         String(r[2] || 'Pending'),
      customer: {
        name:    String(r[3] || ''),
        phone:   String(r[4] || ''),
        address: String(r[5] || ''),
        notes:   String(r[6] || '')
      },
      itemsSummary:   String(r[7] || ''),
      itemCount:      Number(r[8]) || 0,
      subtotal:       Number(r[9]) || 0,
      deliveryCharge: Number(r[10]) || 350,
      total:          Number(r[11]) || 0,
      paymentMethod:  String(r[12] || 'Cash on Delivery'),
      items
    });
  }
  return orders;
}

// ── SAVE / UPDATE PRODUCT ────────────────────────────────────
function saveProduct(p) {
  const sheet   = getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  const allData = sheet.getDataRange().getValues();

  const price           = parseFloat(p.price) || 0;
  const discountedAmt   = parseFloat(p.discountedAmount) || 0;
  const finalPrice      = discountedAmt > 0 ? Math.round(price - discountedAmt) : price;
  const stock           = p.stock || {};
  const stockJSON       = JSON.stringify(stock);

  const stockSummary = Object.entries(stock)
    .filter(([,qty]) => qty > 0)
    .map(([size, qty]) => `${size}:${qty}`)
    .join(', ') || 'Out of stock';

  const imagesURLs = JSON.stringify(p.images || []);

  // 15 columns: ID → Name → Category → Price → DiscountAmt → FinalPrice →
  //             Colors → Description → TopSelling → Stock(JSON) → StockSummary →
  //             ImagesCount → Images(URLs) → CreatedAt → UpdatedAt
  const row = [
    p.id,
    p.name,
    p.category,
    price,
    discountedAmt,
    finalPrice,
    p.colors      || '',
    p.description || '',
    p.topSelling  ? 'Yes' : 'No',
    stockJSON,
    stockSummary,
    (p.images || []).length,
    imagesURLs,
    p.createdAt  || new Date().toISOString(),
    p.updatedAt  || ''
  ];

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(p.id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
  sheet.autoResizeColumns(1, PRODUCT_HEADERS.length);
}

// ── DELETE PRODUCT ROW ────────────────────────────────────────
function deleteProductRow(id) {
  const sheet   = getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// ── SAVE ORDER ────────────────────────────────────────────────
function saveOrder(o) {
  const sheet = getOrCreateSheet(SHEET_NAME_ORDERS, ORDER_HEADERS);

  const itemsSummary = (o.items || [])
    .map(i => `${i.name} (${i.size}/${i.color}) x${i.quantity}`)
    .join('; ');

  const itemsJSON = JSON.stringify(o.items || []);

  // Cols 0-12 (visible), col 13 = items JSON
  const row = [
    o.id,
    o.createdAt    || new Date().toISOString(),
    o.status       || 'Pending',
    o.customer.name,
    o.customer.phone,
    o.customer.address,
    o.customer.notes  || '',
    itemsSummary,
    o.items ? o.items.length : 0,
    o.subtotal        || 0,
    o.deliveryCharge  || 350,
    o.total           || 0,
    o.paymentMethod   || 'Cash on Delivery',
    itemsJSON  // col 13
  ];

  sheet.appendRow(row);

  // Color-code row by status
  const lastRow  = sheet.getLastRow();
  const colorMap = {
    Pending:   '#fff3cd',
    Confirmed: '#d1ecf1',
    Shipped:   '#cce5ff',
    Delivered: '#d4edda',
    Cancelled: '#f8d7da'
  };
  sheet.getRange(lastRow, 1, 1, ORDER_HEADERS.length + 1)
       .setBackground(colorMap[o.status] || '#ffffff');
  sheet.autoResizeColumns(1, ORDER_HEADERS.length);
}

// ── UPDATE ORDER STATUS ──────────────────────────────────────
function updateOrderStatusInSheet(orderId, status) {
  const sheet   = getOrCreateSheet(SHEET_NAME_ORDERS, ORDER_HEADERS);
  const allData = sheet.getDataRange().getValues();
  const colorMap = {
    Pending:   '#fff3cd',
    Confirmed: '#d1ecf1',
    Shipped:   '#cce5ff',
    Delivered: '#d4edda',
    Cancelled: '#f8d7da'
  };
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(orderId)) {
      sheet.getRange(i + 1, 3).setValue(status); // col C = Status
      sheet.getRange(i + 1, 1, 1, ORDER_HEADERS.length + 1)
           .setBackground(colorMap[status] || '#ffffff');
      return;
    }
  }
}

// ── DEDUCT STOCK AFTER ORDER ─────────────────────────────────
function applyStockDeduction(items) {
  if (!items || items.length === 0) return;
  const sheet   = getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  const allData = sheet.getDataRange().getValues();

  // Col 9 = stock JSON (1-indexed col 10), Col 10 = stock summary (col 11)
  const STOCK_COL   = 10; // 1-indexed
  const SUMMARY_COL = 11;

  items.forEach(item => {
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === String(item.productId)) {
        let stock = {};
        try { stock = JSON.parse(allData[i][9] || '{}'); } catch { stock = {}; }

        const cur  = parseInt(stock[item.size]) || 0;
        stock[item.size] = Math.max(0, cur - item.quantity);
        allData[i][9]    = JSON.stringify(stock); // keep in-memory updated

        const summary = Object.entries(stock)
          .filter(([,qty]) => qty > 0)
          .map(([s,q]) => `${s}:${q}`)
          .join(', ') || 'Out of stock';

        sheet.getRange(i + 1, STOCK_COL).setValue(JSON.stringify(stock));
        sheet.getRange(i + 1, SUMMARY_COL).setValue(summary);
        return;
      }
    }
  });
}

// ── SHEET BOOTSTRAP ──────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground('#1a1a2e');
    hr.setFontColor('#ffffff');
    hr.setFontWeight('bold');
    hr.setFontSize(11);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/** Run once from editor to create both sheets */
function setupSheets() {
  getOrCreateSheet(SHEET_NAME_PRODUCTS, PRODUCT_HEADERS);
  getOrCreateSheet(SHEET_NAME_ORDERS,   ORDER_HEADERS);
  SpreadsheetApp.getUi().alert('✅ Sheets ready – Products and Orders tabs created.');
}
