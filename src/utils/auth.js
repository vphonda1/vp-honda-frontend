// User Authentication
export class AuthSystem {
  constructor() {
    this.authKey = 'vp_honda_auth';
    this.sessionKey = 'vp_honda_session';
  }

  // Initialize default admin user
  initializeAuth() {
    const users = this.getUsers();
    if (users.length === 0) {
      // Create default admin
      this.createUser({
        username: 'admin',
        password: 'admin123', // Should be changed on first login
        role: 'admin',
        name: 'V P HONDA Admin',
        permissions: ['all']
      });
    }
  }

  // Get all users
  getUsers() {
    try {
      const users = localStorage.getItem(this.authKey);
      return users ? JSON.parse(users) : [];
    } catch (error) {
      console.error('Error reading users:', error);
      return [];
    }
  }

  // Save users
  saveUsers(users) {
    try {
      localStorage.setItem(this.authKey, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('Error saving users:', error);
      return false;
    }
  }

  // Create user
  createUser(userData) {
    const users = this.getUsers();
    const newUser = {
      id: Date.now(),
      ...userData,
      createdAt: new Date().toISOString(),
      active: true
    };
    users.push(newUser);
    return this.saveUsers(users);
  }

  // Login
  login(username, password) {
    const users = this.getUsers();
    const user = users.find(u => 
      u.username === username && 
      u.password === password && 
      u.active
    );

    if (user) {
      const session = {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
        loginTime: new Date().toISOString()
      };
      
      sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
      return session;
    }
    
    return null;
  }

  // Logout
  logout() {
    sessionStorage.removeItem(this.sessionKey);
  }

  // Get current session
  getSession() {
    try {
      const session = sessionStorage.getItem(this.sessionKey);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      return null;
    }
  }

  // Check permission
  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;
    
    if (session.permissions.includes('all')) return true;
    return session.permissions.includes(permission);
  }

  // Update user
  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      return this.saveUsers(users);
    }
    return false;
  }

  // Delete user
  deleteUser(userId) {
    const users = this.getUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    return this.saveUsers(filteredUsers);
  }
}

export const auth = new AuthSystem();