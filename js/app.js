/**
 * TaskEarn - User Application Controller
 * Handles user authentication, tasks with automated click & invisible dwell verification,
 * withdrawals, messaging, and referrals.
 */

let activeUser = null;
let currentActiveTask = null;
let taskStartTime = null;
let taskHasBeenOpened = false;
let isTabActive = true;
let tempChatImageData = null;

document.addEventListener('DOMContentLoaded', () => {
  injectSvgIcons();
  setupVisibilityListener();
  handleUrlReferralParam();
  handlePaystackCallbackParam();
  checkAuth();

  if (window.TaskEarnDB && window.TaskEarnDB.onSync) {
    window.TaskEarnDB.onSync((type) => {
      // Ignore self-initiated pushes to avoid disrupting active user interactions
      if (type === 'push') return;

      activeUser = window.TaskEarnDB.getCurrentUser();
      if (activeUser) {
        updateWalletHeader();
        const activeTab = document.querySelector('.tab-panel.active');
        const activeEl = document.activeElement;

        if (activeTab) {
          if (activeTab.id === 'tab-tasks') {
            if (!currentActiveTask) renderUserTasks();
          }
          if (activeTab.id === 'tab-withdrawals') {
            const wdrForm = document.getElementById('withdrawalForm');
            const bankForm = document.getElementById('bankDetailsForm');
            const isEditing = (wdrForm && wdrForm.contains(activeEl)) || (bankForm && bankForm.contains(activeEl));
            if (!isEditing) renderWithdrawalsTab();
          }
          if (activeTab.id === 'tab-messages') {
            renderChatMessages();
          }
          if (activeTab.id === 'tab-more') {
            const profForm = document.getElementById('profileForm');
            const passForm = document.getElementById('passwordForm');
            const isEditing = (profForm && profForm.contains(activeEl)) || (passForm && passForm.contains(activeEl));
            if (!isEditing) loadProfileDetails();
          }
        }
      }
    });
  }
});

function handleUrlReferralParam() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    const refInput = document.getElementById('regReferralCode');
    if (refParam) {
      const cleanRef = refParam.trim().toLowerCase().replace(/^@/, '');
      if (refInput) {
        refInput.value = cleanRef;
      }
      try {
        localStorage.setItem('taskearn_pending_ref', cleanRef);
        localStorage.setItem('taskearn_auth_form', 'signup');
      } catch (e) {}
    } else {
      const savedRef = localStorage.getItem('taskearn_pending_ref');
      if (savedRef && refInput && !refInput.value) {
        refInput.value = savedRef;
      }
    }
  } catch (e) {
    // Non-blocking URL check
  }
}

async function handlePaystackCallbackParam() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paystackRef = urlParams.get('reference') || urlParams.get('trxref');
    if (paystackRef) {
      let currentUser = window.TaskEarnDB.getCurrentUser();
      if (currentUser && !currentUser.isVerified) {
        window.TaskEarnDB.verifyUserPayment(currentUser.id, paystackRef);
        if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
          try {
            await window.TaskEarnDB.pushToCloud();
          } catch (e) {}
        }
        activeUser = window.TaskEarnDB.getCurrentUser();
      }
      try {
        localStorage.setItem('taskearn_user_active_tab', 'tasks');
        history.replaceState(null, '', window.location.pathname + '#tasks');
      } catch (e) {}
      if (window.showCustomAlert) {
        window.showCustomAlert('Your payment was confirmed. Your account is now fully active!', {
          title: 'Account Verified',
          type: 'success'
        });
      }
    }
  } catch (e) {
    console.error('Paystack callback error:', e);
  }
}

function setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
  });
}

function injectSvgIcons() {
  const setIcon = (id, svg) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  };

  // Desktop Sidebar icons
  setIcon('dIconTasks', window.ICONS.tasks);
  setIcon('dIconWithdraw', window.ICONS.wallet);
  setIcon('dIconChat', window.ICONS.chat);
  setIcon('dIconReferral', window.ICONS.referral);
  setIcon('dIconMore', window.ICONS.more);
  setIcon('dIconLogout', window.ICONS.logout);

  // Mobile Bottom Nav icons
  setIcon('mIconTasks', window.ICONS.tasks);
  setIcon('mIconWithdraw', window.ICONS.wallet);
  setIcon('mIconChat', window.ICONS.chat);
  setIcon('mIconReferral', window.ICONS.referral);
  setIcon('mIconMore', window.ICONS.more);

  // Action icons
  setIcon('iconSearch', window.ICONS.search);
  setIcon('iconAttachImage', window.ICONS.image);
  setIcon('iconSendMessage', window.ICONS.send);
  setIcon('iconCopyCode', window.ICONS.copy);
  setIcon('iconCopyLink', window.ICONS.copy);
  setIcon('iconLogout', window.ICONS.logout);
  setIcon('iconCloseModal', window.ICONS.close);
  setIcon('iconPerformTask', window.ICONS.externalLink);
  setIcon('iconConfirmTask', window.ICONS.check);
  setIcon('iconVerifyLock', window.ICONS.lock);

  if (window.initPasswordToggleIcons) {
    window.initPasswordToggleIcons();
  }
}

// =================== AUTHENTICATION & VERIFICATION ===================

function checkAuth() {
  activeUser = window.TaskEarnDB.getCurrentUser();
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('appScreen');
  const verifyScreen = document.getElementById('verifyScreen');

  if (!activeUser) {
    if (authScreen) authScreen.style.display = 'flex';
    if (appScreen) appScreen.style.display = 'none';
    if (verifyScreen) verifyScreen.style.display = 'none';

    // Determine whether to display Login or Signup form on refresh
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    const urlParams = new URLSearchParams(window.location.search);
    const hasRef = urlParams.has('ref');
    const savedForm = localStorage.getItem('taskearn_auth_form');

    if (hash === 'signup' || (!hash && savedForm === 'signup') || hasRef) {
      toggleAuthForm('signup', hash === 'signup' || hasRef);
    } else {
      toggleAuthForm('login', hash === 'login');
    }
  } else if (!activeUser.isVerified) {
    // Logged in but pending account verification fee (₦100 via Paystack)
    if (authScreen) authScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'none';
    if (verifyScreen) {
      verifyScreen.style.display = 'flex';
      renderVerifyScreen();
      try {
        history.replaceState(null, '', '#verify');
      } catch (e) {}
    }
  } else {
    // Fully verified user
    if (authScreen) authScreen.style.display = 'none';
    if (verifyScreen) verifyScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'flex';
    updateWalletHeader();

    const USER_TABS = ['tasks', 'withdrawals', 'messages', 'referrals', 'more'];
    const USER_ROUTE_ALIASES = {
      'task': 'tasks',
      'earn': 'tasks',
      'jobs': 'tasks',
      'home': 'tasks',
      'dashboard': 'tasks',
      'feed': 'tasks',
      'withdraw': 'withdrawals',
      'withdrawal': 'withdrawals',
      'payout': 'withdrawals',
      'payouts': 'withdrawals',
      'cashout': 'withdrawals',
      'chat': 'messages',
      'support': 'messages',
      'inbox': 'messages',
      'message': 'messages',
      'referral': 'referrals',
      'invite': 'referrals',
      'ref': 'referrals',
      'affiliate': 'referrals',
      'profile': 'more',
      'settings': 'more',
      'account': 'more'
    };

    let savedTab = '';
    const rawHash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
    const mappedHash = USER_ROUTE_ALIASES[rawHash] || rawHash;

    if (rawHash === 'verify' || rawHash === 'login' || rawHash === 'signup' || mappedHash === 'home') {
      savedTab = 'tasks';
      try {
        localStorage.setItem('taskearn_user_active_tab', 'tasks');
        history.replaceState(null, '', window.location.pathname + '#tasks');
      } catch (e) {}
    } else if (USER_TABS.includes(mappedHash)) {
      savedTab = mappedHash;
    } else {
      const storedTab = localStorage.getItem('taskearn_user_active_tab') || 'tasks';
      const mappedStored = USER_ROUTE_ALIASES[storedTab] || storedTab;
      savedTab = USER_TABS.includes(mappedStored) ? mappedStored : 'tasks';
    }

    switchUserTab(savedTab);
  }
}

function renderVerifyScreen() {
  if (!activeUser) return;
  const settings = window.TaskEarnDB.getSettings();
  const fee = Number(settings.verificationFeeNaira) || 100;

  const nameEl = document.getElementById('verifyUserName');
  const emailEl = document.getElementById('verifyUserEmail');
  const feeEl = document.getElementById('verifyFeeDisplay');
  const payBtn = document.getElementById('payVerifyBtn');

  if (nameEl) nameEl.textContent = `${activeUser.firstName} ${activeUser.lastName}`;
  if (emailEl) emailEl.textContent = activeUser.email;
  if (feeEl) feeEl.textContent = `₦${fee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (payBtn) payBtn.textContent = `Pay ₦${fee.toLocaleString()} via Paystack`;
}

function showVerifyAlert(message, type = 'error') {
  const alertEl = document.getElementById('verifyAlert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;
  alertEl.style.display = 'block';
}

async function initiatePaystackVerification() {
  if (!activeUser) return;
  const settings = window.TaskEarnDB.getSettings();
  const pubKey = settings.paystackPublicKey || 'pk_live_732d9b62cd035b8dad96e981d7f6982540342e80';
  const fee = Number(settings.verificationFeeNaira) || 100;
  const payBtn = document.getElementById('payVerifyBtn');

  const redirectToHome = async (ref) => {
    window.TaskEarnDB.verifyUserPayment(activeUser.id, ref);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      try {
        await window.TaskEarnDB.pushToCloud();
      } catch (e) {
        console.warn('Cloud sync error after verification:', e);
      }
    }
    activeUser = window.TaskEarnDB.getCurrentUser();

    try {
      localStorage.setItem('taskearn_user_active_tab', 'tasks');
      history.replaceState(null, '', window.location.pathname + '#tasks');
    } catch (e) {}

    const verifyScreen = document.getElementById('verifyScreen');
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');
    if (verifyScreen) verifyScreen.style.display = 'none';
    if (authScreen) authScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'flex';

    updateWalletHeader();
    switchUserTab('tasks');
    if (window.showCustomAlert) {
      window.showCustomAlert('Your ₦' + fee.toLocaleString('en-NG') + ' account verification payment was confirmed. Welcome to TaskEarn!', {
        title: 'Account Verified',
        type: 'success'
      });
    }
  };

  // Verify Paystack library presence
  if (typeof PaystackPop === 'undefined') {
    const simulate = await window.showCustomConfirm(
      "Paystack script could not be reached (offline or blocked connection).\n\n" +
      "Would you like to simulate a successful ₦" + fee + " Paystack verification to continue testing?",
      {
        title: 'Simulate Verification',
        confirmText: 'Simulate Payment',
        cancelText: 'Cancel'
      }
    );
    if (simulate) {
      const mockRef = 'TE_SIM_' + Date.now();
      await redirectToHome(mockRef);
      return;
    }
    return;
  }

  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = 'Launching Paystack...';
  }

  try {
    const handler = PaystackPop.setup({
      key: pubKey,
      email: activeUser.email,
      amount: Math.round(fee * 100), // kobo (100 Naira = 10,000 kobo)
      currency: 'NGN',
      ref: 'TE_VER_' + Date.now() + '_' + Math.floor(Math.random() * 1000000),
      metadata: {
        custom_fields: [
          {
            display_name: 'User ID',
            variable_name: 'user_id',
            value: activeUser.id
          },
          {
            display_name: 'Full Name',
            variable_name: 'full_name',
            value: `${activeUser.firstName} ${activeUser.lastName}`
          },
          {
            display_name: 'Phone Number',
            variable_name: 'phone',
            value: activeUser.phone
          },
          {
            display_name: 'Platform',
            variable_name: 'platform',
            value: 'TaskEarn Account Verification'
          }
        ]
      },
      callback: function(response) {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = `Pay ₦${fee.toLocaleString()} via Paystack`;
        }
        const ref = response.reference || response.trxref || ('TE_VER_' + Date.now());
        redirectToHome(ref);
      },
      onClose: function() {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = `Pay ₦${fee.toLocaleString()} via Paystack`;
        }
        showVerifyAlert('Payment window was closed. Verification is still pending.', 'info');
      }
    });

    handler.openIframe();
  } catch (err) {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = `Pay ₦${fee.toLocaleString()} via Paystack`;
    }
    showVerifyAlert('Paystack error: ' + err.message, 'error');
  }
}

function autoCapitalizeInput(input) {
  if (!input || typeof input.value !== 'string') return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  
  // Capitalize first letter of each word (e.g. "daniel" -> "Daniel", "john-doe" -> "John-Doe")
  const capitalized = input.value.replace(/(^|[\s-])(\p{L})/gu, (match, sep, char) => sep + char.toUpperCase());
  
  if (input.value !== capitalized) {
    input.value = capitalized;
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end);
    }
  }
}

function checkPasswordCriteria(password, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const val = password || '';

  const rules = {
    length: val.length >= 6,
    capital: /[A-Z]/.test(val),
    lower: /[a-z]/.test(val),
    number: /[0-9]/.test(val),
    symbol: /[^A-Za-z0-9]/.test(val)
  };

  for (const [rule, isMet] of Object.entries(rules)) {
    const item = container.querySelector(`[data-rule="${rule}"]`);
    if (item) {
      item.classList.toggle('met', isMet);
    }
  }
}

window.autoCapitalizeInput = autoCapitalizeInput;
window.checkPasswordCriteria = checkPasswordCriteria;

function toggleAuthForm(type, updateHistory = true) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const alertEl = document.getElementById('authAlert');
  if (alertEl) alertEl.style.display = 'none';

  const formType = (type === 'signup') ? 'signup' : 'login';

  if (formType === 'signup') {
    if (loginForm) loginForm.style.display = 'none';
    if (signupForm) signupForm.style.display = 'block';
  } else {
    if (signupForm) signupForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
  }

  try {
    localStorage.setItem('taskearn_auth_form', formType);
    if (updateHistory) {
      const search = window.location.search || '';
      history.replaceState(null, '', search + '#' + formType);
    }
  } catch (e) {}

  if (window.initPasswordToggleIcons) {
    window.initPasswordToggleIcons();
  }
}

function showAuthAlert(message, type = 'error') {
  const alertEl = document.getElementById('authAlert');
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;
  alertEl.style.display = 'block';
}

let isSubmittingLogin = false;

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (isSubmittingLogin) return;

  const identifierEl = document.getElementById('loginIdentifier') || document.getElementById('loginEmail');
  const identifier = identifierEl ? identifierEl.value : '';
  const pass = document.getElementById('loginPassword').value;
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  isSubmittingLogin = true;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying credentials...';
    }
    // Pull fresh data from JSONBin cloud before verifying login to prevent stale credentials
    if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud) {
      await window.TaskEarnDB.pullFromCloud(true);
    }
    const user = window.TaskEarnDB.loginUser(identifier, pass);
    activeUser = user;
    checkAuth();
  } catch (err) {
    showAuthAlert(err.message, 'error');
  } finally {
    isSubmittingLogin = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

let isSubmittingSignup = false;

async function handleSignupSubmit(event) {
  event.preventDefault();
  if (isSubmittingSignup) return;

  const firstName = document.getElementById('regFirstName').value;
  const lastName = document.getElementById('regLastName').value;
  const username = (document.getElementById('regUsername') ? document.getElementById('regUsername').value : '').trim();
  const phone = document.getElementById('regPhone').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const referralCode = document.getElementById('regReferralCode').value;
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  if (password !== confirmPassword) {
    showAuthAlert('Passwords do not match. Please retype carefully.', 'error');
    return;
  }

  const cleanPhone = phone.replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(cleanPhone)) {
    showAuthAlert('Phone number must be exactly 11 digits (e.g. 08012345678).', 'error');
    return;
  }

  isSubmittingSignup = true;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating Account...';
    }
    // Pull fresh data from cloud first to ensure latest uniqueness checks
    if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud) {
      await window.TaskEarnDB.pullFromCloud();
    }
    const user = window.TaskEarnDB.registerUser({
      firstName,
      lastName,
      username,
      phone,
      email,
      password,
      referralCode
    });
    // Immediately push new user to cloud so other browsers see it right away
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    activeUser = user;
    checkAuth();
  } catch (err) {
    showAuthAlert(err.message, 'error');
  } finally {
    isSubmittingSignup = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function handleUserLogout() {
  window.TaskEarnDB.logoutUser();
  if (document.body) {
    document.body.classList.remove('tab-messages-active');
  }
  try {
    localStorage.removeItem('taskearn_user_active_tab');
    localStorage.setItem('taskearn_auth_form', 'login');
    history.replaceState(null, '', window.location.pathname + '#login');
  } catch (e) {}
  activeUser = null;
  checkAuth();
}

// =================== NAVIGATION ===================

function switchUserTab(tabName) {
  const tabs = ['tasks', 'withdrawals', 'messages', 'referrals', 'more'];
  if (!tabs.includes(tabName)) tabName = 'tasks';

  try {
    localStorage.setItem('taskearn_user_active_tab', tabName);
    history.replaceState(null, '', '#' + tabName);
  } catch (e) {}

  tabs.forEach(tab => {
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.toggle('active', tab === tabName);
  });

  const desktopTabMap = {
    'tasks': 'dTabTasks',
    'withdrawals': 'dTabWithdraw',
    'messages': 'dTabChat',
    'referrals': 'dTabReferral',
    'more': 'dTabMore'
  };
  const mobileTabMap = {
    'tasks': 'mNavTasks',
    'withdrawals': 'mNavWithdraw',
    'messages': 'mNavMessages',
    'referrals': 'mNavReferrals',
    'more': 'mNavMore'
  };

  Object.entries(desktopTabMap).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', name === tabName);
  });
  Object.entries(mobileTabMap).forEach(([name, id]) => {
    const el = document.getElementById(id) || (name === 'messages' ? (document.getElementById('mNavMessages') || document.getElementById('mNavChat')) : null);
    if (el) el.classList.toggle('active', name === tabName);
  });

  // Toggle full-bleed chat container class on body
  if (document.body) {
    document.body.classList.toggle('tab-messages-active', tabName === 'messages');
  }

  if (tabName === 'tasks') {
    renderUserTasks();
    if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud) {
      window.TaskEarnDB.pullFromCloud().then(() => {
        renderUserTasks();
      }).catch(() => {});
    }
  } else if (tabName === 'withdrawals') {
    renderWithdrawalsTab();
  } else if (tabName === 'messages') {
    renderChatMessages();
    window.TaskEarnDB.markMessagesRead(activeUser.id, 'user');
    updateUserTabIndicators();
  } else if (tabName === 'referrals') {
    renderReferralsTab();
  } else if (tabName === 'more') {
    loadProfileDetails();
  }
}

window.addEventListener('hashchange', () => {
  const rawHash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  if (!activeUser) {
    if (rawHash === 'signup') {
      toggleAuthForm('signup', false);
    } else if (rawHash === 'login') {
      toggleAuthForm('login', false);
    }
    return;
  }
  if (!activeUser.isVerified) return;
  const USER_TABS = ['tasks', 'withdrawals', 'messages', 'referrals', 'more'];
  const USER_ROUTE_ALIASES = {
    'task': 'tasks',
    'earn': 'tasks',
    'jobs': 'tasks',
    'home': 'tasks',
    'dashboard': 'tasks',
    'feed': 'tasks',
    'withdraw': 'withdrawals',
    'withdrawal': 'withdrawals',
    'payout': 'withdrawals',
    'payouts': 'withdrawals',
    'cashout': 'withdrawals',
    'chat': 'messages',
    'support': 'messages',
    'inbox': 'messages',
    'message': 'messages',
    'referral': 'referrals',
    'invite': 'referrals',
    'ref': 'referrals',
    'affiliate': 'referrals',
    'profile': 'more',
    'settings': 'more',
    'account': 'more'
  };
  const targetTab = USER_ROUTE_ALIASES[rawHash] || rawHash;
  if (USER_TABS.includes(targetTab)) {
    switchUserTab(targetTab);
  }
});

function updateWalletHeader() {
  if (!activeUser) return;
  activeUser = window.TaskEarnDB.getCurrentUser();
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  const nairaVal = (activeUser.pointsBalance * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 });

  // Top header wallet
  document.getElementById('userWalletPoints').textContent = `${activeUser.pointsBalance.toLocaleString()} PTS`;
  document.getElementById('userWalletNaira').textContent = `₦${nairaVal}`;

  // Sidebar profile card
  const sName = document.getElementById('sidebarUserName');
  const sPoints = document.getElementById('sidebarUserPoints');
  const sAvatar = document.getElementById('sidebarUserAvatar');
  if (sName) sName.textContent = `${activeUser.firstName} ${activeUser.lastName}`;
  if (sPoints) sPoints.textContent = `${activeUser.pointsBalance.toLocaleString()} PTS`;
  if (sAvatar) {
    if (activeUser.avatar) {
      sAvatar.innerHTML = `<img src="${activeUser.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      sAvatar.textContent = (activeUser.firstName[0] || 'U').toUpperCase();
    }
  }

  // Hero card
  const heroPoints = document.getElementById('heroPointsBalance');
  const heroNaira = document.getElementById('heroNairaBalance');
  if (heroPoints) heroPoints.textContent = activeUser.pointsBalance.toLocaleString();
  if (heroNaira) heroNaira.textContent = `₦${nairaVal}`;

  updateUserTabIndicators();
}

function updateUserTabIndicators() {
  if (!activeUser) return;
  const count = window.TaskEarnDB.getUnreadMessageCountForUser(activeUser.id);
  const text = window.TaskEarnDB.formatBadgeCount(count);

  const dBadge = document.getElementById('dBadgeMessages');
  const mBadge = document.getElementById('mBadgeMessages');

  [dBadge, mBadge].forEach(badge => {
    if (badge) {
      if (text) {
        badge.textContent = text;
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '';
        badge.style.display = 'none';
      }
    }
  });
}

// =================== TAB 1: TASKS ===================

function getTaskPlatformIcon(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('youtube') && window.ICONS?.youtube) return window.ICONS.youtube;
  if (cat.includes('instagram') && window.ICONS?.instagram) return window.ICONS.instagram;
  if ((cat.includes('twitter') || cat.includes(' x')) && window.ICONS?.twitter) return window.ICONS.twitter;
  if (cat.includes('tiktok') && window.ICONS?.tiktok) return window.ICONS.tiktok;
  if (cat.includes('telegram') && window.ICONS?.telegram) return window.ICONS.telegram;
  if (cat.includes('facebook') && window.ICONS?.facebook) return window.ICONS.facebook;
  if (cat.includes('whatsapp') && window.ICONS?.whatsapp) return window.ICONS.whatsapp;
  if (cat.includes('video') && window.ICONS?.video) return window.ICONS.video;
  if (cat.includes('website') && window.ICONS?.globe) return window.ICONS.globe;
  return window.ICONS?.tasks || '';
}

function renderUserTasks() {
  if (!activeUser) return;
  updateWalletHeader();

  const tasks = window.TaskEarnDB.getTasks().filter(t => t.status === 'active');
  const completions = window.TaskEarnDB.getUserSubmissions(activeUser.id);
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;

  const searchQuery = (document.getElementById('taskSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('taskStatusFilter')?.value || 'all';
  const sortFilter = document.getElementById('taskSortFilter')?.value || 'newest';

  // Map completions
  const compMap = {};
  completions.forEach(c => {
    compMap[c.taskId] = c;
  });

  // Filter tasks
  let filtered = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery) ||
                          task.category.toLowerCase().includes(searchQuery);
    if (!matchesSearch) return false;

    const isDone = !!compMap[task.id];
    if (statusFilter === 'available') {
      return !isDone;
    } else if (statusFilter === 'completed') {
      return isDone;
    }
    return true; // 'all'
  });

  // Sort
  if (sortFilter === 'reward-desc') {
    filtered.sort((a, b) => b.points - a.points);
  } else if (sortFilter === 'reward-asc') {
    filtered.sort((a, b) => a.points - b.points);
  } else {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Split into Available (To Do) and Completed (Underneath)
  const availableTasks = filtered.filter(t => !compMap[t.id]);
  const completedTasks = filtered.filter(t => !!compMap[t.id]);

  const availSection = document.getElementById('availableTasksSection');
  const compSection = document.getElementById('completedTasksSection');
  if (availSection) availSection.style.display = (statusFilter === 'completed') ? 'none' : 'block';
  if (compSection) compSection.style.display = (statusFilter === 'available') ? 'none' : 'block';

  const availableContainer = document.getElementById('availableTasksList');
  const completedContainer = document.getElementById('completedTasksList');
  const availCountEl = document.getElementById('availableTasksCount');
  const compCountEl = document.getElementById('completedTasksCount');

  if (availCountEl) availCountEl.textContent = `${availableTasks.length} available`;
  if (compCountEl) compCountEl.textContent = `${completedTasks.length} completed`;

  // Render Available Tasks
  if (availableTasks.length === 0) {
    availableContainer.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 30px;">
        No tasks available right now. Check back soon for new campaigns!
      </div>
    `;
  } else {
    availableContainer.innerHTML = availableTasks.map(task => {
      const nairaVal = (task.points * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      return `
        <div class="task-item">
          <div class="task-info-main">
            <div class="task-icon-badge">
              ${getTaskPlatformIcon(task.category)}
            </div>
            <div class="task-details">
              <div class="task-meta">
                <span class="badge badge-active">${escapeHtml(task.category)}</span>
                <span>&bull; Instant Verification</span>
              </div>
              <h4 class="task-title">${escapeHtml(task.title)}</h4>
              <div class="task-reward">
                +${task.points} Points (₦${nairaVal})
              </div>
            </div>
          </div>
          <button class="btn btn-primary" onclick="openTaskModal('${task.id}')">
            Start Task
          </button>
        </div>
      `;
    }).join('');
  }

  // Render Completed Tasks (Positioned cleanly underneath)
  if (completedTasks.length === 0) {
    completedContainer.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 20px;">
        No completed tasks yet. Start any available task above to earn points!
      </div>
    `;
  } else {
    completedContainer.innerHTML = completedTasks.map(task => {
      const comp = compMap[task.id];
      return `
        <div class="task-item task-completed">
          <div class="task-info-main">
            <div class="task-icon-badge" style="background-color: var(--primary-green-light); color: var(--primary-green-dark);">
              ${window.ICONS.check}
            </div>
            <div class="task-details">
              <div class="task-meta">
                <span class="badge badge-approved">Completed (+${comp.points} PTS)</span>
                <span>&bull; ${new Date(comp.submittedAt).toLocaleDateString()}</span>
              </div>
              <h4 class="task-title" style="text-decoration: line-through; opacity: 0.85;">
                ${escapeHtml(task.title)}
              </h4>
              <div style="font-size: 0.82rem; color: var(--text-muted);">
                Reward credited directly to your balance.
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.7;">
            Completed
          </button>
        </div>
      `;
    }).join('');
  }
}

// =================== TASK MODAL (AUTOMATED CLICK & INVISIBLE TIMER) ===================

function openTaskModal(taskId) {
  const task = window.TaskEarnDB.getTaskById(taskId);
  if (!task) return;

  currentActiveTask = task;
  taskStartTime = null;
  taskHasBeenOpened = false;

  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  const nairaVal = (task.points * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 });

  document.getElementById('modalTaskCategory').textContent = task.category;
  document.getElementById('modalTaskTitle').textContent = task.title;
  document.getElementById('modalTaskReward').textContent = `Reward: +${task.points} Points (₦${nairaVal})`;
  document.getElementById('modalTaskDesc').textContent = task.description;

  const alertBox = document.getElementById('modalTaskAlert');
  alertBox.style.display = 'none';

  const startBtn = document.getElementById('startTaskBtn');
  startBtn.style.display = 'block';
  startBtn.disabled = false;
  startBtn.className = 'btn btn-primary btn-block';
  startBtn.innerHTML = `<span id="iconPerformTask">${window.ICONS?.externalLink || ''}</span> Perform Task (Opens Link)`;

  const confirmBtn = document.getElementById('confirmTaskBtn');
  if (confirmBtn) {
    confirmBtn.style.display = 'none';
    confirmBtn.disabled = false;
    confirmBtn.className = 'btn btn-primary btn-block';
    confirmBtn.innerHTML = `<span id="iconConfirmTask">${window.ICONS?.check || ''}</span> I Have Performed Task`;
  }

  const retryBtn = document.getElementById('retryTaskBtn');
  if (retryBtn) retryBtn.style.display = 'none';

  const statusBox = document.getElementById('taskVerificationStatusBox');
  if (statusBox) statusBox.style.display = 'none';

  document.getElementById('taskModal').classList.add('open');
}

async function closeTaskModal(force = false) {
  if (!force && (taskStartTime || taskHasBeenOpened)) {
    const proceed = await window.showCustomConfirm(
      'You have not completed or verified this task yet. If you close now, no points will be credited to your account. Are you sure you want to exit?',
      {
        title: 'Task Incomplete',
        confirmText: 'Exit Anyway',
        cancelText: 'Stay & Complete',
        danger: true
      }
    );
    if (!proceed) return;
  }
  document.getElementById('taskModal').classList.remove('open');
  currentActiveTask = null;
  taskStartTime = null;
  taskHasBeenOpened = false;
}
window.closeTaskModal = closeTaskModal;

// Close task modal on backdrop click with confirmation protection
document.getElementById('taskModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'taskModal') {
    closeTaskModal();
  }
});

// User clicks "Perform Task" -> opens link in new tab -> starts dwell timer fresh
function performTaskAction() {
  if (!currentActiveTask) return;

  // Open the action link in a new tab
  window.open(currentActiveTask.targetUrl, '_blank');

  // Record start timestamp (starts dwell timer fresh)
  taskStartTime = Date.now();
  taskHasBeenOpened = true;

  const retryBtn = document.getElementById('retryTaskBtn');
  if (retryBtn) retryBtn.style.display = 'none';

  const startBtn = document.getElementById('startTaskBtn');
  startBtn.style.display = 'block';
  startBtn.className = 'btn btn-secondary btn-block';
  startBtn.innerHTML = `<span id="iconPerformTask">${window.ICONS?.externalLink || ''}</span> Re-open Task Link`;

  const confirmBtn = document.getElementById('confirmTaskBtn');
  if (confirmBtn) {
    confirmBtn.style.display = 'block';
    confirmBtn.disabled = false;
    confirmBtn.className = 'btn btn-primary btn-block';
    confirmBtn.innerHTML = `<span id="iconConfirmTask">${window.ICONS?.check || ''}</span> I Have Performed Task`;
  }

  const statusBox = document.getElementById('taskVerificationStatusBox');
  const headline = document.getElementById('taskDwellHeadline');
  const subtext = document.getElementById('taskDwellSubtext');

  if (statusBox) {
    statusBox.style.display = 'block';
    if (headline) headline.textContent = 'Task Link Opened';
    if (subtext) {
      subtext.innerHTML = `Perform the required task on the opened page. When completed, return here and click <strong>"I Have Performed Task"</strong> above.`;
    }
  }

  const alertBox = document.getElementById('modalTaskAlert');
  if (alertBox) alertBox.style.display = 'none';
}

// User clicks "Try Again" -> re-opens link and restarts the dwell timer completely
function retryTaskAction() {
  if (!currentActiveTask) return;

  // Re-open target link in new tab
  window.open(currentActiveTask.targetUrl, '_blank');

  // CRITICAL ANTI-CHEAT: Restart dwell timer from 0
  taskStartTime = Date.now();
  taskHasBeenOpened = true;

  const retryBtn = document.getElementById('retryTaskBtn');
  if (retryBtn) retryBtn.style.display = 'none';

  const startBtn = document.getElementById('startTaskBtn');
  if (startBtn) {
    startBtn.style.display = 'block';
    startBtn.className = 'btn btn-secondary btn-block';
    startBtn.innerHTML = `<span id="iconPerformTask">${window.ICONS?.externalLink || ''}</span> Re-open Task Link`;
  }

  const confirmBtn = document.getElementById('confirmTaskBtn');
  if (confirmBtn) {
    confirmBtn.style.display = 'block';
    confirmBtn.disabled = false;
    confirmBtn.className = 'btn btn-primary btn-block';
    confirmBtn.innerHTML = `<span id="iconConfirmTask">${window.ICONS?.check || ''}</span> I Have Performed Task`;
  }

  const statusBox = document.getElementById('taskVerificationStatusBox');
  const headline = document.getElementById('taskDwellHeadline');
  const subtext = document.getElementById('taskDwellSubtext');

  if (statusBox) {
    statusBox.style.display = 'block';
    if (headline) headline.textContent = 'Task Link Re-opened';
    if (subtext) {
      subtext.innerHTML = `Perform the required task on the opened page. When completed, return here and click <strong>"I Have Performed Task"</strong> above.`;
    }
  }

  const alertBox = document.getElementById('modalTaskAlert');
  if (alertBox) alertBox.style.display = 'none';
}
window.retryTaskAction = retryTaskAction;

// User clicks "I Have Performed Task" -> verify completion smartly without exposing dwell metrics
async function verifyUserTaskCompletion() {
  if (!currentActiveTask || !activeUser) return;

  const alertBox = document.getElementById('modalTaskAlert');
  const confirmBtn = document.getElementById('confirmTaskBtn');
  const startBtn = document.getElementById('startTaskBtn');
  const retryBtn = document.getElementById('retryTaskBtn');
  const reqSec = Math.max(5, Number(currentActiveTask.timerSeconds) || 15);

  if (!taskStartTime) {
    if (alertBox) {
      alertBox.className = 'alert alert-error';
      alertBox.textContent = 'Please click "Perform Task (Opens Link)" or "Try Again" first before verifying.';
      alertBox.style.display = 'block';
    }
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - taskStartTime) / 1000);

  // If performed under required dwell time (under 15s), reject smartly without exposing how the system verifies it
  if (elapsedSeconds < reqSec) {
    // ANTI-CHEAT RESET: Reset start timestamp so they cannot wait idle to bypass the check
    taskStartTime = null;

    if (alertBox) {
      alertBox.className = 'alert alert-error';
      alertBox.textContent = 'Task Incomplete: We could not verify your task action. Please click "Try Again" below to re-open the task and complete it properly.';
      alertBox.style.display = 'block';
    }

    // Hide confirm button so user must click Try Again
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';

    // Show Try Again button
    if (retryBtn) {
      retryBtn.style.display = 'block';
      retryBtn.innerHTML = `<span id="iconRetryTask">${window.ICONS?.refresh || ''}</span> Try Again`;
    }

    const statusBox = document.getElementById('taskVerificationStatusBox');
    const headline = document.getElementById('taskDwellHeadline');
    const subtext = document.getElementById('taskDwellSubtext');
    if (statusBox) {
      statusBox.style.display = 'block';
      if (headline) headline.textContent = 'Action Incomplete';
      if (subtext) {
        subtext.innerHTML = 'We could not confirm your task action. Please click <strong>"Try Again"</strong> above to re-open the page and complete the task.';
      }
    }

    return;
  }

  // Verification passed: credit reward!
  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Verifying Completion...';
    }

    window.TaskEarnDB.completeTask({
      taskId: currentActiveTask.id,
      userId: activeUser.id
    });

    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    if (alertBox) {
      alertBox.className = 'alert alert-success';
      alertBox.textContent = `Task verified successfully! +${currentActiveTask.points} Points credited to your account.`;
      alertBox.style.display = 'block';
    }

    updateWalletHeader();

    setTimeout(() => {
      closeTaskModal(true);
      renderUserTasks();
    }, 1200);

  } catch (err) {
    if (alertBox) {
      alertBox.className = 'alert alert-error';
      alertBox.textContent = err.message;
      alertBox.style.display = 'block';
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<span id="iconConfirmTask">${window.ICONS?.check || ''}</span> I Have Performed Task`;
    }
  }
}

window.verifyUserTaskCompletion = verifyUserTaskCompletion;

function showTaskModalAlert(message, type = 'error') {
  const alertBox = document.getElementById('modalTaskAlert');
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  alertBox.style.display = 'block';
}

// =================== TAB 2: WITHDRAWALS ===================

let isEditingBankDetails = false;

function editBankDetails() {
  isEditingBankDetails = true;
  renderWithdrawalsTab();
}

function cancelEditBankDetails() {
  isEditingBankDetails = false;
  renderWithdrawalsTab();
}

async function handleSaveBankDetails(event) {
  event.preventDefault();
  if (!activeUser) return;
  const bankName = document.getElementById('wdrBankSelect')?.value.trim();
  const accountNumber = document.getElementById('wdrAccountNumber')?.value.trim();
  const accountName = document.getElementById('wdrAccountName')?.value.trim();
  const alertEl = document.getElementById('bankDetailsAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  if (!bankName) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please choose your Nigerian destination bank.';
      alertEl.style.display = 'block';
    }
    return;
  }

  const cleanAcc = (accountNumber || '').replace(/[^0-9]/g, '');
  if (cleanAcc.length !== 10) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Bank account number must be exactly 10 digits (NUBAN format).';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (!accountName) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please enter your account holder name.';
      alertEl.style.display = 'block';
    }
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving details...';
    }

    activeUser = window.TaskEarnDB.updateUser(activeUser.id, {
      bankDetails: {
        bankName,
        accountNumber: cleanAcc,
        accountName
      }
    });

    // Push updated profile to JSONBin cloud immediately and wait for it
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    isEditingBankDetails = false;
    renderWithdrawalsTab();

    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Bank account details saved successfully and synced!';
      alertEl.style.display = 'block';
      setTimeout(() => {
        if (alertEl) alertEl.style.display = 'none';
      }, 4000);
    }
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function renderWithdrawalsTab() {
  if (!activeUser) return;
  activeUser = window.TaskEarnDB.getCurrentUser();
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  const minNaira = Number(settings.minWithdrawalNaira) || 1000;

  const wdrRateBadge = document.getElementById('wdrRateBadge');
  const wdrPointsAvailable = document.getElementById('wdrPointsAvailable');
  const wdrNairaAvailable = document.getElementById('wdrNairaAvailable');
  const wdrMinNotice = document.getElementById('wdrMinNotice');

  if (wdrRateBadge) wdrRateBadge.textContent = `1 Point = ₦${rate.toFixed(2)}`;
  if (wdrPointsAvailable) wdrPointsAvailable.textContent = activeUser.pointsBalance.toLocaleString();
  if (wdrNairaAvailable) wdrNairaAvailable.textContent = `₦${(activeUser.pointsBalance * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (wdrMinNotice) wdrMinNotice.textContent = `Minimum withdrawal: ₦${minNaira.toLocaleString()}`;

  // Bank Account Section state
  const hasSavedBank = !!(activeUser.bankDetails && activeUser.bankDetails.bankName && activeUser.bankDetails.accountNumber);
  const bankBadge = document.getElementById('wdrBankBadge');
  const savedBox = document.getElementById('savedBankDisplayBox');
  const formWrap = document.getElementById('bankDetailsFormWrap');
  const btnCancel = document.getElementById('btnCancelEditBank');
  const payoutTargetBox = document.getElementById('wdrPayoutTargetBox');

  if (hasSavedBank && !isEditingBankDetails) {
    if (bankBadge) {
      bankBadge.className = 'badge badge-approved';
      bankBadge.textContent = 'Saved Account';
    }
    if (savedBox) savedBox.style.display = 'block';
    if (formWrap) formWrap.style.display = 'none';

    const dispBank = document.getElementById('dispSavedBankName');
    const dispAcc = document.getElementById('dispSavedAccountNumber');
    const dispName = document.getElementById('dispSavedAccountName');
    if (dispBank) dispBank.textContent = activeUser.bankDetails.bankName;
    if (dispAcc) dispAcc.textContent = activeUser.bankDetails.accountNumber;
    if (dispName) dispName.textContent = activeUser.bankDetails.accountName || '';

    if (payoutTargetBox) {
      payoutTargetBox.style.display = 'block';
      payoutTargetBox.style.background = 'rgba(16, 185, 129, 0.08)';
      payoutTargetBox.style.border = '1px solid rgba(16, 185, 129, 0.25)';
      payoutTargetBox.style.color = '#065f46';
      payoutTargetBox.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 2px;">Payout Destination:</div>
        <div>${escapeHtml(activeUser.bankDetails.bankName)} &bull; <strong>${escapeHtml(activeUser.bankDetails.accountNumber)}</strong> (${escapeHtml(activeUser.bankDetails.accountName || '')})</div>
      `;
    }
  } else {
    // Show editing form
    if (bankBadge) {
      if (hasSavedBank) {
        bankBadge.className = 'badge badge-active';
        bankBadge.textContent = 'Editing Account';
      } else {
        bankBadge.className = 'badge badge-pending';
        bankBadge.textContent = 'No Account Saved';
      }
    }
    if (savedBox) savedBox.style.display = 'none';
    if (formWrap) formWrap.style.display = 'block';
    if (btnCancel) btnCancel.style.display = hasSavedBank ? 'inline-block' : 'none';

    // Populate existing values if present
    if (activeUser.bankDetails) {
      const bankSelect = document.getElementById('wdrBankSelect');
      const accNumInput = document.getElementById('wdrAccountNumber');
      const accNameInput = document.getElementById('wdrAccountName');
      if (bankSelect && activeUser.bankDetails.bankName) {
        bankSelect.value = activeUser.bankDetails.bankName;
        if (window.TaskEarnModalSelect) window.TaskEarnModalSelect.sync('wdrBankSelect');
      }
      if (accNumInput && activeUser.bankDetails.accountNumber) {
        accNumInput.value = activeUser.bankDetails.accountNumber;
      }
      if (accNameInput && activeUser.bankDetails.accountName) {
        accNameInput.value = activeUser.bankDetails.accountName;
      }
    }

    if (payoutTargetBox) {
      payoutTargetBox.style.display = 'block';
      payoutTargetBox.style.background = 'rgba(239, 68, 68, 0.08)';
      payoutTargetBox.style.border = '1px solid rgba(239, 68, 68, 0.25)';
      payoutTargetBox.style.color = '#991b1b';
      payoutTargetBox.innerHTML = `
        <strong>Notice:</strong> Please save your bank account details above before submitting a withdrawal request.
      `;
    }
  }

  // Render user withdrawal history
  const withdrawals = window.TaskEarnDB.getUserWithdrawals(activeUser.id);
  const tbody = document.getElementById('userWithdrawalHistoryBody');

  if (tbody) {
    if (withdrawals.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No withdrawal requests yet.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = withdrawals.map(w => {
        let badgeClass = 'badge-pending';
        if (w.status === 'approved') badgeClass = 'badge-approved';
        if (w.status === 'declined') badgeClass = 'badge-declined';

        return `
          <tr>
            <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
            <td><strong>${w.points.toLocaleString()}</strong></td>
            <td><strong>₦${w.amountNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></td>
            <td>
              <div>${escapeHtml(w.bankName)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(w.accountNumber)} &bull; ${escapeHtml(w.accountName)}</div>
            </td>
            <td>
              <span class="badge ${badgeClass}">${w.status.toUpperCase()}</span>
              ${w.declineReason ? `<div style="font-size: 0.75rem; color: #991b1b; margin-top: 4px;">Reason: ${escapeHtml(w.declineReason)}</div>` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function calculateWithdrawalNaira() {
  const points = Number(document.getElementById('wdrPointsInput').value) || 0;
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  const naira = points * rate;
  document.getElementById('wdrCalculatedNaira').textContent = `Estimated Payout: ₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

let isSubmittingWithdrawal = false;

async function handleWithdrawalRequest(event) {
  event.preventDefault();
  if (isSubmittingWithdrawal) return;

  const alertEl = document.getElementById('withdrawalAlert');
  const points = Number(document.getElementById('wdrPointsInput').value);
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  // Must have saved bank details
  if (!activeUser.bankDetails || !activeUser.bankDetails.bankName || !activeUser.bankDetails.accountNumber) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Please enter and save your bank account details above before requesting a withdrawal.';
    alertEl.style.display = 'block';
    return;
  }

  const { bankName, accountNumber, accountName } = activeUser.bankDetails;

  const cleanAcc = (accountNumber || '').replace(/[^0-9]/g, '');
  if (cleanAcc.length !== 10) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Saved bank account number must be exactly 10 digits (NUBAN format). Please edit your bank details.';
    alertEl.style.display = 'block';
    return;
  }

  isSubmittingWithdrawal = true;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting request...';
    }

    window.TaskEarnDB.requestWithdrawal({
      userId: activeUser.id,
      points,
      bankName,
      accountNumber: cleanAcc,
      accountName: accountName || `${activeUser.firstName} ${activeUser.lastName}`
    });

    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Withdrawal request submitted successfully! Please note that withdrawals can take up to 48 hours to be reviewed and credited to your bank account.';
    alertEl.style.display = 'block';

    document.getElementById('wdrPointsInput').value = '';
    calculateWithdrawalNaira();
    renderWithdrawalsTab();
    updateWalletHeader();
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    isSubmittingWithdrawal = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

// =================== TAB 3: SUPPORT & MESSAGES ===================

function renderChatMessages() {
  if (!activeUser) return;
  const msgs = window.TaskEarnDB.getMessages(activeUser.id);
  const container = document.getElementById('userChatMessages');

  if (msgs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); margin: auto;">
        No messages yet. Send a message to chat with TaskEarn Support.
      </div>
    `;
  } else {
    container.innerHTML = msgs.map(m => {
      const isUser = m.sender === 'user';
      return `
        <div class="message-bubble ${isUser ? 'message-user' : 'message-admin'}">
          <div>${escapeHtml(m.text)}</div>
          ${m.image ? `<img src="${m.image}" class="message-image" alt="Attachment">` : ''}
          <div class="message-meta">
            ${isUser ? 'You' : 'Admin'} &bull; ${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      `;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }
}

function compressImage(file, maxWidth = 600, maxHeight = 600, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(e.target.result);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleChatImagePreview(event) {
  const file = event.target.files[0];
  if (!file) return;

  const compressed = await compressImage(file, 800, 800, 0.75);
  if (compressed) {
    tempChatImageData = compressed;
    document.getElementById('chatImagePreviewName').textContent = file.name;
    document.getElementById('chatImagePreviewContainer').style.display = 'flex';
  }
}

function clearChatImagePreview() {
  tempChatImageData = null;
  document.getElementById('chatImageInput').value = '';
  document.getElementById('chatImagePreviewContainer').style.display = 'none';
}

let isSendingUserMessage = false;

function handleSendUserMessage(event) {
  event.preventDefault();
  if (isSendingUserMessage) return;

  const textInput = document.getElementById('chatTextInput');
  const text = (textInput?.value || '').trim();
  const image = tempChatImageData;
  if (!text && !image) return;

  isSendingUserMessage = true;
  const sendBtn = event.target.querySelector('button[type="submit"]');
  if (sendBtn) sendBtn.disabled = true;

  try {
    window.TaskEarnDB.sendMessage({
      userId: activeUser.id,
      sender: 'user',
      text: text,
      image: image
    });

    if (textInput) textInput.value = '';
    clearChatImagePreview();
    renderChatMessages();
    updateUserTabIndicators();
  } finally {
    setTimeout(() => {
      isSendingUserMessage = false;
      if (sendBtn) sendBtn.disabled = false;
    }, 600);
  }
}

// =================== TAB 4: REFERRALS ===================

function renderReferralsTab() {
  if (!activeUser) return;
  activeUser = window.TaskEarnDB.getCurrentUser();
  const settings = window.TaskEarnDB.getSettings();
  const bonus = Number(settings.referralPoints) || 150;
  const rate = Number(settings.pointRateNaira) || 1.0;

  document.getElementById('refBonusHeadline').textContent = `Earn ${bonus} Points Per Referral`;

  const userRef = (activeUser.username || activeUser.referralCode || '').toLowerCase();
  const codeInput = document.getElementById('userReferralCodeInput');
  const linkInput = document.getElementById('userReferralLinkInput');
  if (codeInput) codeInput.value = userRef;

  const origin = window.location.origin + window.location.pathname;
  if (linkInput) linkInput.value = `${origin}?ref=${userRef}`;

  const allUsers = window.TaskEarnDB.getUsers();
  const referredUsers = allUsers.filter(u => 
    u.referredBy && (
      u.referredBy.toLowerCase() === userRef || 
      (activeUser.referralCode && u.referredBy.toLowerCase() === activeUser.referralCode.toLowerCase())
    )
  );

  document.getElementById('refTotalInvited').textContent = referredUsers.length;
  const totalRefPoints = referredUsers.length * bonus;
  document.getElementById('refTotalPoints').textContent = `${totalRefPoints.toLocaleString()} PTS`;
  document.getElementById('refNairaEarned').textContent = `₦${(totalRefPoints * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })} equivalent`;

  const tbody = document.getElementById('userReferralsTableBody');
  if (referredUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
          You haven't referred any users yet. Share your referral username above to start earning!
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = referredUsers.map(u => `
      <tr>
        <td>
          <strong>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</strong>
          ${u.username ? `<span style="font-size: 0.8rem; color: var(--primary-blue); margin-left: 4px;">@${escapeHtml(u.username)}</span>` : ''}
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(u.email)}</div>
        </td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td>${u.totalEarnedPoints.toLocaleString()} PTS</td>
        <td>
          <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-suspended'}">
            ${u.status.toUpperCase()}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

async function copyReferralCode() {
  const code = document.getElementById('userReferralCodeInput').value;
  try {
    await navigator.clipboard.writeText(code);
    await window.showCustomAlert('Referral code copied to clipboard!', {
      title: 'Copied to Clipboard',
      type: 'success'
    });
  } catch (e) {
    await window.showCustomAlert('Failed to copy to clipboard.', {
      title: 'Copy Failed',
      type: 'error'
    });
  }
}

async function copyReferralLink() {
  const link = document.getElementById('userReferralLinkInput').value;
  try {
    await navigator.clipboard.writeText(link);
    await window.showCustomAlert('Referral link copied to clipboard!', {
      title: 'Copied to Clipboard',
      type: 'success'
    });
  } catch (e) {
    await window.showCustomAlert('Failed to copy to clipboard.', {
      title: 'Copy Failed',
      type: 'error'
    });
  }
}

// =================== TAB 5: MORE / PROFILE ===================

function loadProfileDetails() {
  if (!activeUser) return;
  activeUser = window.TaskEarnDB.getCurrentUser();

  document.getElementById('profFirstName').value = activeUser.firstName || '';
  document.getElementById('profLastName').value = activeUser.lastName || '';
  if (document.getElementById('profUsername')) {
    document.getElementById('profUsername').value = activeUser.username || '';
  }
  document.getElementById('profEmail').value = activeUser.email || '';
  document.getElementById('profPhone').value = activeUser.phone || '';
  document.getElementById('userStatusBadge').textContent = `${activeUser.status.toUpperCase()} MEMBER`;

  const avatarDisplay = document.getElementById('profileAvatarDisplay');
  const removeBtn = document.getElementById('btnRemoveAvatar');

  if (activeUser.avatar) {
    avatarDisplay.innerHTML = `<img src="${activeUser.avatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    avatarDisplay.textContent = (activeUser.firstName[0] || 'U').toUpperCase();
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const compressed = await compressImage(file, 300, 300, 0.8);
  if (compressed) {
    const updated = window.TaskEarnDB.updateUser(activeUser.id, { avatar: compressed });
    activeUser = updated;
    loadProfileDetails();
    updateWalletHeader();
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    const alertEl = document.getElementById('profileAlert');
    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Profile picture updated successfully and synced across devices!';
      alertEl.style.display = 'block';
      setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 3000);
    }
  }
}

async function handleRemoveAvatar() {
  if (!activeUser || !activeUser.avatar) return;
  const confirmed = await window.showCustomConfirm('Are you sure you want to remove your profile picture?', {
    title: 'Remove Profile Picture',
    confirmText: 'Remove Picture',
    danger: true
  });
  if (!confirmed) return;

  const updated = window.TaskEarnDB.updateUser(activeUser.id, { avatar: '' });
  activeUser = updated;
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  loadProfileDetails();
  updateWalletHeader();

  const fileInput = document.getElementById('avatarFileInput');
  if (fileInput) fileInput.value = '';

  const alertEl = document.getElementById('profileAlert');
  if (alertEl) {
    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Profile picture removed successfully and synced.';
    alertEl.style.display = 'block';
    setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 3000);
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const firstName = document.getElementById('profFirstName').value.trim();
  const lastName = document.getElementById('profLastName').value.trim();
  const username = (document.getElementById('profUsername')?.value || '').trim();
  const email = document.getElementById('profEmail').value.trim();
  const phone = document.getElementById('profPhone').value.trim();
  const alertEl = document.getElementById('profileAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  const cleanPhone = phone.replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(cleanPhone)) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Phone number must be exactly 11 digits (e.g. 08012345678).';
    alertEl.style.display = 'block';
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving profile...';
    }

    const updated = window.TaskEarnDB.updateUser(activeUser.id, { firstName, lastName, username, email, phone });
    activeUser = updated;

    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Profile updated successfully and synced across all devices!';
    alertEl.style.display = 'block';
    loadProfileDetails();
    updateWalletHeader();
    setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 3500);
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const currentPass = document.getElementById('currentPass').value;
  const newPass = document.getElementById('newPass').value;
  const confirmPass = document.getElementById('confirmNewPass')?.value;
  const alertEl = document.getElementById('passwordAlert') || document.getElementById('profileAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  // Ensure activeUser has latest cached data
  activeUser = window.TaskEarnDB.getCurrentUser();

  if (activeUser.password !== currentPass) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Current password is incorrect. Please re-check and try again.';
    alertEl.style.display = 'block';
    return;
  }

  if (newPass === currentPass) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'New password cannot be the same as your current password.';
    alertEl.style.display = 'block';
    return;
  }

  if (confirmPass !== undefined && newPass !== confirmPass) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'New passwords do not match. Please confirm your new password.';
    alertEl.style.display = 'block';
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating password...';
    }

    window.TaskEarnDB.updateUser(activeUser.id, { password: newPass });
    activeUser = window.TaskEarnDB.getCurrentUser();

    // Await cloud sync so the remote JSONBin record is updated BEFORE user navigates or switches devices
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Password changed successfully and synchronized across all devices!';
    alertEl.style.display = 'block';

    document.getElementById('passwordForm').reset();
    if (window.checkPasswordCriteria) {
      window.checkPasswordCriteria('', 'newPassCriteria');
    }

    setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 4000);
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message || 'Failed to update password. Please check your internet connection.';
    alertEl.style.display = 'block';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

window.handleRemoveAvatar = handleRemoveAvatar;

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
