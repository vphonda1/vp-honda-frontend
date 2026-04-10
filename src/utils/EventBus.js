// EventBus.js
// Central event system for real-time updates across all pages

class EventBusClass {
  constructor() {
    this.events = {};
  }

  // Subscribe to event
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  // Emit event
  emit(event, data) {
    console.log(`📢 EventBus: ${event}`, data);
    
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Clear all listeners for an event
  clear(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  // Get listener count
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}

// Create singleton instance
export const EventBus = new EventBusClass();

// Export for use in components
export default EventBus;

// EVENT NAMES (use these constants)
export const EVENTS = {
  INVOICE_UPDATED: 'invoice:updated',
  INVOICE_CREATED: 'invoice:created',
  INVOICE_DELETED: 'invoice:deleted',
  PARTS_UPDATED: 'parts:updated',
  INVENTORY_SYNC: 'inventory:synced',
  DASHBOARD_REFRESH: 'dashboard:refresh',
  DATA_CHANGED: 'data:changed'
};