// PartsInventoryManager.js
// Pure JavaScript utility - NO JSX
// Handles parts inventory operations

export const getInventory = () => {
  try {
    const inventory = localStorage.getItem('partsInventory');
    return inventory ? JSON.parse(inventory) : {};
  } catch (error) {
    console.error('Error getting inventory:', error);
    return {};
  }
};

export const saveInventory = (inventory) => {
  try {
    localStorage.setItem('partsInventory', JSON.stringify(inventory));
    console.log('✅ Inventory saved');
    return true;
  } catch (error) {
    console.error('Error saving inventory:', error);
    return false;
  }
};

export const updatePartStock = (partNo, quantity, action = 'set') => {
  try {
    const inventory = getInventory();
    
    if (!inventory[partNo]) {
      inventory[partNo] = {
        partNo,
        stock: quantity,
        soldCount: 0,
        lastUpdated: new Date().toISOString()
      };
    } else {
      if (action === 'reduce') {
        inventory[partNo].stock = Math.max(0, inventory[partNo].stock - quantity);
        inventory[partNo].soldCount += quantity;
      } else if (action === 'increase') {
        inventory[partNo].stock += quantity;
      } else {
        inventory[partNo].stock = quantity;
      }
      inventory[partNo].lastUpdated = new Date().toISOString();
    }

    saveInventory(inventory);
    return inventory[partNo];
  } catch (error) {
    console.error(`Error updating part ${partNo}:`, error);
    return null;
  }
};

export const reduceStockForInvoice = (partsData) => {
  try {
    console.log('🔻 Reducing stock for invoice parts:', partsData);
    
    partsData.forEach(item => {
      updatePartStock(item.partNo, item.quantity, 'reduce');
    });

    return true;
  } catch (error) {
    console.error('Error reducing stock:', error);
    return false;
  }
};

export const getLowStockAlerts = () => {
  try {
    const inventory = getInventory();
    const lowStockParts = Object.values(inventory).filter(part => part.stock < 10);
    return lowStockParts;
  } catch (error) {
    console.error('Error getting low stock alerts:', error);
    return [];
  }
};

export const getTopSoldParts = (limit = 5) => {
  try {
    const inventory = getInventory();
    const sortedParts = Object.values(inventory)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, limit);
    return sortedParts;
  } catch (error) {
    console.error('Error getting top sold parts:', error);
    return [];
  }
};

export const getInventoryStats = () => {
  try {
    const inventory = getInventory();
    const parts = Object.values(inventory);

    return {
      totalParts: parts.length,
      totalStock: parts.reduce((sum, p) => sum + (p.stock || 0), 0),
      totalSold: parts.reduce((sum, p) => sum + (p.soldCount || 0), 0),
      lowStockCount: parts.filter(p => p.stock < 10).length,
      outOfStock: parts.filter(p => p.stock === 0).length
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      totalParts: 0,
      totalStock: 0,
      totalSold: 0,
      lowStockCount: 0,
      outOfStock: 0
    };
  }
};

export const initializePart = (partNo, description = '', stock = 100) => {
  try {
    const inventory = getInventory();
    
    if (!inventory[partNo]) {
      inventory[partNo] = {
        partNo,
        description,
        stock,
        soldCount: 0,
        lastUpdated: new Date().toISOString()
      };
      saveInventory(inventory);
      console.log(`✅ Part ${partNo} initialized`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error initializing part:', error);
    return false;
  }
};

export const getPartByNumber = (partNo) => {
  try {
    const inventory = getInventory();
    return inventory[partNo] || null;
  } catch (error) {
    console.error('Error getting part:', error);
    return null;
  }
};

export const getPartsByCategory = (category) => {
  try {
    const inventory = getInventory();
    return Object.values(inventory).filter(part => part.category === category);
  } catch (error) {
    console.error('Error getting parts by category:', error);
    return [];
  }
};