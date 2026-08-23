// InventorySyncManager.js
// Pure JavaScript utility - NO JSX
// Handles invoice-to-parts synchronization

export const getTaxInvoiceStats = () => {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    const lastImport = JSON.parse(localStorage.getItem('lastPDFImport')) || {};

    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totals?.totalAmount || 0), 0);
    const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    return {
      totalTaxInvoices: lastImport.totalImported || totalInvoices,
      totalRevenue: totalRevenue,
      averageInvoiceValue: avgInvoiceValue,
      totalPartsSold: 0
    };
  } catch (error) {
    console.error('Error getting tax invoice stats:', error);
    return {
      totalTaxInvoices: 0,
      totalRevenue: 0,
      averageInvoiceValue: 0,
      totalPartsSold: 0
    };
  }
};

export const syncInvoiceWithInventory = (invoice) => {
  try {
    console.log('📊 Syncing invoice with inventory:', invoice.invoiceNumber);

    if (invoice.items && invoice.items.length > 0) {
      const partsToReduce = invoice.items.map(item => ({
        partNo: item.partNo,
        quantity: item.quantity || 1
      }));

      const inventory = JSON.parse(localStorage.getItem('partsInventory')) || {};
      
      partsToReduce.forEach(part => {
        if (inventory[part.partNo]) {
          inventory[part.partNo].stock = Math.max(0, (inventory[part.partNo].stock || 0) - part.quantity);
          inventory[part.partNo].soldCount = (inventory[part.partNo].soldCount || 0) + part.quantity;
          inventory[part.partNo].lastUpdated = new Date().toISOString();
        }
      });

      localStorage.setItem('partsInventory', JSON.stringify(inventory));

      const mappings = JSON.parse(localStorage.getItem('invoicePartsMapped')) || {};
      mappings[invoice.invoiceNumber] = {
        invoiceNumber: invoice.invoiceNumber,
        parts: partsToReduce,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('invoicePartsMapped', JSON.stringify(mappings));

      console.log('✅ Invoice synced with inventory');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error syncing invoice:', error);
    return false;
  }
};

export const getPartsWiseRevenue = () => {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    const partsRevenue = {};

    invoices.forEach(invoice => {
      if (invoice.items) {
        invoice.items.forEach(item => {
          if (!partsRevenue[item.partNo]) {
            partsRevenue[item.partNo] = {
              partNo: item.partNo,
              totalRevenue: 0,
              totalQtySold: 0,
              unitPrice: item.price || 0
            };
          }
          partsRevenue[item.partNo].totalRevenue += (item.price || 0) * (item.quantity || 1);
          partsRevenue[item.partNo].totalQtySold += item.quantity || 1;
        });
      }
    });

    return Object.values(partsRevenue).sort((a, b) => b.totalRevenue - a.totalRevenue);
  } catch (error) {
    console.error('Error getting revenue:', error);
    return [];
  }
};

export const initializeInventoryFromInvoices = () => {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    const inventory = JSON.parse(localStorage.getItem('partsInventory')) || {};

    invoices.forEach(invoice => {
      if (invoice.items) {
        invoice.items.forEach(item => {
          if (!inventory[item.partNo]) {
            inventory[item.partNo] = {
              partNo: item.partNo,
              stock: 100,
              soldCount: 0,
              lastUpdated: new Date().toISOString()
            };
          }
        });
      }
    });

    localStorage.setItem('partsInventory', JSON.stringify(inventory));
    console.log('✅ Inventory initialized');
    return true;
  } catch (error) {
    console.error('Error initializing inventory:', error);
    return false;
  }
};