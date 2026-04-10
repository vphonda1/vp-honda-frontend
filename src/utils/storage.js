// Local Storage Management
export class DataStorage {
  constructor() {
    this.storageKey = 'vp_honda_data';
  }

  // Initialize default data structure
  initializeStorage() {
    const existingData = this.getAllData();
    if (!existingData || Object.keys(existingData).length === 0) {
      const defaultData = {
        customers: [],
        vehicles: [],
        sales: [],
        employees: [],
        attendance: [],
        invoices: [],
        inquiries: [],
        reminders: [],
        settings: {
          showroomLocation: {
            lat: 23.2599,
            lng: 77.4126,
            radius: 100 // meters
          },
          businessName: 'V P HONDA',
          address: 'Bhopal, Madhya Pradesh',
          gst: '',
          pan: ''
        }
      };
      this.saveAllData(defaultData);
      return defaultData;
    }
    return existingData;
  }

  // Get all data
  getAllData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error reading data:', error);
      return {};
    }
  }

  // Save all data
  saveAllData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      return false;
    }
  }

  // Get specific data type
  getData(type) {
    const allData = this.getAllData();
    return allData[type] || [];
  }

  // Update specific data type
  updateData(type, data) {
    const allData = this.getAllData();
    allData[type] = data;
    return this.saveAllData(allData);
  }

  // Add item to data type
  addItem(type, item) {
    const data = this.getData(type);
    const newItem = {
      ...item,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };
    data.push(newItem);
    return this.updateData(type, data);
  }

  // Update item
  updateItem(type, id, updates) {
    const data = this.getData(type);
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
      return this.updateData(type, data);
    }
    return false;
  }

  // Delete item
  deleteItem(type, id) {
    const data = this.getData(type);
    const filteredData = data.filter(item => item.id !== id);
    return this.updateData(type, filteredData);
  }

  // Search items
  searchItems(type, query, fields = []) {
    const data = this.getData(type);
    if (!query) return data;
    
    return data.filter(item => {
      return fields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(query.toLowerCase());
      });
    });
  }

  // Export data to Excel format
  exportToExcel(type) {
    const data = this.getData(type);
    return data;
  }

  // Import data from Excel
  importFromExcel(type, data) {
    return this.updateData(type, data);
  }

  // Backup all data
  createBackup() {
    const allData = this.getAllData();
    const backup = {
      data: allData,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Create downloadable file
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `vp_honda_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    return backup;
  }

  // Restore from backup
  restoreBackup(backupData) {
    try {
      const parsed = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
      return this.saveAllData(parsed.data);
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }
}

export const storage = new DataStorage();
