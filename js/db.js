/**
 * TaskEarn - Cloud & Local Data Store Service Layer
 * Powered by JSONBin.io cloud database with real-time multi-client synchronization.
 */

const JSONBIN_CONFIG = {
  MASTER_KEY: '$2a$10$nnSfeJQZY9FjkKghjfzlPuWFrIe/JV46TLSQbnho77T3kkmx/mMvK',
  BIN_ID: '6ac0c39bac6210605a0ee84a',
  BASE_URL: 'https://api.jsonbin.io/v3/b'
};

const STORAGE_KEYS = {
  USERS: 'taskearn_users',
  TASKS: 'taskearn_tasks',
  SUBMISSIONS: 'taskearn_submissions',
  WITHDRAWALS: 'taskearn_withdrawals',
  PAYMENTS: 'taskearn_payments',
  MESSAGES: 'taskearn_messages',
  SETTINGS: 'taskearn_settings',
  CURRENT_USER: 'taskearn_current_user',
  ADMIN_SESSION: 'taskearn_admin_session'
};

// Default System Configuration
const DEFAULT_SETTINGS = {
  pointRateNaira: 1.0,      // 1 Point = 1 Naira
  referralPoints: 150,      // Points rewarded per successful referral
  minWithdrawalNaira: 1000, // Minimum withdrawal threshold in Naira
  verificationFeeNaira: 100, // One-time account verification fee in Naira
  paystackPublicKey: 'pk_live_732d9b62cd035b8dad96e981d7f6982540342e80',
  platformName: 'TaskEarn',
  adminEmail: 'admin@taskearn.com',
  adminPhone: '08012345678',
  adminPassword: 'admin123'
};

// Empty initial state - No ready-made or dummy data
const DEFAULT_TASKS = [];
const DEFAULT_USERS = [];
const DEFAULT_SUBMISSIONS = [];
const DEFAULT_WITHDRAWALS = [];
const DEFAULT_MESSAGES = [];

// Data Store Class
class DataStore {
  constructor() {
    this._syncListeners = [];
    this._pushTimeout = null;
    this._isPushing = false;
    this._pushPromise = null;
    this._hasQueuedPush = false;
    this._isPulling = false;
    this._pullPromise = null;
    this._cloudStatus = {
      connected: false,
      lastSync: null,
      error: null
    };
    this.init();
    this.setupCloudSync();
  }

  init() {
    // One-time purge of any previously loaded ready-made dummy data
    if (!localStorage.getItem('taskearn_clean_state_v1')) {
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
      localStorage.removeItem(STORAGE_KEYS.WITHDRAWALS);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.setItem('taskearn_clean_state_v1', 'true');
    }

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WITHDRAWALS)) {
      localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
    }
  }

  // =================== JSONBIN CLOUD INTEGRATION ===================

  setupCloudSync() {
    // Pull immediately on startup
    this.pullFromCloud();

    if (typeof window !== 'undefined') {
      // Periodic background polling every 15 seconds to keep all users & admin in sync
      setInterval(() => {
        this.pullFromCloud();
      }, 15000);

      // Pull when tab gains focus or becomes visible (throttled to at most once every 12 seconds)
      let lastFocusPull = Date.now();
      const throttledFocusPull = () => {
        const now = Date.now();
        if (now - lastFocusPull >= 12000) {
          lastFocusPull = now;
          this.pullFromCloud();
        }
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          throttledFocusPull();
        }
      });
      window.addEventListener('focus', throttledFocusPull);
    }
  }

  onSync(callback) {
    if (typeof callback === 'function') {
      this._syncListeners.push(callback);
    }
  }

  _notifySync(type, data) {
    this._syncListeners.forEach(cb => {
      try {
        cb(type, data);
      } catch (err) {
        console.error('Error in TaskEarnDB sync listener:', err);
      }
    });
  }

  getCloudStatus() {
    return {
      provider: 'JSONBin.io',
      binId: JSONBIN_CONFIG.BIN_ID,
      connected: this._cloudStatus.connected,
      lastSync: this._cloudStatus.lastSync,
      error: this._cloudStatus.error
    };
  }

  scheduleCloudPush(delay = 300) {
    if (this._pushTimeout) clearTimeout(this._pushTimeout);
    this._pushTimeout = setTimeout(() => {
      this.pushToCloud();
    }, delay);
  }

  async pushToCloud() {
    if (!JSONBIN_CONFIG.MASTER_KEY || !JSONBIN_CONFIG.BIN_ID) return false;

    // Clear any pending debounced timeout since we are pushing now
    if (this._pushTimeout) {
      clearTimeout(this._pushTimeout);
      this._pushTimeout = null;
    }

    // Wait for in-flight pull to finish first so we do not race
    if (this._pullPromise) {
      try {
        await this._pullPromise;
      } catch (e) {}
    }

    // If another push is currently active, queue another push right after it finishes
    if (this._pushPromise) {
      this._hasQueuedPush = true;
      try {
        await this._pushPromise;
      } catch (e) {}
      if (this._hasQueuedPush) {
        this._hasQueuedPush = false;
        return this.pushToCloud();
      }
      return true;
    }

    this._pushPromise = (async () => {
      this._isPushing = true;
      try {
        const payload = {
          settings: this.getSettings(),
          users: this._get(STORAGE_KEYS.USERS),
          tasks: this._get(STORAGE_KEYS.TASKS),
          submissions: this._get(STORAGE_KEYS.SUBMISSIONS),
          withdrawals: this._get(STORAGE_KEYS.WITHDRAWALS),
          payments: this._get(STORAGE_KEYS.PAYMENTS),
          messages: this._get(STORAGE_KEYS.MESSAGES)
        };

        const res = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_CONFIG.MASTER_KEY
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`JSONBin save error: ${res.status} ${res.statusText}`);
        }

        this._cloudStatus.connected = true;
        this._cloudStatus.lastSync = new Date().toISOString();
        this._cloudStatus.error = null;
        // Notify with local flag so UI listeners don't destructively re-render active inputs
        this._notifySync('push', { payload, isLocalPush: true });
        return true;
      } catch (err) {
        console.warn('JSONBin push failed (cached locally):', err.message);
        this._cloudStatus.error = err.message;
        throw err;
      } finally {
        this._isPushing = false;
        this._pushPromise = null;
      }
    })();

    return this._pushPromise;
  }

  async pullFromCloud(force = false) {
    if (!JSONBIN_CONFIG.MASTER_KEY || !JSONBIN_CONFIG.BIN_ID) return null;

    // If local changes are currently pushing, wait so we don't pull stale cloud data
    if (this._isPushing && this._pushPromise) {
      try {
        await this._pushPromise;
      } catch (e) {}
      if (!force) return null;
    }

    // If a pull is currently in-flight, return that active promise so caller waits for fresh data
    if (this._pullPromise) {
      if (!force) {
        return this._pullPromise;
      }
      try {
        await this._pullPromise;
      } catch (e) {}
    }

    this._pullPromise = (async () => {
      this._isPulling = true;
      try {
        // Cache buster + no-cache headers to guarantee fresh data across all browsers/devices
        const res = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}/latest?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'X-Master-Key': JSONBIN_CONFIG.MASTER_KEY,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!res.ok) {
          throw new Error(`JSONBin fetch error: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();
        const record = json.record;

        if (record && typeof record === 'object') {
          const localUsers = this._get(STORAGE_KEYS.USERS);
          const localTasks = this._get(STORAGE_KEYS.TASKS);

          const remoteHasUsers = Array.isArray(record.users) && record.users.length > 0;
          const remoteHasTasks = Array.isArray(record.tasks) && record.tasks.length > 0;

          // If remote is newly initialized & empty, but local has existing accounts or tasks, upload local to remote
          if (!remoteHasUsers && !remoteHasTasks && (localUsers.length > 0 || localTasks.length > 0)) {
            await this.pushToCloud();
          } else {
            // Check if remote data actually differs from local storage to prevent unnecessary UI re-rendering glitches
            const currentUsersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
            const currentTasksStr = localStorage.getItem(STORAGE_KEYS.TASKS) || '[]';
            const currentSubsStr = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]';
            const currentWdrStr = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS) || '[]';
            const currentPayStr = localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]';
            const currentMsgStr = localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]';
            const currentSettingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}';

            const newUsersStr = Array.isArray(record.users) ? JSON.stringify(record.users) : currentUsersStr;
            const newTasksStr = Array.isArray(record.tasks) ? JSON.stringify(record.tasks) : currentTasksStr;
            const newSubsStr = Array.isArray(record.submissions) ? JSON.stringify(record.submissions) : currentSubsStr;
            const newWdrStr = Array.isArray(record.withdrawals) ? JSON.stringify(record.withdrawals) : currentWdrStr;
            const newPayStr = Array.isArray(record.payments) ? JSON.stringify(record.payments) : currentPayStr;
            const newMsgStr = Array.isArray(record.messages) ? JSON.stringify(record.messages) : currentMsgStr;
            const newSettingsStr = record.settings && typeof record.settings === 'object' 
              ? JSON.stringify({ ...this.getSettings(), ...record.settings }) 
              : currentSettingsStr;

            const changedKeys = [];
            if (newUsersStr !== currentUsersStr) {
              localStorage.setItem(STORAGE_KEYS.USERS, newUsersStr);
              changedKeys.push('users');
            }
            if (newTasksStr !== currentTasksStr) {
              localStorage.setItem(STORAGE_KEYS.TASKS, newTasksStr);
              changedKeys.push('tasks');
            }
            if (newSubsStr !== currentSubsStr) {
              localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, newSubsStr);
              changedKeys.push('submissions');
            }
            if (newWdrStr !== currentWdrStr) {
              localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, newWdrStr);
              changedKeys.push('withdrawals');
            }
            if (newPayStr !== currentPayStr) {
              localStorage.setItem(STORAGE_KEYS.PAYMENTS, newPayStr);
              changedKeys.push('payments');
            }
            if (newMsgStr !== currentMsgStr) {
              localStorage.setItem(STORAGE_KEYS.MESSAGES, newMsgStr);
              changedKeys.push('messages');
            }
            if (newSettingsStr !== currentSettingsStr) {
              localStorage.setItem(STORAGE_KEYS.SETTINGS, newSettingsStr);
              changedKeys.push('settings');
            }

            // Refresh current active user session if applicable
            const currentUser = this.getCurrentUser();
            if (currentUser && Array.isArray(record.users)) {
              const updatedProfile = record.users.find(u => u.id === currentUser.id);
              if (updatedProfile && JSON.stringify(updatedProfile) !== JSON.stringify(currentUser)) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedProfile));
              }
            }

            this._cloudStatus.connected = true;
            this._cloudStatus.lastSync = new Date().toISOString();
            this._cloudStatus.error = null;

            // Only trigger sync notifications if there are actual data changes or forced
            if (changedKeys.length > 0 || force) {
              this._notifySync('pull', { record, changedKeys });
            }
            return record;
          }
        }
        return null;
      } catch (err) {
        console.warn('JSONBin pull failed (using local cache):', err.message);
        this._cloudStatus.error = err.message;
        return null;
      } finally {
        this._isPulling = false;
        this._pullPromise = null;
      }
    })();

    return this._pullPromise;
  }

  async syncNow() {
    await this.pullFromCloud(true);
    await this.pushToCloud();
    return this.getCloudStatus();
  }

  // --- Helper getters/setters ---
  _get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    this.scheduleCloudPush();
  }

  // =================== SETTINGS ===================
  getSettings() {
    const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const parsed = s ? JSON.parse(s) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.scheduleCloudPush();
    return updated;
  }

  // =================== ADMIN AUTH ===================
  isAdminLoggedIn() {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  }

  loginAdmin(identifier, password) {
    const settings = this.getSettings();
    const validEmail = settings.adminEmail || 'admin@taskearn.com';
    const validPhone = settings.adminPhone || '08012345678';
    const validPassword = settings.adminPassword || 'admin123';

    const cleanId = String(identifier || '').trim().toLowerCase();
    const isEmail = cleanId === validEmail.toLowerCase();
    const isPhone = this.isPhoneMatch(cleanId, validPhone);

    if ((isEmail || isPhone) && password === validPassword) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      return true;
    }
    throw new Error('Invalid administrator email/phone or password.');
  }

  logoutAdmin() {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
  }

  // =================== USERS & AUTH ===================
  getUsers() {
    return this._get(STORAGE_KEYS.USERS);
  }

  getUserById(id) {
    return this.getUsers().find(u => u.id === id) || null;
  }

  getUserByEmail(email) {
    if (!email) return null;
    return this.getUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  // --- Validation & Normalization Helpers ---
  isPhoneMatch(phoneA, phoneB) {
    if (!phoneA || !phoneB) return false;
    const a = String(phoneA).replace(/[^0-9]/g, '');
    const b = String(phoneB).replace(/[^0-9]/g, '');
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10)) {
      return true;
    }
    return false;
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Please enter a username.');
    }
    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      throw new Error('Please enter a username.');
    }
    if (/[A-Z]/.test(clean)) {
      throw new Error('Username must not contain capital letters. Only lowercase letters (a-z) are allowed.');
    }
    if (!/^[a-z0-9-]+$/.test(clean)) {
      throw new Error('Username can only contain lowercase letters, numbers, and hyphens (-). No other symbols or spaces allowed.');
    }
    if (clean.length < 3 || clean.length > 25) {
      throw new Error('Username must be between 3 and 25 characters long.');
    }
    return clean;
  }

  capitalizeName(str) {
    if (!str) return '';
    return String(str).trim().replace(/(?:^|[\s-])\S/g, match => match.toUpperCase());
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Please enter a password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least 1 capital letter (A-Z).');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least 1 lowercase letter (a-z).');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least 1 number (0-9).');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Password must contain at least 1 symbol or special character (e.g. !@#$%^&*-_).');
    }
    return true;
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Please enter an email address.');
    }
    const clean = email.trim().toLowerCase();
    if (!clean) {
      throw new Error('Please enter an email address.');
    }
    if (!clean.includes('@')) {
      throw new Error('Email address must contain an "@" symbol (e.g. name@example.com).');
    }
    const parts = clean.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Please enter a complete email address before and after "@" (e.g. name@example.com).');
    }
    if (!parts[1].includes('.')) {
      throw new Error('Email domain must contain a "." (e.g. name@gmail.com).');
    }
    const domainParts = parts[1].split('.');
    if (!domainParts[0] || !domainParts[domainParts.length - 1] || domainParts[domainParts.length - 1].length < 2) {
      throw new Error('Email domain must end with a valid extension (e.g. .com, .ng, .org).');
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean) || clean.includes(' ')) {
      throw new Error('Please enter a valid email address format with "@" and "." (e.g. name@example.com).');
    }
    return clean;
  }

  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Please enter a phone number.');
    }
    const clean = phone.trim().replace(/[\s-]/g, '');
    if (!clean) {
      throw new Error('Please enter a phone number.');
    }
    if (!/^\d+$/.test(clean)) {
      throw new Error('Phone number must contain numbers only.');
    }
    if (clean.length !== 11) {
      throw new Error('Phone number must be exactly 11 digits (e.g. 08012345678).');
    }
    return clean;
  }

  getUserByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    return this.getUsers().find(u => u.username && u.username.toLowerCase() === clean) || null;
  }

  getUserByPhone(phone) {
    if (!phone) return null;
    return this.getUsers().find(u => this.isPhoneMatch(u.phone, phone)) || null;
  }

  getUserByIdentifier(identifier) {
    if (!identifier) return null;
    const val = identifier.trim();
    if (val.includes('@')) {
      const byEmail = this.getUserByEmail(val);
      if (byEmail) return byEmail;
    }
    const byUsername = this.getUserByUsername(val);
    if (byUsername) return byUsername;
    const byPhone = this.getUserByPhone(val);
    if (byPhone) return byPhone;
    return this.getUserByEmail(val);
  }

  getUserByReferralCode(code) {
    if (!code) return null;
    const clean = code.trim().toLowerCase().replace(/^@/, '');
    return this.getUsers().find(u => 
      (u.username && u.username.toLowerCase() === clean) || 
      (u.referralCode && u.referralCode.toLowerCase() === clean)
    ) || null;
  }

  generateReferralCode(username) {
    if (!username) return 'user-' + Date.now();
    return username.trim().toLowerCase().replace(/^@/, '');
  }

  registerUser({ firstName, lastName, username, phone, email, password, referralCode }) {
    if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
      throw new Error('First name and last name are required.');
    }

    // Compulsory Username and Password validation
    const cleanUsername = this.validateUsername(username);
    this.validatePassword(password);

    const cleanEmail = this.validateEmail(email);

    // Compulsory Phone validation - strictly 11 digits
    const cleanPhone = this.validatePhone(phone);

    // Strict Uniqueness Checks: Username, Email, Phone can never be duplicate on server
    if (this.getUserByUsername(cleanUsername)) {
      throw new Error('This username is already taken. Please choose another.');
    }
    if (this.getUserByEmail(cleanEmail)) {
      throw new Error('An account with this email address already exists. Please sign in or use another email.');
    }
    if (this.getUserByPhone(cleanPhone)) {
      throw new Error('An account with this phone number already exists.');
    }

    const users = this.getUsers();
    let referrer = null;
    if (referralCode && referralCode.trim()) {
      referrer = this.getUserByReferralCode(referralCode.trim());
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      firstName: this.capitalizeName(firstName),
      lastName: this.capitalizeName(lastName),
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      password: password, // In production/Supabase, handled by secure auth hashing
      referralCode: cleanUsername, // Referral code is the user's username
      referredBy: referrer ? (referrer.username || referrer.referralCode) : null,
      pointsBalance: 0,
      totalEarnedPoints: 0,
      status: 'active',
      isVerified: false,
      verificationRef: null,
      verificationPaidAt: null,
      avatar: '',
      bankDetails: {
        bankName: '',
        accountNumber: '',
        accountName: ''
      },
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this._set(STORAGE_KEYS.USERS, users);
    this.setCurrentUser(newUser);
    return newUser;
  }

  verifyUserPayment(userId, paystackRef) {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('User not found.');

    const user = users[userIndex];
    if (user.isVerified) return user; // Already verified

    const settings = this.getSettings();
    const fee = Number(settings.verificationFeeNaira) || 100;

    user.isVerified = true;
    user.verificationRef = paystackRef;
    user.verificationPaidAt = new Date().toISOString();

    // Log the Pay-In transaction record
    const payments = this.getPayments();
    const newPayment = {
      id: 'pay_' + Date.now(),
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      amount: fee,
      currency: 'NGN',
      purpose: 'Account Verification Fee',
      gateway: 'Paystack',
      reference: paystackRef,
      status: 'successful',
      createdAt: new Date().toISOString()
    };
    payments.unshift(newPayment);
    this._set(STORAGE_KEYS.PAYMENTS, payments);

    // Reward referrer once the new user pays their ₦100 verification fee
    if (user.referredBy) {
      const referrer = this.getUserByReferralCode(user.referredBy);
      if (referrer) {
        const bonus = Number(settings.referralPoints) || 150;
        referrer.pointsBalance = (referrer.pointsBalance || 0) + bonus;
        referrer.totalEarnedPoints = (referrer.totalEarnedPoints || 0) + bonus;
        const refIdx = users.findIndex(u => u.id === referrer.id);
        if (refIdx !== -1) {
          users[refIdx] = referrer;
        }
      }
    }

    users[userIndex] = user;
    this._set(STORAGE_KEYS.USERS, users);
    this.setCurrentUser(user);
    return user;
  }

  setVerificationStatus(userId, isVerified) {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('User not found.');
    users[userIndex].isVerified = Boolean(isVerified);
    if (isVerified) {
      if (!users[userIndex].verificationPaidAt) {
        users[userIndex].verificationPaidAt = new Date().toISOString();
        users[userIndex].verificationRef = 'ADMIN_MANUAL_' + Date.now();
      }
      const payments = this.getPayments();
      const existing = payments.find(p => p.userId === userId && p.status === 'successful');
      if (!existing) {
        const settings = this.getSettings();
        const fee = Number(settings.verificationFeeNaira) || 100;
        payments.unshift({
          id: 'pay_' + Date.now(),
          userId: users[userIndex].id,
          userName: `${users[userIndex].firstName} ${users[userIndex].lastName}`,
          userEmail: users[userIndex].email,
          amount: fee,
          currency: 'NGN',
          purpose: 'Account Verification (Admin Manual)',
          gateway: 'Admin Manual',
          reference: users[userIndex].verificationRef,
          status: 'successful',
          createdAt: new Date().toISOString()
        });
        this._set(STORAGE_KEYS.PAYMENTS, payments);
      }
    }
    this._set(STORAGE_KEYS.USERS, users);
    const curr = this.getCurrentUser();
    if (curr && curr.id === userId) {
      this.setCurrentUser(users[userIndex]);
    }
    return users[userIndex];
  }

  loginUser(identifier, password) {
    const user = this.getUserByIdentifier(identifier);
    if (!user) {
      throw new Error('No account found with this email, phone number, or username.');
    }
    if (user.password !== password) {
      throw new Error('Incorrect password. Please try again.');
    }
    if (user.status === 'suspended') {
      throw new Error('This account has been suspended. Please contact support.');
    }
    this.setCurrentUser(user);
    return user;
  }

  getCurrentUser() {
    const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!u) return null;
    const user = JSON.parse(u);
    // Keep in sync with latest db entry
    const fresh = this.getUserById(user.id);
    if (fresh) {
      this.setCurrentUser(fresh);
      return fresh;
    }
    return user;
  }

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }

  logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  updateUser(id, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found.');

    if (updates.firstName !== undefined) {
      updates.firstName = this.capitalizeName(updates.firstName);
    }
    if (updates.lastName !== undefined) {
      updates.lastName = this.capitalizeName(updates.lastName);
    }

    // If username is being changed, validate rules and enforce uniqueness
    if (updates.username !== undefined) {
      const cleanUsername = this.validateUsername(updates.username);
      const isTaken = users.some(u => u.id !== id && u.username && u.username.toLowerCase() === cleanUsername.toLowerCase());
      if (isTaken) {
        throw new Error('This username is already taken by another account. Please choose another.');
      }
      const oldUsername = users[index].username;
      const oldRefCode = users[index].referralCode;
      updates.username = cleanUsername;
      updates.referralCode = cleanUsername; // Referral code is the user's username

      // Keep referredBy in sync for any friends referred by this user
      users.forEach(u => {
        if (u.referredBy && (u.referredBy.toLowerCase() === (oldUsername || '').toLowerCase() || u.referredBy.toLowerCase() === (oldRefCode || '').toLowerCase())) {
          u.referredBy = cleanUsername;
        }
      });
    }

    // If email is being changed, validate format and enforce uniqueness
    if (updates.email !== undefined) {
      const cleanEmail = this.validateEmail(updates.email);
      const isTaken = users.some(u => u.id !== id && u.email && u.email.toLowerCase() === cleanEmail);
      if (isTaken) {
        throw new Error('This email address is already in use by another account.');
      }
      updates.email = cleanEmail;
    }

    // If phone is being changed, validate format (strictly 11 digits) and enforce uniqueness
    if (updates.phone !== undefined) {
      const cleanPhone = this.validatePhone(updates.phone);
      const isTaken = users.some(u => u.id !== id && this.isPhoneMatch(u.phone, cleanPhone));
      if (isTaken) {
        throw new Error('This phone number is already registered to another account.');
      }
      updates.phone = cleanPhone;
    }

    // If password is being changed, validate compulsory password rules
    if (updates.password !== undefined) {
      this.validatePassword(updates.password);
    }

    users[index] = { ...users[index], ...updates };
    this._set(STORAGE_KEYS.USERS, users);

    // If current logged in user, update session
    const current = this.getCurrentUser();
    if (current && current.id === id) {
      this.setCurrentUser(users[index]);
    }
    return users[index];
  }

  // =================== TASKS ===================
  getTasks() {
    const tasks = this._get(STORAGE_KEYS.TASKS);
    return tasks.map(t => {
      if (!t.timerSeconds || t.timerSeconds < 5) {
        return { ...t, timerSeconds: t.timerSeconds || 15 };
      }
      return t;
    });
  }

  getTaskById(id) {
    return this.getTasks().find(t => t.id === id) || null;
  }

  createTask(taskData) {
    const tasks = this.getTasks();
    const newTask = {
      id: 'task_' + Date.now(),
      title: taskData.title.trim(),
      category: taskData.category || 'General',
      targetUrl: taskData.targetUrl.trim(),
      points: Number(taskData.points) || 10,
      timerSeconds: Math.max(5, Number(taskData.timerSeconds) || 15),
      description: taskData.description.trim(),
      status: 'active',
      completionsCount: 0,
      maxCompletions: Number(taskData.maxCompletions) || 1000,
      createdAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    this._set(STORAGE_KEYS.TASKS, tasks);
    return newTask;
  }

  updateTask(id, updates) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found.');

    tasks[index] = { ...tasks[index], ...updates };
    this._set(STORAGE_KEYS.TASKS, tasks);
    return tasks[index];
  }

  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    this._set(STORAGE_KEYS.TASKS, tasks);
    return true;
  }

  // =================== TASK COMPLETIONS (AUTOMATED CLICK & TIMER) ===================
  getSubmissions() {
    return this._get(STORAGE_KEYS.SUBMISSIONS);
  }

  getUserSubmissions(userId) {
    return this.getSubmissions().filter(s => s.userId === userId);
  }

  completeTask({ taskId, userId }) {
    const task = this.getTaskById(taskId);
    const user = this.getUserById(userId);
    if (!task) throw new Error('Task does not exist.');
    if (!user) throw new Error('User does not exist.');

    // Check if user already completed
    const existing = this.getSubmissions().find(s => s.taskId === taskId && s.userId === userId);
    if (existing) {
      throw new Error('You have already completed this task.');
    }

    const completion = {
      id: 'sub_' + Date.now(),
      taskId,
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      taskTitle: task.title,
      points: task.points,
      verificationType: 'timer',
      proofData: 'Verified Action Click & Dwell Time',
      status: 'approved',
      reviewNote: 'Auto-verified via background dwell timer',
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString()
    };

    const subs = this.getSubmissions();
    subs.unshift(completion);
    this._set(STORAGE_KEYS.SUBMISSIONS, subs);

    // Credit points instantly
    this.creditUserPoints(userId, task.points);
    this.incrementTaskCompletions(taskId);

    return completion;
  }

  creditUserPoints(userId, points) {
    const user = this.getUserById(userId);
    if (!user) return;
    const newBal = (Number(user.pointsBalance) || 0) + Number(points);
    const newTotal = (Number(user.totalEarnedPoints) || 0) + Number(points);
    this.updateUser(userId, { pointsBalance: newBal, totalEarnedPoints: newTotal });
  }

  incrementTaskCompletions(taskId) {
    const task = this.getTaskById(taskId);
    if (!task) return;
    this.updateTask(taskId, { completionsCount: (task.completionsCount || 0) + 1 });
  }

  // =================== WITHDRAWALS ===================
  getWithdrawals() {
    return this._get(STORAGE_KEYS.WITHDRAWALS);
  }

  getUserWithdrawals(userId) {
    return this.getWithdrawals().filter(w => w.userId === userId);
  }

  requestWithdrawal({ userId, points, bankName, accountNumber, accountName }) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found.');

    if (!bankName || !bankName.trim()) {
      throw new Error('Please select a destination bank.');
    }

    const cleanAcc = String(accountNumber || '').trim().replace(/[^0-9]/g, '');
    if (cleanAcc.length !== 10) {
      throw new Error('Bank account number must be exactly 10 digits (NUBAN format).');
    }

    if (!accountName || !accountName.trim()) {
      throw new Error('Please enter the account holder full name.');
    }

    const settings = this.getSettings();
    const rate = Number(settings.pointRateNaira) || 1.0;
    const minNaira = Number(settings.minWithdrawalNaira) || 1000;
    const amountNaira = Number(points) * rate;

    if (amountNaira < minNaira) {
      throw new Error(`Minimum withdrawal amount is ₦${minNaira.toLocaleString()} (${Math.ceil(minNaira / rate)} points).`);
    }

    if (user.pointsBalance < points) {
      throw new Error('Insufficient points balance.');
    }

    // Deduct points from user immediately (held in escrow)
    const newBal = user.pointsBalance - points;
    this.updateUser(userId, {
      pointsBalance: newBal,
      bankDetails: { bankName: bankName.trim(), accountNumber: cleanAcc, accountName: accountName.trim() }
    });

    const withdrawal = {
      id: 'wdr_' + Date.now(),
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      points: Number(points),
      amountNaira: amountNaira,
      bankName: bankName.trim(),
      accountNumber: cleanAcc,
      accountName: accountName.trim(),
      status: 'pending', // 'pending' | 'approved' | 'declined'
      declineReason: '',
      requestedAt: new Date().toISOString(),
      processedAt: null
    };

    const withdrawals = this.getWithdrawals();
    withdrawals.unshift(withdrawal);
    this._set(STORAGE_KEYS.WITHDRAWALS, withdrawals);
    return withdrawal;
  }

  reviewWithdrawal(withdrawalId, status, declineReason = '') {
    const withdrawals = this.getWithdrawals();
    const index = withdrawals.findIndex(w => w.id === withdrawalId);
    if (index === -1) throw new Error('Withdrawal not found.');

    const wdr = withdrawals[index];
    if (wdr.status === status) return wdr;

    wdr.status = status; // 'approved' | 'declined'
    wdr.declineReason = declineReason;
    wdr.processedAt = new Date().toISOString();

    // If declined, refund points to user balance
    if (status === 'declined') {
      const user = this.getUserById(wdr.userId);
      if (user) {
        this.updateUser(wdr.userId, { pointsBalance: user.pointsBalance + wdr.points });
      }
    }

    withdrawals[index] = wdr;
    this._set(STORAGE_KEYS.WITHDRAWALS, withdrawals);
    return wdr;
  }

  // =================== PAYMENTS & PAY-IN RECORDS ===================
  getPayments() {
    return this._get(STORAGE_KEYS.PAYMENTS);
  }

  getTotalPayIn() {
    const payments = this.getPayments();
    return payments
      .filter(p => p.status === 'successful')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  // =================== MESSAGES / SUPPORT ===================
  getMessages(userId = null) {
    const msgs = this._get(STORAGE_KEYS.MESSAGES);
    if (userId) {
      return msgs.filter(m => m.userId === userId);
    }
    return msgs;
  }

  sendMessage({ userId, sender, text, image = null }) {
    const message = {
      id: 'msg_' + Date.now(),
      userId,
      sender, // 'user' | 'admin'
      text: text.trim(),
      image,
      createdAt: new Date().toISOString(),
      read: false
    };

    const msgs = this._get(STORAGE_KEYS.MESSAGES);
    msgs.push(message);
    this._set(STORAGE_KEYS.MESSAGES, msgs);
    return message;
  }

  markMessagesRead(userId, readerType) {
    const msgs = this._get(STORAGE_KEYS.MESSAGES);
    let changed = false;
    msgs.forEach(m => {
      if (m.userId === userId && m.sender !== readerType && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) {
      this._set(STORAGE_KEYS.MESSAGES, msgs);
    }
  }

  // =================== STATS ===================
  getPlatformStats() {
    const users = this.getUsers();
    const tasks = this.getTasks();
    const subs = this.getSubmissions();
    const withdrawals = this.getWithdrawals();
    const settings = this.getSettings();
    const rate = Number(settings.pointRateNaira) || 1.0;

    const totalEarnedPoints = users.reduce((sum, u) => sum + (Number(u.totalEarnedPoints) || 0), 0);
    const totalNairaValue = totalEarnedPoints * rate;
    const totalPayInNaira = this.getTotalPayIn();
    const totalPaidOutNaira = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + (Number(w.amountNaira) || 0), 0);
    const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
    const totalCompletedTasks = subs.length;

    return {
      totalUsers: users.length,
      totalEarnedPoints,
      totalNairaValue,
      totalPayInNaira,
      totalPaidOutNaira,
      totalTasks: tasks.length,
      totalCompletedTasks,
      pendingWithdrawalsCount
    };
  }
}

// Global instance
window.TaskEarnDB = new DataStore();
