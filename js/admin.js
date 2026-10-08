/**
 * TaskEarn - Administration Controller
 * Manages overview stats, user directory, drawer details, task creation/editing with dwell timer,
 * financial rates, withdrawal processing, and user DM inbox.
 */

let selectedUserForChat = null;
let tempAdminChatImageData = null;

function initAdmin() {
  try { injectAdminSvgIcons(); } catch (e) {}
  try { initAdminDashboard(); } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

function injectAdminSvgIcons() {
  const icons = window.ICONS || (typeof ICONS !== 'undefined' ? ICONS : null);
  if (!icons) return;

  const setIcon = (id, svg) => {
    const el = document.getElementById(id);
    if (el && svg) el.innerHTML = svg;
  };

  // Desktop Sidebar Icons
  setIcon('admDIconOverview', icons.tasks);
  setIcon('admDIconTasks', icons.video);
  setIcon('admDIconCreate', icons.plus);
  setIcon('admDIconFinancial', icons.wallet);
  setIcon('admDIconMore', icons.more);
  setIcon('admSidebarLogoutIcon', icons.logout);

  // Mobile Bottom Nav Icons
  setIcon('mAdmIconOverview', icons.tasks);
  setIcon('mAdmIconTasks', icons.video);
  setIcon('mAdmIconCreate', icons.plus);
  setIcon('mAdmIconFinancial', icons.wallet);
  setIcon('mAdmIconMore', icons.more);

  // UI Icons
  setIcon('admSearchIcon', window.ICONS.search);
  setIcon('admSearchIconFull', window.ICONS.search);
  setIcon('admTaskSearchIcon', window.ICONS.search);
  setIcon('admPayInSearchIcon', window.ICONS.search);
  setIcon('admPayInSearchIconFull', window.ICONS.search);
  setIcon('admTasksFeedSearchIconFull', window.ICONS.search);
  setIcon('admPendingWithdrawalsSearchIconFull', window.ICONS.search);
  setIcon('admWithdrawalLogsSearchIconFull', window.ICONS.search);
  setIcon('admInboxSearchIcon', window.ICONS.search);
  setIcon('admBtnIconPlus', window.ICONS.plus);
  setIcon('admIconAttach', window.ICONS.image);
  setIcon('admIconSend', window.ICONS.send);
  setIcon('admHeaderLogoutIcon', window.ICONS.logout);
  setIcon('iconCloseDrawer', window.ICONS.close);
  setIcon('iconCloseEditModal', window.ICONS.close);
  setIcon('iconCloseNewChatModal', window.ICONS.close);
  setIcon('admNewChatSearchIcon', window.ICONS.search);

  // More Hub Navigation Icons
  setIcon('hubIconUsers', window.ICONS.users || window.ICONS.referral);
  setIcon('hubIconTasksFeed', window.ICONS.tasks);
  setIcon('hubIconPayIns', window.ICONS.creditCard || window.ICONS.wallet);
  setIcon('hubIconPending', window.ICONS.clock);
  setIcon('hubIconLogs', window.ICONS.list || window.ICONS.check);
  setIcon('hubIconInbox', window.ICONS.chat);
  setIcon('hubIconCloud', window.ICONS.database || window.ICONS.shield);

  if (window.initPasswordToggleIcons) {
    window.initPasswordToggleIcons();
  }
}

function refreshAdminDataViews(changedKeys = null) {
  updateMoreHubBadges();
  updateAdminTabIndicators();

  const currentTab = localStorage.getItem('taskearn_admin_active_tab') || 'overview';
  const activeEl = document.activeElement;

  if (currentTab === 'overview') {
    renderOverviewStats();
    renderRecentActivity();
    const userSearch = document.getElementById('admUserSearchInput');
    if (!activeEl || activeEl !== userSearch) {
      renderAdminUsers();
    }
    renderPayInRecords();
    const financialForm = document.getElementById('financialSettingsForm');
    if (!activeEl || !financialForm || !financialForm.contains(activeEl)) {
      loadFinancialSettings();
    }
  } else if (currentTab === 'financial') {
    const financialForm = document.getElementById('financialSettingsForm');
    const adminPassForm = document.getElementById('adminPasswordForm');
    if (!activeEl || (!financialForm?.contains(activeEl) && !adminPassForm?.contains(activeEl))) {
      loadFinancialSettings();
    }
    renderPayInRecords();
    renderWithdrawalsQueue();
  } else if (currentTab === 'tasks') {
    const taskSearch = document.getElementById('admTaskSearchInput');
    if (!activeEl || activeEl !== taskSearch) {
      renderAdminTasks();
    }
  } else if (currentTab === 'more') {
    const activeSubpage = document.querySelector('.more-subpage.active');
    if (activeSubpage) {
      const pageId = activeSubpage.id.replace('admMorePage-', '');
      if (pageId === 'users') {
        const fullUserSearch = document.getElementById('admUserSearchInputFull') || document.getElementById('admFullUserSearchInput');
        if (!activeEl || activeEl !== fullUserSearch) renderAdminUsers();
      } else if (pageId === 'tasks-feed') {
        renderRecentActivity();
      } else if (pageId === 'pay-ins') {
        const payInSearch = document.getElementById('admPayInSearchInputFull');
        if (!activeEl || activeEl !== payInSearch) renderPayInRecords();
      } else if (pageId === 'pending-withdrawals' || pageId === 'withdrawal-logs') {
        const pendingSearch = document.getElementById('admPendingWithdrawalsSearchInputFull');
        const logsSearch = document.getElementById('admWithdrawalLogsSearchInputFull');
        if (!activeEl || (activeEl !== pendingSearch && activeEl !== logsSearch)) {
          renderWithdrawalsQueue();
        }
      } else if (pageId === 'inbox') {
        renderAdminConversationList();
      }
    }
  }
}

function initAdminDashboard() {
  checkAdminAuth();

  if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud && window.TaskEarnDB.isAdminLoggedIn()) {
    window.TaskEarnDB.pullFromCloud(true).then(() => {
      refreshAdminDataViews();
    }).catch(() => {});
  }

  if (window.TaskEarnDB && window.TaskEarnDB.onSync) {
    window.TaskEarnDB.onSync((type, data) => {
      const badge = document.getElementById('cloudSyncStatusBadge');
      if (badge) {
        badge.textContent = 'Supabase Connected';
        badge.className = 'badge badge-approved';
      }
      // Ignore self-initiated pushes to prevent UI disruption
      if (type === 'push') return;

      if (window.TaskEarnDB.isAdminLoggedIn()) {
        refreshAdminDataViews(data?.changedKeys);
      }
    });
  }

  // Automatic real-time polling to keep overview stats, user directory, and pay-ins updated
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && window.TaskEarnDB && window.TaskEarnDB.isAdminLoggedIn && window.TaskEarnDB.isAdminLoggedIn()) {
      refreshAdminDataViews();
    }
  }, 3500);
}

const ADMIN_TABS = ['overview', 'tasks', 'create-task', 'financial', 'more'];
const ADMIN_SUBPAGES = [
  'users',
  'tasks-feed',
  'pay-ins',
  'pending-withdrawals',
  'withdrawal-logs',
  'inbox',
  'cloud-sync'
];
const ADMIN_ROUTE_ALIASES = {
  'payouts': 'pending-withdrawals',
  'pending-payouts': 'pending-withdrawals',
  'withdrawals': 'pending-withdrawals',
  'withdrawal': 'pending-withdrawals',
  'logs': 'withdrawal-logs',
  'payout-logs': 'withdrawal-logs',
  'history': 'withdrawal-logs',
  'members': 'users',
  'user-list': 'users',
  'activity': 'tasks-feed',
  'feed': 'tasks-feed',
  'completions': 'tasks-feed',
  'recent': 'tasks-feed',
  'payments': 'pay-ins',
  'verifications': 'pay-ins',
  'chat': 'inbox',
  'messages': 'inbox',
  'support': 'inbox',
  'sync': 'cloud-sync',
  'backup': 'cloud-sync',
  'create': 'create-task',
  'new-task': 'create-task',
  'finance': 'financial',
  'settings': 'financial',
  'home': 'overview',
  'dashboard': 'overview'
};

function checkAdminAuth() {
  const isAuth = window.TaskEarnDB.isAdminLoggedIn();
  const authScreen = document.getElementById('admAuthScreen');
  const dashboard = document.getElementById('admDashboard');

  if (!isAuth) {
    authScreen.style.display = 'flex';
    dashboard.style.display = 'none';
  } else {
    authScreen.style.display = 'none';
    dashboard.style.display = 'flex';

    const rawHash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
    const mappedHash = ADMIN_ROUTE_ALIASES[rawHash] || rawHash;

    const savedSubpage = localStorage.getItem('taskearn_admin_active_subpage');
    const savedReturnTab = localStorage.getItem('taskearn_admin_more_return_tab');

    // 1. Determine if opening a subpage
    if (ADMIN_SUBPAGES.includes(mappedHash)) {
      openMorePage(mappedHash, savedReturnTab);
    } else if (savedSubpage && ADMIN_SUBPAGES.includes(savedSubpage) && (mappedHash === 'more' || !mappedHash)) {
      openMorePage(savedSubpage, savedReturnTab);
    } else {
      // 2. Otherwise opening a main tab
      let targetTab = mappedHash;
      if (!ADMIN_TABS.includes(targetTab)) {
        targetTab = localStorage.getItem('taskearn_admin_active_tab') || 'overview';
      }
      if (!ADMIN_TABS.includes(targetTab)) {
        targetTab = 'overview';
      }
      switchAdminTab(targetTab);
    }

    // 3. Restore chat user if in inbox
    const currentSubpage = localStorage.getItem('taskearn_admin_active_subpage');
    if (currentSubpage === 'inbox' || mappedHash === 'inbox') {
      const savedChatUser = localStorage.getItem('taskearn_admin_active_chat_user');
      if (savedChatUser && window.TaskEarnDB.getUserById(savedChatUser)) {
        selectUserForAdminChat(savedChatUser);
      }
    }

    // 4. Restore open user drawer if drawer was open
    const savedDrawerUser = localStorage.getItem('taskearn_admin_active_drawer_user');
    if (savedDrawerUser && window.TaskEarnDB.getUserById(savedDrawerUser)) {
      openUserDrawer(savedDrawerUser);
    }

    updateMoreHubBadges();
    updateAdminTabIndicators();
  }
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('admLoginEmail').value;
  const pass = document.getElementById('admLoginPassword').value;
  const alertEl = document.getElementById('admAuthAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const origText = btn ? btn.textContent : '';

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying Admin...';
    }
    // Pull fresh admin configuration from cloud before verifying
    if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud) {
      await window.TaskEarnDB.pullFromCloud(true);
    }
    window.TaskEarnDB.loginAdmin(email, pass);
    checkAdminAuth();
    refreshAdminDataViews();
  } catch (err) {
    if (window.showCustomAlert) {
      window.showCustomAlert(err.message, {
        title: 'Authentication Failed',
        type: 'danger'
      });
    } else {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

function handleAdminLogout() {
  window.TaskEarnDB.logoutAdmin();
  if (document.body) {
    document.body.classList.remove('adm-subpage-active', 'adm-inbox-active');
  }
  try {
    localStorage.removeItem('taskearn_admin_active_tab');
    localStorage.removeItem('taskearn_admin_active_subpage');
    localStorage.removeItem('taskearn_admin_active_chat_user');
    localStorage.removeItem('taskearn_admin_active_drawer_user');
    localStorage.removeItem('taskearn_admin_more_return_tab');
    history.replaceState(null, '', window.location.pathname);
  } catch (e) {}
  checkAdminAuth();
}

function switchAdminTab(tabName, preserveSubpage = false) {
  const tabs = ['overview', 'tasks', 'create-task', 'financial', 'more'];
  if (!tabs.includes(tabName)) tabName = 'overview';

  if (tabName !== 'more' || !preserveSubpage) {
    if (document.body) {
      document.body.classList.remove('adm-subpage-active', 'adm-inbox-active');
    }
    document.querySelectorAll('.more-subpage').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('active');
    });
    const hub = document.getElementById('admMoreHubMenu');
    if (hub) hub.style.display = 'block';

    try {
      localStorage.removeItem('taskearn_admin_active_subpage');
      localStorage.removeItem('taskearn_admin_active_chat_user');
    } catch (e) {}
  }

  try {
    localStorage.setItem('taskearn_admin_active_tab', tabName);
    if (!preserveSubpage) {
      history.replaceState(null, '', '#' + tabName);
    }
  } catch (e) {}

  tabs.forEach(tab => {
    const panel = document.getElementById(`adm-tab-${tab}`);
    if (panel) panel.classList.toggle('active', tab === tabName);
  });

  const desktopAdminMap = {
    'overview': 'admDTabOverview',
    'tasks': 'admDTabTasks',
    'create-task': 'admDTabCreate',
    'financial': 'admDTabFinancial',
    'more': 'admDTabMore'
  };
  const mobileAdminMap = {
    'overview': 'mAdmNavOverview',
    'tasks': 'mAdmNavTasks',
    'create-task': 'mAdmNavCreate',
    'financial': 'mAdmNavFinancial',
    'more': 'mAdmNavMore'
  };
  Object.entries(desktopAdminMap).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', name === tabName);
  });
  Object.entries(mobileAdminMap).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', name === tabName);
  });

  if (tabName === 'overview') {
    renderOverviewStats();
    renderRecentActivity();
    renderAdminUsers();
    renderPayInRecords();
    loadFinancialSettings();
  } else if (tabName === 'tasks') {
    renderAdminTasks();
  } else if (tabName === 'create-task') {
    updateCreateTaskNairaPreview();
  } else if (tabName === 'financial') {
    loadFinancialSettings();
    renderPayInRecords();
    renderWithdrawalsQueue();
  } else if (tabName === 'more') {
    if (!preserveSubpage) {
      document.querySelectorAll('.more-subpage').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
      });
      const hub = document.getElementById('admMoreHubMenu');
      if (hub) hub.style.display = 'block';
      updateMoreHubBadges();
      renderAdminConversationList();
    }
  }
  updateAdminTabIndicators();
}

let morePageReturnTab = null;

function openMorePage(pageId, returnTab = null) {
  const normalizedPageId = ADMIN_ROUTE_ALIASES[pageId] || pageId;
  if (!ADMIN_SUBPAGES.includes(normalizedPageId)) return;

  if (returnTab) {
    morePageReturnTab = returnTab;
    try {
      localStorage.setItem('taskearn_admin_more_return_tab', returnTab);
    } catch (e) {}
  } else {
    const activeTab = localStorage.getItem('taskearn_admin_active_tab') || 'overview';
    if (activeTab !== 'more') {
      morePageReturnTab = activeTab;
      try {
        localStorage.setItem('taskearn_admin_more_return_tab', activeTab);
      } catch (e) {}
    }
  }

  switchAdminTab('more', true);

  const hub = document.getElementById('admMoreHubMenu');
  if (hub) hub.style.display = 'none';

  document.querySelectorAll('.more-subpage').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  const target = document.getElementById(`admMorePage-${normalizedPageId}`);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';
  }

  if (document.body) {
    document.body.classList.add('adm-subpage-active');
    document.body.classList.toggle('adm-inbox-active', normalizedPageId === 'inbox');
  }

  try {
    localStorage.setItem('taskearn_admin_active_subpage', normalizedPageId);
    history.replaceState(null, '', '#' + normalizedPageId);
  } catch (e) {}

  // Refresh relevant data
  if (normalizedPageId === 'users') {
    renderAdminUsers();
  } else if (normalizedPageId === 'tasks-feed') {
    renderRecentActivity();
  } else if (normalizedPageId === 'pay-ins') {
    renderPayInRecords();
  } else if (normalizedPageId === 'pending-withdrawals' || normalizedPageId === 'withdrawal-logs') {
    renderWithdrawalsQueue();
  } else if (normalizedPageId === 'inbox') {
    renderAdminConversationList();
  }
}

function closeMorePage() {
  if (document.body) {
    document.body.classList.remove('adm-subpage-active', 'adm-inbox-active');
  }
  document.querySelectorAll('.more-subpage').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  try {
    localStorage.removeItem('taskearn_admin_active_subpage');
    localStorage.removeItem('taskearn_admin_active_chat_user');
  } catch (e) {}

  const returnTarget = morePageReturnTab || localStorage.getItem('taskearn_admin_more_return_tab');
  morePageReturnTab = null;
  try {
    localStorage.removeItem('taskearn_admin_more_return_tab');
  } catch (e) {}

  if (returnTarget && returnTarget !== 'more') {
    switchAdminTab(returnTarget);
    return;
  }

  const hub = document.getElementById('admMoreHubMenu');
  if (hub) {
    hub.style.display = 'block';
    hub.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  try {
    localStorage.setItem('taskearn_admin_active_tab', 'more');
    history.replaceState(null, '', '#more');
  } catch (e) {}
  updateMoreHubBadges();
}

function updateMoreHubBadges() {
  const users = window.TaskEarnDB.getUsers();
  const submissions = window.TaskEarnDB.getSubmissions();
  const completedTasks = submissions.filter(s => s.status === 'approved' || s.proofData || !s.status);
  const payments = window.TaskEarnDB.getPayments();
  const withdrawals = window.TaskEarnDB.getWithdrawals();
  const pending = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status !== 'pending');
  const messages = window.TaskEarnDB.getMessages ? window.TaskEarnDB.getMessages() : [];
  const uniqueConvs = new Set(messages.map(m => m.userId)).size;

  const totalPayIn = payments
    .filter(p => p.status === 'successful')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const hubUsersBadge = document.getElementById('hubUsersBadge');
  if (hubUsersBadge) hubUsersBadge.textContent = `${users.length} Members`;

  const hubTasksBadge = document.getElementById('hubTasksBadge');
  if (hubTasksBadge) hubTasksBadge.textContent = `${completedTasks.length} Completed`;

  const hubPayInsBadge = document.getElementById('hubPayInsBadge');
  if (hubPayInsBadge) hubPayInsBadge.textContent = `Total: ₦${totalPayIn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const hubPendingBadge = document.getElementById('hubPendingBadge');
  if (hubPendingBadge) hubPendingBadge.textContent = `${pending.length} Pending`;

  const hubLogsBadge = document.getElementById('hubLogsBadge');
  if (hubLogsBadge) hubLogsBadge.textContent = `${completedWithdrawals.length} Records`;

  const hubInboxBadge = document.getElementById('hubInboxBadge');
  if (hubInboxBadge) hubInboxBadge.textContent = `${uniqueConvs} Chats`;
}

function openMorePageWithFilter(pageId, returnTab, filterType) {
  openMorePage(pageId, returnTab);
  const filterEl = document.getElementById('admPendingWithdrawalsTypeFilterFull');
  if (filterEl && filterType) {
    filterEl.value = filterType;
  }
  renderWithdrawalsQueue();
}

window.openMorePage = openMorePage;
window.openMorePageWithFilter = openMorePageWithFilter;
window.closeMorePage = closeMorePage;
window.updateMoreHubBadges = updateMoreHubBadges;

function updateAdminTabIndicators() {
  if (!window.TaskEarnDB || !window.TaskEarnDB.isAdminLoggedIn()) return;

  const unreadMessagesCount = window.TaskEarnDB.getUnreadMessageCountForAdmin ? window.TaskEarnDB.getUnreadMessageCountForAdmin() : 0;
  const pendingPayoutsCount = window.TaskEarnDB.getPendingWithdrawalsCount ? window.TaskEarnDB.getPendingWithdrawalsCount() : 0;

  const msgBadgeText = window.TaskEarnDB.formatBadgeCount(unreadMessagesCount);
  const payoutBadgeText = window.TaskEarnDB.formatBadgeCount(pendingPayoutsCount);

  // Financial Tab Badges (Pending Payouts)
  const dFinanceBadge = document.getElementById('admDBadgeFinance');
  const mFinanceBadge = document.getElementById('mAdmBadgeFinance');
  [dFinanceBadge, mFinanceBadge].forEach(el => {
    if (el) {
      if (payoutBadgeText) {
        el.textContent = payoutBadgeText;
        el.style.display = 'inline-flex';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }
  });

  // More Tab Badges (Unread Messages from Users)
  const dMoreBadge = document.getElementById('admDBadgeMore');
  const mMoreBadge = document.getElementById('mAdmBadgeMore');
  [dMoreBadge, mMoreBadge].forEach(el => {
    if (el) {
      if (msgBadgeText) {
        el.textContent = msgBadgeText;
        el.style.display = 'inline-flex';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }
  });

  // Also update hub inbox badge
  const hubInboxBadge = document.getElementById('hubInboxBadge');
  if (hubInboxBadge) {
    if (unreadMessagesCount > 0) {
      hubInboxBadge.textContent = `${msgBadgeText} Unread`;
      hubInboxBadge.className = 'badge badge-approved';
    } else {
      const messages = window.TaskEarnDB.getMessages ? window.TaskEarnDB.getMessages() : [];
      const uniqueConvs = new Set(messages.map(m => m.userId)).size;
      hubInboxBadge.textContent = `${uniqueConvs} Chats`;
      hubInboxBadge.className = 'badge badge-active';
    }
  }
}
window.updateAdminTabIndicators = updateAdminTabIndicators;

window.addEventListener('hashchange', () => {
  if (!window.TaskEarnDB.isAdminLoggedIn()) return;
  const rawHash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  if (!rawHash) return;
  const mapped = ADMIN_ROUTE_ALIASES[rawHash] || rawHash;

  if (ADMIN_SUBPAGES.includes(mapped)) {
    openMorePage(mapped);
  } else if (ADMIN_TABS.includes(mapped)) {
    switchAdminTab(mapped);
  }
});

// =================== TAB 1: OVERVIEW & USERS ===================

function renderOverviewStats() {
  const stats = window.TaskEarnDB.getPlatformStats();
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  const totalPayIn = window.TaskEarnDB.getTotalPayIn();
  const totalPaidOut = stats.totalPaidOutNaira || 0;
  const netBalance = totalPayIn - totalPaidOut;
  const users = window.TaskEarnDB.getUsers();
  const verifiedCount = users.filter(u => u.isVerified).length;
  const payments = window.TaskEarnDB.getPayments().filter(p => p.status === 'successful');

  const elPayIn = document.getElementById('statTotalPayIn');
  const elPayInSub = document.getElementById('statTotalPayInSub');
  const elPaidOut = document.getElementById('statTotalPaidOut');
  const elPendingSub = document.getElementById('statPendingWithdrawalsCount');
  const elNetBal = document.getElementById('statNetBalance');
  const elTotalUsers = document.getElementById('statTotalUsers');
  const elVerifiedSub = document.getElementById('statVerifiedUsersCount');
  const elTotalPoints = document.getElementById('statTotalPoints');
  const elConvertedNaira = document.getElementById('statConvertedNaira');
  const elRateNotice = document.getElementById('statCurrentRateNotice');

  if (elPayIn) elPayIn.textContent = `₦${totalPayIn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (elPayInSub) elPayInSub.textContent = `${payments.length} verified payment${payments.length === 1 ? '' : 's'}`;
  if (elPaidOut) elPaidOut.textContent = `₦${totalPaidOut.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (elPendingSub) elPendingSub.textContent = `${stats.pendingWithdrawalsCount} pending request${stats.pendingWithdrawalsCount === 1 ? '' : 's'}`;
  if (elNetBal) elNetBal.textContent = `₦${netBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (elTotalUsers) elTotalUsers.textContent = stats.totalUsers;
  if (elVerifiedSub) elVerifiedSub.textContent = `${verifiedCount} verified member${verifiedCount === 1 ? '' : 's'}`;
  if (elTotalPoints) elTotalPoints.textContent = stats.totalEarnedPoints.toLocaleString();
  if (elConvertedNaira) elConvertedNaira.textContent = `₦${stats.totalNairaValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (elRateNotice) elRateNotice.textContent = `Rate: 1 Pt = ₦${rate.toFixed(2)}`;

  const totalCompletionsBadge = document.getElementById('totalCompletionsBadge');
  if (totalCompletionsBadge) totalCompletionsBadge.textContent = `${stats.totalCompletedTasks || 0} Completed`;
  
  const usersListTotalBadge = document.getElementById('usersListTotalBadge');
  if (usersListTotalBadge) usersListTotalBadge.textContent = `${stats.totalUsers} Members`;
}

function createActivityRowHtml(c, uObj) {
  return `
    <tr>
      <td>${new Date(c.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openUserDrawer('${c.userId}')" title="Click to view user profile">
          <div style="width: 28px; height: 28px; border-radius: var(--radius-full); background: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; overflow: hidden; flex-shrink: 0;">
            ${uObj?.avatar ? `<img src="${uObj.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (c.userName ? c.userName[0].toUpperCase() : 'U')}
          </div>
          <div>
            <strong style="color: var(--text-main);">${escapeHtml(c.userName)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">User ID: ${c.userId}</div>
          </div>
        </div>
      </td>
      <td style="cursor: pointer;" onclick="${c.taskId ? `openEditTaskModal('${c.taskId}')` : `switchAdminTab('tasks')`}" title="Click to view task details">
        <strong style="color: var(--primary-blue);">${escapeHtml(c.taskTitle)}</strong>
      </td>
      <td><span class="badge badge-approved">+${c.points} PTS</span></td>
      <td>
        <span class="badge badge-active">Auto Click & Dwell</span>
      </td>
    </tr>
  `;
}

// Live activity feed of auto-verified completions (Both Overview & Full Screen)
function renderRecentActivity() {
  const completions = window.TaskEarnDB.getSubmissions();
  const allUsers = window.TaskEarnDB.getUsers();
  const userMap = {};
  allUsers.forEach(u => { userMap[u.id] = u; });

  const totalCompletionsBadge = document.getElementById('totalCompletionsBadge');
  if (totalCompletionsBadge) totalCompletionsBadge.textContent = `${completions.length} Completed`;

  const fullTasksTotalBadge = document.getElementById('fullTasksTotalBadge');

  const overviewBody = document.getElementById('admRecentActivityTableBodyOverview') || document.getElementById('admRecentActivityTableBody');
  const fullBody = document.getElementById('admRecentActivityTableBodyFull');

  const emptyMsg = `
    <tr>
      <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
        No task completions recorded yet.
      </td>
    </tr>
  `;

  if (completions.length === 0) {
    if (overviewBody) overviewBody.innerHTML = emptyMsg;
    if (fullBody) fullBody.innerHTML = emptyMsg;
    if (fullTasksTotalBadge) fullTasksTotalBadge.textContent = '0 Completed';
    return;
  }

  // Overview gets completions (scrollable within max 5 items height)
  if (overviewBody) {
    overviewBody.innerHTML = completions.map(c => createActivityRowHtml(c, userMap[c.userId])).join('');
  }

  // Full subpage gets searchable filtered items
  if (fullBody) {
    const searchInput = document.getElementById('admRecentActivitySearchInputFull');
    const query = (searchInput?.value || '').toLowerCase().trim();
    let filteredCompletions = completions;

    if (query) {
      filteredCompletions = completions.filter(c => {
        const u = userMap[c.userId];
        const userName = u ? `${u.firstName || ''} ${u.lastName || ''} ${u.username || ''}`.toLowerCase() : (c.userId || '').toLowerCase();
        const taskTitle = (c.taskTitle || '').toLowerCase();
        const points = String(c.points || '');
        const dateStr = new Date(c.completedAt || c.submittedAt || Date.now()).toLocaleDateString().toLowerCase();
        return userName.includes(query) || taskTitle.includes(query) || points.includes(query) || dateStr.includes(query) || 'auto click & dwell'.includes(query);
      });
    }

    if (fullTasksTotalBadge) {
      fullTasksTotalBadge.textContent = query 
        ? `${filteredCompletions.length} of ${completions.length} Found`
        : `${completions.length} Completed`;
    }

    if (filteredCompletions.length === 0) {
      fullBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No completed tasks match your search query.
          </td>
        </tr>
      `;
    } else {
      fullBody.innerHTML = filteredCompletions.map(c => createActivityRowHtml(c, userMap[c.userId])).join('');
    }
  }
}

function openUserDrawerByUsername(username) {
  if (!username) return;
  const clean = String(username).replace(/^@/, '').toLowerCase().trim();
  const users = window.TaskEarnDB.getUsers();
  const target = users.find(u => (u.username && u.username.toLowerCase() === clean) || (u.referralCode && u.referralCode.toLowerCase() === clean));
  if (target) {
    openUserDrawer(target.id);
  } else {
    if (typeof showToast === 'function') {
      showToast(`Referrer "@${username}" not found`, 'warning');
    }
  }
}
window.openUserDrawerByUsername = openUserDrawerByUsername;

function createUserRowHtml(u) {
  return `
    <tr>
      <td style="cursor: pointer;" onclick="openUserDrawer('${u.id}')" title="Click to view ${escapeHtml(u.firstName)}'s full profile">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background-color: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; overflow: hidden; flex-shrink: 0; font-size: 0.85rem; border: 1px solid var(--border-color);">
            ${u.avatar ? `<img src="${u.avatar}" alt="${escapeHtml(u.firstName)}" style="width: 100%; height: 100%; object-fit: cover;">` : (u.firstName ? u.firstName[0].toUpperCase() : 'U')}
          </div>
          <div>
            <div style="font-weight: 700; color: var(--text-main);">
              ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}
              ${u.username ? `<span style="font-weight: 500; font-size: 0.8rem; color: var(--primary-blue); margin-left: 4px;">@${escapeHtml(u.username)}</span>` : ''}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Joined ${new Date(u.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </td>
      <td style="cursor: pointer;" onclick="openUserDrawer('${u.id}')" title="Click to view details">
        <div style="color: var(--text-main); font-weight: 500;">${escapeHtml(u.email)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(u.phone)}</div>
      </td>
      <td>
        <strong style="letter-spacing: 0.04em; color: var(--primary-blue); cursor: pointer;" onclick="openUserDrawer('${u.id}')" title="User referral code">${escapeHtml(u.referralCode || u.username)}</strong>
        ${u.referredBy ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Invited by: <span style="color: var(--primary-blue); font-weight: 600; cursor: pointer; text-decoration: underline;" onclick="event.stopPropagation(); openUserDrawerByUsername('${escapeHtml(u.referredBy)}')" title="Click to view referrer profile">@${escapeHtml(u.referredBy)}</span></div>` : ''}
      </td>
      <td style="cursor: pointer;" onclick="openUserDrawer('${u.id}')" title="Click to adjust points">
        <strong>${u.pointsBalance.toLocaleString()} PTS</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Total: ${u.totalEarnedPoints.toLocaleString()} PTS</div>
      </td>
      <td style="cursor: pointer;" onclick="openUserDrawer('${u.id}')" title="Click to manage status/verification">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
          <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-suspended'}">
            ${u.status.toUpperCase()}
          </span>
          <span class="badge ${u.isVerified ? 'badge-approved' : 'badge-pending'}" style="font-size: 0.68rem; padding: 2px 7px;">
            ${u.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
          </span>
        </div>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openUserDrawer('${u.id}')">
          View Details
        </button>
      </td>
    </tr>
  `;
}

// User Directory (Both Overview Preview & Full Dedicated Screen)
function renderAdminUsers() {
  const users = window.TaskEarnDB.getUsers();
  const searchInputFull = document.getElementById('admUserSearchInputFull');
  const searchInputOverview = document.getElementById('admUserSearchInput');
  const query = (searchInputFull?.value || searchInputOverview?.value || '').toLowerCase().trim();

  const statusFilterEl = document.getElementById('admUserStatusFilterFull') || document.getElementById('admUserStatusFilter');
  const sortFilterEl = document.getElementById('admUserSortFilterFull') || document.getElementById('admUserSortFilter');
  const statusFilter = statusFilterEl?.value || 'all';
  const sortFilter = sortFilterEl?.value || 'newest';

  let filtered = users.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
                          (u.username && u.username.toLowerCase().includes(query)) ||
                          u.email.toLowerCase().includes(query) ||
                          u.phone.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  if (sortFilter === 'points-desc') {
    filtered.sort((a, b) => b.pointsBalance - a.pointsBalance);
  } else if (sortFilter === 'points-asc') {
    filtered.sort((a, b) => a.pointsBalance - b.pointsBalance);
  } else if (sortFilter === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const usersListTotalBadge = document.getElementById('usersListTotalBadge');
  if (usersListTotalBadge) usersListTotalBadge.textContent = `${users.length} Members`;

  const fullUsersTotalBadge = document.getElementById('fullUsersTotalBadge');
  if (fullUsersTotalBadge) fullUsersTotalBadge.textContent = `${filtered.length} of ${users.length} Members`;

  const overviewBody = document.getElementById('admUsersTableBodyOverview') || document.getElementById('admUsersTableBody');
  const fullBody = document.getElementById('admUsersTableBodyFull');

  // Overview gets users (scrollable within max 5 items height)
  if (overviewBody) {
    if (users.length === 0) {
      overviewBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No users registered yet.
          </td>
        </tr>
      `;
    } else {
      const sortedUsers = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      overviewBody.innerHTML = sortedUsers.map(u => createUserRowHtml(u)).join('');
    }
  }

  // Full subpage gets all filtered users
  if (fullBody) {
    if (filtered.length === 0) {
      fullBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No users match the criteria.
          </td>
        </tr>
      `;
    } else {
      fullBody.innerHTML = filtered.map(u => createUserRowHtml(u)).join('');
    }
  }
}

function openUserDrawer(userId) {
  const user = window.TaskEarnDB.getUserById(userId);
  if (!user) {
    try {
      localStorage.removeItem('taskearn_admin_active_drawer_user');
    } catch (e) {}
    if (typeof showToast === 'function') {
      showToast('User account not found', 'warning');
    }
    return;
  }

  try {
    localStorage.setItem('taskearn_admin_active_drawer_user', userId);
  } catch (e) {}

  const submissions = window.TaskEarnDB.getUserSubmissions(userId);
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;

  const drawerContent = document.getElementById('drawerContent');
  drawerContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
      <div style="width: 58px; height: 58px; border-radius: var(--radius-full); background-color: var(--primary-blue); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; overflow: hidden; flex-shrink: 0; border: 2px solid var(--border-color);">
        ${user.avatar ? `<img src="${user.avatar}" alt="${escapeHtml(user.firstName)}" style="width: 100%; height: 100%; object-fit: cover;">` : (user.firstName ? user.firstName[0].toUpperCase() : 'U')}
      </div>
      <div style="flex: 1; min-width: 0;">
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 2px;">
          ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}
          ${user.username ? `<span style="font-size: 0.85rem; font-weight: 500; color: var(--primary-blue); margin-left: 6px;">@${escapeHtml(user.username)}</span>` : ''}
        </h4>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(user.email)} &bull; ${escapeHtml(user.phone)}</div>
        <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
          ${user.avatar ? `
            <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; color: #dc2626; border: 1px solid #fecaca; background: #fff;" onclick="handleAdminRemoveUserAvatar('${user.id}')">
              Remove User Photo
            </button>
          ` : ''}
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="closeUserDrawer(); openMorePage('inbox'); selectUserForAdminChat('${user.id}');" title="Chat with user">
            Message User
          </button>
        </div>
      </div>
    </div>

    <div class="grid-stats" style="grid-template-columns: 1fr 1fr; margin-bottom: 14px;">
      <div class="stat-box">
        <div class="stat-label">Total Wallet Balance</div>
        <div class="stat-value" style="font-size: 1.2rem;">${user.pointsBalance.toLocaleString()} PTS</div>
        <div class="stat-sub">₦${(user.pointsBalance * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Total Earned</div>
        <div class="stat-value" style="font-size: 1.2rem;">${user.totalEarnedPoints.toLocaleString()} PTS</div>
        <div class="stat-sub">${submissions.length} Completed</div>
      </div>
    </div>

    <!-- Separated Balances -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px;">
      <div style="background: var(--bg-surface-alt, #f8fafc); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px;">
        <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--primary-blue);">Task Balance</div>
        <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">${(Number(user.taskPointsBalance) || 0).toLocaleString()} PTS</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">₦${((Number(user.taskPointsBalance) || 0) * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
      </div>
      <div style="background: var(--bg-surface-alt, #f8fafc); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px;">
        <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--primary-green-dark);">Referral Balance</div>
        <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">${(Number(user.referralPointsBalance) || 0).toLocaleString()} PTS</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">₦${((Number(user.referralPointsBalance) || 0) * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0;">Account Verification</h5>
        <span class="badge ${user.isVerified ? 'badge-approved' : 'badge-pending'}">
          ${user.isVerified ? 'VERIFIED (₦3,000 PAID)' : 'UNVERIFIED (PENDING ₦3,000)'}
        </span>
      </div>
      <div><strong>Paystack Ref:</strong> <span style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(user.verificationRef || 'None')}</span></div>
      ${user.verificationPaidAt ? `<div><strong>Paid On:</strong> ${new Date(user.verificationPaidAt).toLocaleString()}</div>` : ''}
      <div style="margin-top: 10px;">
        <button class="btn btn-secondary btn-sm" onclick="handleToggleUserVerification('${user.id}', ${!user.isVerified})">
          ${user.isVerified ? 'Revoke Verification' : 'Manually Verify User'}
        </button>
      </div>
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Bank Information</h5>
      <div><strong>Bank:</strong> ${escapeHtml(user.bankDetails?.bankName || 'Not Set')}</div>
      <div><strong>Account Number:</strong> ${escapeHtml(user.bankDetails?.accountNumber || 'Not Set')}</div>
      <div><strong>Account Name:</strong> ${escapeHtml(user.bankDetails?.accountName || 'Not Set')}</div>
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Referral Details</h5>
      <div><strong>Referral Code:</strong> <span style="font-weight: 600; color: var(--primary-blue);">${escapeHtml(user.referralCode || user.username)}</span></div>
      ${user.referredBy ? `<div style="margin-top: 4px;"><strong>Referred By:</strong> <span style="color: var(--primary-blue); font-weight: 600; cursor: pointer; text-decoration: underline;" onclick="openUserDrawerByUsername('${escapeHtml(user.referredBy)}')" title="Click to view referrer profile">@${escapeHtml(user.referredBy)}</span></div>` : '<div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Direct signup (no referrer)</div>'}
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Adjust User Points</h5>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
        <div>
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Target Pool</label>
          <select id="drawerAdjustPoolSelect" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
            <option value="task">Task Earnings Pool</option>
            <option value="referral">Referral Earnings Pool</option>
          </select>
        </div>
        <div>
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Points (+ or -)</label>
          <input type="number" id="drawerAdjustPointsInput" placeholder="+100 or -50" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="handleDrawerPointsAdjustment('${user.id}')">Apply Balance Adjustment</button>
    </div>

    <!-- Reset User Password -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Reset User Password</h5>
      <div id="drawerPasswordAlert" style="display: none; margin-bottom: 8px;"></div>
      <div style="display: flex; gap: 8px;">
        <input type="text" id="drawerNewUserPassword" placeholder="Enter new password" style="flex: 1; font-size: 0.82rem; padding: 6px 8px;" onkeydown="if(event.key === 'Enter') handleAdminResetUserPassword('${user.id}')">
        <button type="button" class="btn btn-secondary btn-sm" id="btnDrawerSetPassword" onclick="handleAdminResetUserPassword('${user.id}')">Set Password</button>
      </div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">Must have min 6 characters with upper, lower, number, and symbol.</div>
    </div>

    <!-- Edit User Information -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Edit User Account Details</h5>
      <div id="drawerEditAlert" style="display: none; margin-bottom: 10px;"></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
        <div>
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">First Name</label>
          <input type="text" id="drawerEditFirstName" value="${escapeHtml(user.firstName || '')}" style="width: 100%; font-size: 0.82rem; padding: 6px 8px; text-transform: capitalize;" oninput="this.value = this.value.replace(/(?:^|[\\s-])\\S/g, m => m.toUpperCase())">
        </div>
        <div>
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Last Name</label>
          <input type="text" id="drawerEditLastName" value="${escapeHtml(user.lastName || '')}" style="width: 100%; font-size: 0.82rem; padding: 6px 8px; text-transform: capitalize;" oninput="this.value = this.value.replace(/(?:^|[\\s-])\\S/g, m => m.toUpperCase())">
        </div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Username</label>
        <input type="text" id="drawerEditUsername" value="${escapeHtml(user.username || '')}" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;" oninput="this.value = this.value.toLowerCase().replace(/[^a-z0-9-]/g, '')">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Email Address</label>
        <input type="email" id="drawerEditEmail" value="${escapeHtml(user.email || '')}" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Phone Number (Strictly 11 Digits)</label>
        <input type="tel" id="drawerEditPhone" maxlength="11" pattern="\\d{11}" placeholder="08012345678" value="${escapeHtml(user.phone || '')}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11)" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Must be exactly 11 digits (e.g. 08012345678).</div>
      </div>

      <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 10px; margin-bottom: 12px;">
        <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Bank Account Details</div>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Bank Name</label>
          <input type="text" id="drawerEditBankName" value="${escapeHtml(user.bankDetails?.bankName || '')}" placeholder="e.g. Access Bank" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Account Number (10 Digits)</label>
            <input type="text" id="drawerEditAccountNumber" maxlength="10" pattern="\\d{10}" value="${escapeHtml(user.bankDetails?.accountNumber || '')}" placeholder="0123456789" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10)" style="width: 100%; font-size: 0.82rem; padding: 6px 8px;">
          </div>
          <div>
            <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Account Name</label>
            <input type="text" id="drawerEditAccountName" value="${escapeHtml(user.bankDetails?.accountName || '')}" placeholder="Account Holder Full Name" style="width: 100%; font-size: 0.82rem; padding: 6px 8px; text-transform: capitalize;" oninput="this.value = this.value.replace(/(?:^|[\\s-])\\S/g, m => m.toUpperCase())">
          </div>
        </div>
      </div>

      <button type="button" class="btn btn-secondary btn-sm" style="width: 100%;" onclick="handleAdminSaveUserDetails('${user.id}')">
        Save User Details
      </button>
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Recent Task Completions (${submissions.length})</h5>
      ${submissions.length === 0 ? '<div style="font-size: 0.8rem; color: var(--text-muted);">No completed tasks yet.</div>' : `
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto;">
          ${submissions.slice(0, 10).map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
              <div style="min-width: 0; flex: 1; padding-right: 8px;">
                <div style="font-weight: 600; color: var(--primary-blue); cursor: pointer; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" onclick="openEditTaskModal('${s.taskId}')" title="Click to view/edit task">
                  ${escapeHtml(s.taskTitle || 'Task')}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${new Date(s.submittedAt).toLocaleDateString()}</div>
              </div>
              <span class="badge badge-approved">+${s.points} PTS</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div style="margin-top: 20px;">
      ${user.status === 'active' 
        ? `<button class="btn btn-danger btn-block" onclick="handleToggleUserStatus('${user.id}', 'suspended')">Suspend Account</button>`
        : `<button class="btn btn-primary btn-block" onclick="handleToggleUserStatus('${user.id}', 'active')">Reactivate Account</button>`
      }
    </div>
  `;

  document.getElementById('userDrawer').classList.add('open');
}

async function handleAdminRemoveUserAvatar(userId) {
  const confirmed = await window.showCustomConfirm('Are you sure you want to remove this user\'s profile picture?', {
    title: 'Remove Profile Picture',
    confirmText: 'Remove Picture',
    danger: true
  });
  if (!confirmed) return;
  window.TaskEarnDB.updateUser(userId, { avatar: '' });
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  openUserDrawer(userId);
  renderAdminUsers();
}

async function handleAdminResetUserPassword(userId) {
  const input = document.getElementById('drawerNewUserPassword');
  const btn = document.getElementById('btnDrawerSetPassword');
  const newPass = (input?.value || '').trim();
  const alertEl = document.getElementById('drawerPasswordAlert');
  if (!newPass) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please enter a new password for the user.';
      alertEl.style.display = 'block';
    }
    return;
  }

  const originalText = btn ? btn.textContent : 'Set Password';
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    window.TaskEarnDB.updateUser(userId, { password: newPass });
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'User password reset successfully and saved to cloud.';
      alertEl.style.display = 'block';
    }
    if (input) input.value = '';
    setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 3500);
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

async function handleAdminSaveUserDetails(userId) {
  const firstName = (document.getElementById('drawerEditFirstName')?.value || '').trim();
  const lastName = (document.getElementById('drawerEditLastName')?.value || '').trim();
  const username = (document.getElementById('drawerEditUsername')?.value || '').trim();
  const email = (document.getElementById('drawerEditEmail')?.value || '').trim();
  const phone = (document.getElementById('drawerEditPhone')?.value || '').trim();
  const bankName = (document.getElementById('drawerEditBankName')?.value || '').trim();
  const accountNumber = (document.getElementById('drawerEditAccountNumber')?.value || '').trim().replace(/[^0-9]/g, '');
  const accountName = (document.getElementById('drawerEditAccountName')?.value || '').trim();
  const alertEl = document.getElementById('drawerEditAlert');

  if (accountNumber && accountNumber.length !== 10) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Bank account number must be exactly 10 digits (NUBAN).';
      alertEl.style.display = 'block';
    } else {
      await window.showCustomAlert('Bank account number must be exactly 10 digits (NUBAN).', {
        title: 'Invalid Account Number',
        type: 'error'
      });
    }
    return;
  }

  const updates = { firstName, lastName, username, email, phone };
  if (bankName || accountNumber || accountName) {
    updates.bankDetails = {
      bankName: bankName || 'Not Set',
      accountNumber: accountNumber || '',
      accountName: accountName || ''
    };
  }

  try {
    window.TaskEarnDB.updateUser(userId, updates);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    openUserDrawer(userId);
    renderAdminUsers();
    const updatedAlert = document.getElementById('drawerEditAlert');
    if (updatedAlert) {
      updatedAlert.className = 'alert alert-success';
      updatedAlert.textContent = 'User details and bank info updated successfully.';
      updatedAlert.style.display = 'block';
      setTimeout(() => { if (updatedAlert) updatedAlert.style.display = 'none'; }, 3500);
    }
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } else {
      await window.showCustomAlert(err.message, {
        title: 'Error',
        type: 'error'
      });
    }
  }
}

async function handleToggleUserVerification(userId, newVerifiedState) {
  window.TaskEarnDB.setVerificationStatus(userId, newVerifiedState);
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  openUserDrawer(userId);
  renderAdminUsers();

  renderOverviewStats();
}

function closeUserDrawer() {
  document.getElementById('userDrawer').classList.remove('open');
  try {
    localStorage.removeItem('taskearn_admin_active_drawer_user');
  } catch (e) {}
}

async function handleDrawerPointsAdjustment(userId) {
  const poolSelect = document.getElementById('drawerAdjustPoolSelect');
  const targetPool = poolSelect ? poolSelect.value : 'task';
  const input = document.getElementById('drawerAdjustPointsInput');
  const delta = Number(input?.value);
  if (!delta || isNaN(delta)) return;

  const user = window.TaskEarnDB.getUserById(userId);
  if (!user) return;

  let taskBal = Number(user.taskPointsBalance) || 0;
  let refBal = Number(user.referralPointsBalance) || 0;

  if (targetPool === 'referral') {
    refBal = Math.max(0, refBal + delta);
  } else {
    taskBal = Math.max(0, taskBal + delta);
  }
  const newTotalBal = taskBal + refBal;

  window.TaskEarnDB.updateUser(userId, {
    taskPointsBalance: taskBal,
    referralPointsBalance: refBal,
    pointsBalance: newTotalBal
  });

  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  await window.showCustomAlert(`User ${targetPool} balance updated. Total balance is now ${newTotalBal.toLocaleString()} PTS`, {
    title: 'Balance Updated',
    type: 'success'
  });
  openUserDrawer(userId);
  renderOverviewStats();
  renderAdminUsers();
}

async function handleToggleUserStatus(userId, newStatus) {
  const confirmed = await window.showCustomConfirm(`Are you sure you want to change user status to ${newStatus.toUpperCase()}?`, {
    title: 'Change User Status',
    confirmText: 'Change Status',
    danger: newStatus === 'banned' || newStatus === 'suspended'
  });
  if (!confirmed) return;
  window.TaskEarnDB.updateUser(userId, { status: newStatus });
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  openUserDrawer(userId);
  renderAdminUsers();
}

// =================== TAB 2: TASKS LIST & DWELL VERIFICATION ===================

function formatDwellTime(totalSeconds) {
  const s = Number(totalSeconds) || 0;
  if (s <= 0) return '0s Dwell';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ') + ' Dwell';
}
window.formatDwellTime = formatDwellTime;

function updateCreateTaskDwellSummary() {
  const h = Math.max(0, parseInt(document.getElementById('taskDwellHours')?.value || '0', 10) || 0);
  const m = Math.max(0, parseInt(document.getElementById('taskDwellMinutes')?.value || '0', 10) || 0);
  const s = Math.max(0, parseInt(document.getElementById('taskDwellSeconds')?.value || '0', 10) || 0);
  const total = (h * 3600) + (m * 60) + s;
  const summaryEl = document.getElementById('taskDwellSummary');
  if (summaryEl) {
    const parts = [];
    if (h > 0) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} min${m > 1 ? 's' : ''}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} sec`);
    summaryEl.textContent = `Total: ${parts.join(' ')} (${total}s) - Invisible timer verification for users.`;
  }
}
window.updateCreateTaskDwellSummary = updateCreateTaskDwellSummary;

function updateEditTaskDwellSummary() {
  const h = Math.max(0, parseInt(document.getElementById('editTaskDwellHours')?.value || '0', 10) || 0);
  const m = Math.max(0, parseInt(document.getElementById('editTaskDwellMinutes')?.value || '0', 10) || 0);
  const s = Math.max(0, parseInt(document.getElementById('editTaskDwellSeconds')?.value || '0', 10) || 0);
  const total = (h * 3600) + (m * 60) + s;
  const summaryEl = document.getElementById('editTaskDwellSummary');
  if (summaryEl) {
    const parts = [];
    if (h > 0) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} min${m > 1 ? 's' : ''}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} sec`);
    summaryEl.textContent = `Total: ${parts.join(' ')} (${total}s) - Invisible verification timer for users.`;
  }
}
window.updateEditTaskDwellSummary = updateEditTaskDwellSummary;

function renderAdminTasks() {
  const tasks = window.TaskEarnDB.getTasks();
  const query = (document.getElementById('admTaskSearchInput')?.value || '').toLowerCase();
  const catFilter = document.getElementById('admTaskCategoryFilter')?.value || 'all';
  const statusFilter = document.getElementById('admTaskStatusFilter')?.value || 'all';
  const sortFilter = document.getElementById('admTaskSortFilter')?.value || 'newest';

  let filtered = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  if (sortFilter === 'reward-desc') {
    filtered.sort((a, b) => b.points - a.points);
  } else if (sortFilter === 'completions-desc') {
    filtered.sort((a, b) => (b.completionsCount || 0) - (a.completionsCount || 0));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const tbody = document.getElementById('admTasksTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No tasks found matching criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const isHidden = t.status === 'hidden';
    return `
      <tr>
        <td>
          <div style="font-weight: 700; cursor: pointer; color: var(--text-main);" onclick="openEditTaskModal('${t.id}')" title="Click to edit task">${escapeHtml(t.title)}</div>
          <a href="${t.targetUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; color: var(--primary-green-dark);">
            ${escapeHtml(t.targetUrl.substring(0, 36))}...
          </a>
        </td>
        <td><span class="badge badge-active">${escapeHtml(t.category)}</span></td>
        <td><strong>${t.points} PTS</strong></td>
        <td><span class="badge badge-approved">${formatDwellTime(t.timerSeconds || 15)}</span></td>
        <td>${t.completionsCount || 0} / ${t.maxCompletions}</td>
        <td>
          <span class="badge ${isHidden ? 'badge-hidden' : 'badge-approved'}">
            ${t.status.toUpperCase()}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="openEditTaskModal('${t.id}')">
              Edit
            </button>
            <button class="btn btn-secondary btn-sm" onclick="toggleTaskVisibility('${t.id}')">
              ${isHidden ? 'Unhide' : 'Hide'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="handleDeleteTask('${t.id}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleTaskVisibility(taskId) {
  const task = window.TaskEarnDB.getTaskById(taskId);
  if (!task) return;
  const nextStatus = task.status === 'hidden' ? 'active' : 'hidden';
  window.TaskEarnDB.updateTask(taskId, { status: nextStatus });
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  renderAdminTasks();
}

async function handleDeleteTask(taskId) {
  const confirmed = await window.showCustomConfirm('Are you sure you want to delete this task campaign?', {
    title: 'Delete Campaign',
    confirmText: 'Delete Campaign',
    danger: true
  });
  if (!confirmed) return;
  window.TaskEarnDB.deleteTask(taskId);
  if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
    await window.TaskEarnDB.pushToCloud();
  }
  renderAdminTasks();
}

function openEditTaskModal(taskId) {
  const task = window.TaskEarnDB.getTaskById(taskId);
  if (!task) {
    if (typeof showToast === 'function') {
      showToast('Task details not found (campaign may have been deleted)', 'warning');
    }
    return;
  }

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskPoints').value = task.points;
  document.getElementById('editTaskUrl').value = task.targetUrl;
  
  const totalSec = task.timerSeconds || 15;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (document.getElementById('editTaskDwellHours')) document.getElementById('editTaskDwellHours').value = hours;
  if (document.getElementById('editTaskDwellMinutes')) document.getElementById('editTaskDwellMinutes').value = minutes;
  if (document.getElementById('editTaskDwellSeconds')) document.getElementById('editTaskDwellSeconds').value = seconds;
  updateEditTaskDwellSummary();

  document.getElementById('editTaskStatus').value = task.status;
  if (window.TaskEarnModalSelect) {
    window.TaskEarnModalSelect.sync('editTaskStatus');
  }
  document.getElementById('editTaskDesc').value = task.description;

  document.getElementById('editTaskModal').classList.add('open');
}

function closeEditTaskModal() {
  document.getElementById('editTaskModal').classList.remove('open');
}

async function handleSaveTaskEdit(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Save Changes';

  const id = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value;
  const points = Number(document.getElementById('editTaskPoints').value);
  const targetUrl = document.getElementById('editTaskUrl').value;
  
  const dwellH = Math.max(0, parseInt(document.getElementById('editTaskDwellHours')?.value || '0', 10) || 0);
  const dwellM = Math.max(0, parseInt(document.getElementById('editTaskDwellMinutes')?.value || '0', 10) || 0);
  const dwellS = Math.max(0, parseInt(document.getElementById('editTaskDwellSeconds')?.value || '0', 10) || 0);
  let timerSeconds = (dwellH * 3600) + (dwellM * 60) + dwellS;
  if (timerSeconds < 5) timerSeconds = 5;

  const status = document.getElementById('editTaskStatus').value;
  const description = document.getElementById('editTaskDesc').value;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving & Syncing...';
    }

    window.TaskEarnDB.updateTask(id, { title, points, targetUrl, timerSeconds, status, description });
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    closeEditTaskModal();
    renderAdminTasks();
  } catch (err) {
    await window.showCustomAlert('Error saving task: ' + err.message, {
      title: 'Update Failed',
      type: 'error'
    });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}

// =================== TAB 3: CREATE TASK (+) ===================

function updateCreateTaskNairaPreview() {
  const ptsInput = document.getElementById('taskPoints');
  const preview = document.getElementById('createTaskNairaPreview');
  const pts = Number(ptsInput?.value) || 0;
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;
  if (preview) {
    preview.textContent = `Equiv: ₦${(pts * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }
}

document.getElementById('taskPoints')?.addEventListener('input', updateCreateTaskNairaPreview);

let isSubmittingCreateTask = false;

async function handleCreateTaskSubmit(event) {
  event.preventDefault();
  if (isSubmittingCreateTask) return;

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Publish Task';

  isSubmittingCreateTask = true;

  const title = (document.getElementById('taskTitle')?.value || '').trim();
  const category = document.getElementById('taskCategory')?.value || 'Website';
  const points = Number(document.getElementById('taskPoints')?.value);
  const targetUrl = (document.getElementById('taskTargetUrl')?.value || '').trim();
  const dwellH = Math.max(0, parseInt(document.getElementById('taskDwellHours')?.value || '0', 10) || 0);
  const dwellM = Math.max(0, parseInt(document.getElementById('taskDwellMinutes')?.value || '0', 10) || 0);
  const dwellS = Math.max(0, parseInt(document.getElementById('taskDwellSeconds')?.value || '0', 10) || 0);
  let timerSeconds = (dwellH * 3600) + (dwellM * 60) + dwellS;
  if (timerSeconds < 5) timerSeconds = 5;
  const maxCompletions = Number(document.getElementById('taskMaxCompletions')?.value) || 1000;
  const description = (document.getElementById('taskDescription')?.value || '').trim();
  const alertEl = document.getElementById('createTaskAlert');

  if (!title || !targetUrl || !points || !description) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please fill in all required task fields.';
      alertEl.style.display = 'block';
    }
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publishing & Syncing to Cloud...';
    }

    if (alertEl) {
      alertEl.className = 'alert alert-info';
      alertEl.textContent = 'Synchronizing with Supabase cloud...';
      alertEl.style.display = 'block';
    }

    // 1. Pull latest cloud data before adding to prevent overwriting concurrent state
    if (window.TaskEarnDB && window.TaskEarnDB.pullFromCloud) {
      await window.TaskEarnDB.pullFromCloud(true);
    }

    // 2. Create the task in local cache
    window.TaskEarnDB.createTask({
      title,
      category,
      points,
      targetUrl,
      timerSeconds,
      maxCompletions,
      description
    });

    // 3. Immediately push the updated database to Supabase cloud
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Task published successfully and synced to cloud across all devices!';
      alertEl.style.display = 'block';
    }

    form.reset();
    if (window.TaskEarnModalSelect) {
      window.TaskEarnModalSelect.sync('taskCategory');
    }
    updateCreateTaskNairaPreview();
    updateCreateTaskDwellSummary();

    setTimeout(() => {
      if (alertEl) alertEl.style.display = 'none';
      switchAdminTab('tasks');
    }, 1200);

  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Failed to publish task: ' + err.message;
      alertEl.style.display = 'block';
    }
  } finally {
    isSubmittingCreateTask = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}

// =================== TAB 4: FINANCIALS & PAYOUTS ===================

function loadFinancialSettings(force = false) {
  // If the admin is actively typing into the settings form, do NOT overwrite their inputs
  const activeEl = document.activeElement;
  const financialForm = document.getElementById('financialSettingsForm');
  if (!force && financialForm && activeEl && financialForm.contains(activeEl)) {
    return;
  }

  const settings = window.TaskEarnDB.getSettings();
  const pointRateInput = document.getElementById('settingPointRate');
  if (pointRateInput) pointRateInput.value = settings.pointRateNaira;

  const referralPointsInput = document.getElementById('settingReferralPoints');
  if (referralPointsInput) referralPointsInput.value = settings.referralPoints;

  const minTaskInput = document.getElementById('settingMinTaskWithdrawal');
  if (minTaskInput) minTaskInput.value = settings.minTaskWithdrawalNaira ?? 10000;

  const minRefInput = document.getElementById('settingMinReferralWithdrawal');
  if (minRefInput) minRefInput.value = settings.minReferralWithdrawalNaira ?? 1000;

  // Fallback if legacy input exists
  const minWithdrawalInput = document.getElementById('settingMinWithdrawal');
  if (minWithdrawalInput) minWithdrawalInput.value = settings.minTaskWithdrawalNaira || settings.minWithdrawalNaira || 10000;

  const verificationFeeInput = document.getElementById('settingVerificationFee');
  if (verificationFeeInput) verificationFeeInput.value = settings.verificationFeeNaira ?? 3000;

  const paystackKeyInput = document.getElementById('settingPaystackKey');
  if (paystackKeyInput) paystackKeyInput.value = settings.paystackPublicKey || 'pk_live_7ad543047c70c866ded395106782bf387c9fff6f';

  const paystackSecretInput = document.getElementById('settingPaystackSecretKey');
  if (paystackSecretInput) paystackSecretInput.value = settings.paystackSecretKey || (window.TaskEarnDB && window.TaskEarnDB.getSettings().paystackSecretKey) || '';

  const adminPhoneInput = document.getElementById('settingAdminPhone');
  if (adminPhoneInput) adminPhoneInput.value = settings.adminPhone || '08012345678';

  const adminEmailInput = document.getElementById('settingAdminEmail');
  if (adminEmailInput) adminEmailInput.value = settings.adminEmail || 'admin@taskearn.com';
}

async function handleSaveFinancialSettings(event) {
  event.preventDefault();
  const pointRateNaira = parseFloat(document.getElementById('settingPointRate')?.value);
  const referralPoints = parseInt(document.getElementById('settingReferralPoints')?.value, 10);
  const minTaskWithdrawalNaira = parseFloat(document.getElementById('settingMinTaskWithdrawal')?.value || document.getElementById('settingMinWithdrawal')?.value);
  const minReferralWithdrawalNaira = parseFloat(document.getElementById('settingMinReferralWithdrawal')?.value || '1000');
  const verificationFeeNaira = parseFloat(document.getElementById('settingVerificationFee')?.value);
  const paystackPublicKey = (document.getElementById('settingPaystackKey')?.value || '').trim();
  const paystackSecretKey = (document.getElementById('settingPaystackSecretKey')?.value || '').trim();
  const adminPhoneInput = (document.getElementById('settingAdminPhone')?.value || '').trim();
  const adminEmailInput = (document.getElementById('settingAdminEmail')?.value || '').trim();
  const alertEl = document.getElementById('financialSettingsAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const origText = btn ? btn.textContent : '';

  if (isNaN(pointRateNaira) || pointRateNaira <= 0) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please enter a valid Point to Naira rate (must be greater than 0).';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (isNaN(referralPoints) || referralPoints < 0) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Referral points reward must be 0 or greater.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (isNaN(minTaskWithdrawalNaira) || minTaskWithdrawalNaira < 100) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Minimum task withdrawal amount must be at least ₦100.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (isNaN(minReferralWithdrawalNaira) || minReferralWithdrawalNaira < 100) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Minimum referral withdrawal amount must be at least ₦100.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (isNaN(verificationFeeNaira) || verificationFeeNaira < 0) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Account verification fee must be 0 or greater.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (!paystackPublicKey) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Paystack public key is required.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (!paystackSecretKey) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Paystack secret key is required for automated payouts.';
      alertEl.style.display = 'block';
    }
    return;
  }

  let adminPhone = '';
  if (adminPhoneInput) {
    const cleanAdminPhone = adminPhoneInput.replace(/[\s-]/g, '');
    if (!/^\d{11}$/.test(cleanAdminPhone)) {
      if (alertEl) {
        alertEl.className = 'alert alert-error';
        alertEl.textContent = 'Admin support phone number must be exactly 11 digits (e.g. 08012345678).';
        alertEl.style.display = 'block';
      }
      return;
    }
    adminPhone = cleanAdminPhone;
  }

  if (adminEmailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmailInput)) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Please enter a valid administrator email address.';
      alertEl.style.display = 'block';
    }
    return;
  }

  const updates = {
    pointRateNaira,
    referralPoints,
    minTaskWithdrawalNaira,
    minReferralWithdrawalNaira,
    minWithdrawalNaira: minTaskWithdrawalNaira,
    verificationFeeNaira,
    paystackPublicKey,
    paystackSecretKey,
    adminPhone,
    adminEmail: adminEmailInput
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving settings...';
    }

    window.TaskEarnDB.updateSettings(updates);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Settings and administrative contact info updated successfully and saved to cloud!';
      alertEl.style.display = 'block';
      setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 3000);
    }

    renderOverviewStats();
    renderPayInRecords();
    renderWithdrawalsQueue();
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

async function handleAdminPasswordChange(event) {
  event.preventDefault();
  const currentPass = document.getElementById('adminCurrentPass').value;
  const newPass = document.getElementById('adminNewPass').value;
  const confirmPass = document.getElementById('adminConfirmPass').value;
  const alertEl = document.getElementById('adminPasswordAlert');
  const btn = event.target.querySelector('button[type="submit"]');
  const origText = btn ? btn.textContent : '';

  const settings = window.TaskEarnDB.getSettings();
  const validPassword = settings.adminPassword || 'admin123';

  if (currentPass !== validPassword) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Current administrator password is incorrect. Please try again.';
    alertEl.style.display = 'block';
    return;
  }

  if (newPass === currentPass) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'New admin password cannot be identical to your current password.';
    alertEl.style.display = 'block';
    return;
  }

  if (newPass !== confirmPass) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'New passwords do not match. Please re-enter carefully.';
    alertEl.style.display = 'block';
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating admin password...';
    }

    window.TaskEarnDB.validatePassword(newPass);

    window.TaskEarnDB.updateSettings({ adminPassword: newPass });
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Administrator password changed successfully and saved to cloud!';
    alertEl.style.display = 'block';

    document.getElementById('adminPasswordForm').reset();
    if (window.checkPasswordCriteria) {
      window.checkPasswordCriteria('', 'adminNewPassCriteria');
    }
    setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 4000);
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// =================== PAY-IN RECORDS (VERIFICATION REVENUE) ===================

function createPayInRowHtml(p, uObj) {
  return `
    <tr>
      <td style="white-space: nowrap;">
        <div style="font-weight: 600;">${new Date(p.createdAt).toLocaleDateString()}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openUserDrawer('${p.userId}')" title="Click to view user profile">
          <div style="width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; overflow: hidden; flex-shrink: 0;">
            ${uObj?.avatar ? `<img src="${uObj.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (p.userName ? p.userName[0].toUpperCase() : 'U')}
          </div>
          <div>
            <div style="font-weight: 700; color: var(--text-main);">
              ${escapeHtml(p.userName || 'User')}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(p.userEmail || '')}</div>
          </div>
        </div>
      </td>
      <td>
        <strong style="color: var(--primary-green-dark); font-size: 0.95rem;">
          ₦${Number(p.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </strong>
      </td>
      <td>
        <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">
          ${escapeHtml(p.gateway || 'Paystack')}
        </span>
      </td>
      <td>
        <span style="font-family: monospace; font-size: 0.8rem; background-color: var(--bg-subtle); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">
          ${escapeHtml(p.reference || 'N/A')}
        </span>
      </td>
      <td>
        <span class="badge ${p.status === 'successful' ? 'badge-approved' : 'badge-pending'}">
          ${p.status.toUpperCase()}
        </span>
      </td>
    </tr>
  `;
}

// Pay-In Records (Both Financial Preview & Full Screen)
function renderPayInRecords() {
  const payments = window.TaskEarnDB.getPayments();
  const allUsers = window.TaskEarnDB.getUsers();
  const userMap = {};
  allUsers.forEach(u => { userMap[u.id] = u; });

  const searchInput = document.getElementById('admPayInSearchInputFull') || document.getElementById('admPayInSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = payments.filter(p => {
    if (!query) return true;
    return (p.userName || '').toLowerCase().includes(query) ||
           (p.userEmail || '').toLowerCase().includes(query) ||
           (p.reference || '').toLowerCase().includes(query) ||
           (p.gateway || '').toLowerCase().includes(query);
  });

  const totalPayIn = payments
    .filter(p => p.status === 'successful')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const badgeEl = document.getElementById('totalPayInBadge');
  if (badgeEl) {
    badgeEl.textContent = `Total: ₦${totalPayIn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }
  const fullBadgeEl = document.getElementById('fullPayInTotalBadge');
  if (fullBadgeEl) {
    fullBadgeEl.textContent = `Total: ₦${totalPayIn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  const financeBody = document.getElementById('admPayInTableBodyFinance') || document.getElementById('admPayInTableBody');
  const fullBody = document.getElementById('admPayInTableBodyFull');

  const emptyMsg = `
    <tr>
      <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
        ${query ? 'No pay-in records match your search.' : 'No pay-in transactions recorded yet.'}
      </td>
    </tr>
  `;

  if (filtered.length === 0) {
    if (financeBody) financeBody.innerHTML = emptyMsg;
    if (fullBody) fullBody.innerHTML = emptyMsg;
    return;
  }

  if (financeBody) {
    financeBody.innerHTML = filtered.map(p => createPayInRowHtml(p, userMap[p.userId])).join('');
  }
  if (fullBody) {
    fullBody.innerHTML = filtered.map(p => createPayInRowHtml(p, userMap[p.userId])).join('');
  }
}

function createPendingWithdrawalRowHtml(w, uObj, showSource = true) {
  const isRef = (w.withdrawalType === 'referral');
  return `
    <tr>
      <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openUserDrawer('${w.userId}')" title="Click to view user profile">
          <div style="width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; overflow: hidden; flex-shrink: 0;">
            ${uObj?.avatar ? `<img src="${uObj.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (w.userName ? w.userName[0].toUpperCase() : 'U')}
          </div>
          <div>
            <strong style="color: var(--text-main);">${escapeHtml(w.userName)}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">User ID: ${w.userId}</div>
          </div>
        </div>
      </td>
      ${showSource ? `
      <td>
        <span class="badge ${isRef ? 'badge-approved' : 'badge-active'}" style="font-size: 0.72rem;">
          ${isRef ? 'Referral' : 'Task'}
        </span>
      </td>` : ''}
      <td><strong>${w.points.toLocaleString()} PTS</strong></td>
      <td><strong style="color: var(--primary-green-dark); font-size: 1.05rem;">₦${w.amountNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></td>
      <td>
        <div style="font-weight: 700;">${escapeHtml(w.bankName)}</div>
        <div style="font-size: 0.85rem; letter-spacing: 0.04em;">${escapeHtml(w.accountNumber)} &bull; ${escapeHtml(w.accountName)}</div>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-primary btn-sm" onclick="handleReviewWithdrawal('${w.id}', 'approved')">
            Approve Payout
          </button>
          <button class="btn btn-danger btn-sm" onclick="handleReviewWithdrawal('${w.id}', 'declined')">
            Decline & Refund
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Comprehensive Nigerian Bank Codes Map for Paystack Transfers API
const PAYSTACK_BANK_CODES = {
  // Commercial Banks & Common Names
  "access bank": "044",
  "access bank (diamond)": "063",
  "citibank nigeria": "023",
  "citibank": "023",
  "ecobank nigeria": "050",
  "ecobank": "050",
  "fidelity bank": "070",
  "fidelity": "070",
  "first bank of nigeria": "011",
  "first bank": "011",
  "first city monument bank (fcmb)": "214",
  "first city monument bank": "214",
  "fcmb": "214",
  "globus bank": "00103",
  "guaranty trust bank (gtbank)": "058",
  "guaranty trust bank": "058",
  "gtbank": "058",
  "gt bank": "058",
  "heritage bank": "030",
  "jaiz bank": "301",
  "keystone bank": "082",
  "lotus bank": "303",
  "optimum bank": "107",
  "optimus bank": "107",
  "optimus bank limited": "107",
  "parallex bank": "104",
  "polaris bank": "076",
  "premiumtrust bank": "105",
  "providus bank": "101",
  "providusunity bank": "215",
  "signature bank": "106",
  "signature bank ltd": "106",
  "stanbic ibtc bank": "221",
  "stanbic": "221",
  "standard chartered bank nigeria": "068",
  "standard chartered bank": "068",
  "standard chartered": "068",
  "sterling bank": "232",
  "summit bank": "00305",
  "suntrust bank": "100",
  "tajbank": "302",
  "taj bank": "302",
  "tatum bank": "109",
  "the alternative bank": "000304",
  "alternative bank": "000304",
  "titan bank": "102",
  "titan trust bank": "102",
  "union bank of nigeria": "032",
  "union bank": "032",
  "united bank for africa (uba)": "033",
  "united bank for africa": "033",
  "uba": "033",
  "unity bank": "215",
  "wema bank": "035",
  "alat by wema": "035A",
  "zenith bank": "057",
  "zenith": "057",

  // Fintechs, Digital Banks & PSBs
  "opay": "999992",
  "opay digital services limited (opay)": "999992",
  "palmpay": "999991",
  "kuda": "50211",
  "kuda bank": "50211",
  "kuda microfinance bank": "50211",
  "moniepoint": "50515",
  "moniepoint mfb": "50515",
  "moniepoint microfinance bank": "50515",
  "carbon": "565",
  "fairmoney": "51318",
  "fairmoney microfinance bank": "51318",
  "gomoney (sterling mfb)": "100022",
  "gomoney": "100022",
  "rubies bank": "125",
  "rubies mfb": "125",
  "sparkle": "51310",
  "sparkle microfinance bank": "51310",
  "vfd microfinance bank": "566",
  "vfd mfb": "566",
  "vfd": "566",
  "dot microfinance bank": "50162",
  "dot mfb": "50162",
  "eyowo microfinance bank": "50126",
  "eyowo": "50126",
  "mintyn": "50304",
  "9 payment service bank (9psb)": "120001",
  "9psb": "120001",
  "9mobile 9payment service bank": "120001",
  "hope payment service bank": "120002",
  "hopepsb": "120002",
  "momo psb": "120003",
  "mtn momo psb": "120003",
  "smartcash psb": "120004",
  "airtel smartcash psb": "120004",
  "moneymaster psb": "120005",

  // Microfinance, Mortgage & Specialized Institutions
  "abbey mortgage bank": "404",
  "ab microfinance bank": "51204",
  "accion microfinance bank": "602",
  "alpha morgan bank": "108",
  "aso savings and loans": "401",
  "bank of agriculture (boa)": "90367",
  "bank of industry (boi)": "90367",
  "baobab microfinance bank": "MFB50992",
  "branch microfinance bank": "FC40163",
  "brent mortgage bank": "90070",
  "coronation merchant bank": "559",
  "fbnquest merchant bank": "560",
  "greenwich merchant bank": "562",
  "infinity trust mortgage bank": "402",
  "livingtrust mortgage bank": "031",
  "living trust mortgage bank": "031",
  "nova commercial bank": "561",
  "nownow digital systems (nownow mfb)": "50315",
  "npf microfinance bank": "50629",
  "rand merchant bank nigeria (rmb)": "502",
  "raven bank (raven mfb)": "50315",
  "renmoney microfinance bank": "51049"
};

let _paystackBanksCache = null;

async function resolvePaystackBankCode(rawBankName, secretKey) {
  if (!rawBankName) return null;
  const clean = rawBankName.trim().toLowerCase();

  // 1. Exact match in dictionary
  if (PAYSTACK_BANK_CODES[clean]) {
    return PAYSTACK_BANK_CODES[clean];
  }

  // 2. Simplified match (strip 'bank', 'microfinance', 'mfb', brackets)
  const simplified = clean
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(bank|microfinance|mfb|ltd|limited|plc|systems)\b/g, '')
    .trim();

  if (simplified && PAYSTACK_BANK_CODES[simplified]) {
    return PAYSTACK_BANK_CODES[simplified];
  }

  for (const [key, code] of Object.entries(PAYSTACK_BANK_CODES)) {
    if (key.includes(simplified) || (simplified && simplified.includes(key))) {
      return code;
    }
  }

  // 3. Dynamic lookup against Paystack API
  try {
    if (!_paystackBanksCache && secretKey) {
      const res = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=500', {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      const json = await res.json();
      if (json && json.status && Array.isArray(json.data)) {
        _paystackBanksCache = json.data;
      }
    }

    if (Array.isArray(_paystackBanksCache)) {
      const found = _paystackBanksCache.find(b => {
        const bName = (b.name || '').toLowerCase();
        const bSlug = (b.slug || '').toLowerCase();
        return bName === clean || bSlug === clean || (simplified && (bName.includes(simplified) || simplified.includes(bName)));
      });
      if (found && found.code) {
        return found.code;
      }
    }
  } catch (err) {
    console.warn('Dynamic Paystack bank code lookup error:', err);
  }

  return null;
}

function createCompletedWithdrawalRowHtml(w, uObj) {
  const isApproved = w.status === 'approved';
  const isRef = (w.withdrawalType === 'referral');
  const paystackRef = w.paystackTransfer?.reference || w.paystackReference || '';
  const gateway = w.paystackTransfer?.gateway || (paystackRef ? 'Paystack Debit' : (isApproved ? 'Manual Transfer' : ''));

  return `
    <tr>
      <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openUserDrawer('${w.userId}')" title="Click to view user profile">
          <div style="width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; overflow: hidden; flex-shrink: 0;">
            ${uObj?.avatar ? `<img src="${uObj.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (w.userName ? w.userName[0].toUpperCase() : 'U')}
          </div>
          <div>
            <strong style="color: var(--text-main);">${escapeHtml(w.userName)}</strong>
            <div style="font-size: 0.76rem; color: var(--text-muted);">User ID: ${w.userId}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${isRef ? 'badge-approved' : 'badge-active'}" style="font-size: 0.72rem;">
          ${isRef ? 'Referral' : 'Task'}
        </span>
      </td>
      <td><strong>₦${w.amountNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></td>
      <td>
        <div>${escapeHtml(w.bankName)} &bull; ${escapeHtml(w.accountNumber)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.accountName || '')}</div>
      </td>
      <td>
        <span class="badge ${isApproved ? 'badge-approved' : 'badge-declined'}">
          ${w.status.toUpperCase()}
        </span>
        ${gateway ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">Via: ${escapeHtml(gateway)}</div>` : ''}
        ${paystackRef ? `<div style="font-size: 0.72rem; font-family: monospace; color: var(--primary-blue); margin-top: 2px;" title="Paystack Transfer Ref: ${escapeHtml(paystackRef)}">Ref: ${escapeHtml(paystackRef)}</div>` : ''}
        ${w.declineReason ? `<div style="font-size: 0.75rem; color: #991b1b; margin-top: 3px;">Reason: ${escapeHtml(w.declineReason)}</div>` : ''}
      </td>
      <td>${w.processedAt ? new Date(w.processedAt).toLocaleDateString() : 'N/A'}</td>
    </tr>
  `;
}

let activeAdminFinanceWithdrawalFilter = 'all';

function setAdminFinanceWithdrawalFilter(filterType) {
  activeAdminFinanceWithdrawalFilter = filterType || 'all';
  const btnAll = document.getElementById('btnAdmFinanceWdrFilterAll');
  const btnTask = document.getElementById('btnAdmFinanceWdrFilterTask');
  const btnRef = document.getElementById('btnAdmFinanceWdrFilterReferral');

  if (btnAll) btnAll.className = activeAdminFinanceWithdrawalFilter === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  if (btnTask) btnTask.className = activeAdminFinanceWithdrawalFilter === 'task' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  if (btnRef) btnRef.className = activeAdminFinanceWithdrawalFilter === 'referral' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

  renderWithdrawalsQueue();
}
window.setAdminFinanceWithdrawalFilter = setAdminFinanceWithdrawalFilter;

// Withdrawals Queue & Completed Logs (Both Financial Preview & Full Screen)
function renderWithdrawalsQueue() {
  const withdrawals = window.TaskEarnDB.getWithdrawals();
  const allUsers = window.TaskEarnDB.getUsers();
  const userMap = {};
  allUsers.forEach(u => { userMap[u.id] = u; });

  const pending = withdrawals.filter(w => w.status === 'pending');
  const completed = withdrawals.filter(w => w.status !== 'pending');

  const pendingTask = pending.filter(w => (w.withdrawalType || 'task') === 'task');
  const pendingReferral = pending.filter(w => w.withdrawalType === 'referral');

  const pendingBadge = document.getElementById('pendingWithdrawalsBadge');
  if (pendingBadge) {
    pendingBadge.textContent = `${pending.length} Pending`;
  }

  const taskBadge = document.getElementById('pendingTaskWithdrawalsBadge');
  if (taskBadge) taskBadge.textContent = `${pendingTask.length} Pending`;

  const refBadge = document.getElementById('pendingRefWithdrawalsBadge');
  if (refBadge) refBadge.textContent = `${pendingReferral.length} Pending`;

  const hubTaskBadge = document.getElementById('hubTaskPendingBadge');
  if (hubTaskBadge) hubTaskBadge.textContent = `${pendingTask.length} Task Pending`;

  const hubRefBadge = document.getElementById('hubRefPendingBadge');
  if (hubRefBadge) hubRefBadge.textContent = `${pendingReferral.length} Ref Pending`;

  const fullPendingBadge = document.getElementById('fullPendingTotalBadge');
  const fullLogsBadge = document.getElementById('fullLogsTotalBadge');

  const statPendingCount = document.getElementById('statPendingWithdrawalsCount');
  if (statPendingCount) statPendingCount.textContent = `${pending.length} pending (${pendingTask.length} Task, ${pendingReferral.length} Ref)`;

  // Dedicated Card 1: Task Withdrawals Preview Table
  const taskTbody = document.getElementById('admPendingTaskWithdrawalsBodyFinance');
  if (taskTbody) {
    if (pendingTask.length === 0) {
      taskTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No pending task withdrawal requests. All task payouts are cleared!
          </td>
        </tr>
      `;
    } else {
      taskTbody.innerHTML = pendingTask.map(w => createPendingWithdrawalRowHtml(w, userMap[w.userId], false)).join('');
    }
  }

  // Dedicated Card 2: Referral Withdrawals Preview Table
  const refTbody = document.getElementById('admPendingRefWithdrawalsBodyFinance');
  if (refTbody) {
    if (pendingReferral.length === 0) {
      refTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No pending referral withdrawal requests. All referral payouts are cleared!
          </td>
        </tr>
      `;
    } else {
      refTbody.innerHTML = pendingReferral.map(w => createPendingWithdrawalRowHtml(w, userMap[w.userId], false)).join('');
    }
  }

  // Full pending subpage with search & type filter
  const fullPendingBody = document.getElementById('admPendingWithdrawalsBodyFull');
  if (fullPendingBody) {
    const pendingSearchInput = document.getElementById('admPendingWithdrawalsSearchInputFull');
    const typeFilterSelect = document.getElementById('admPendingWithdrawalsTypeFilterFull');
    const selectedType = typeFilterSelect?.value || 'all';
    const pendingQuery = (pendingSearchInput?.value || '').toLowerCase().trim();
    
    let filteredPending = pending;
    if (selectedType === 'task') {
      filteredPending = pending.filter(w => (w.withdrawalType || 'task') === 'task');
    } else if (selectedType === 'referral') {
      filteredPending = pending.filter(w => w.withdrawalType === 'referral');
    }

    if (pendingQuery) {
      filteredPending = filteredPending.filter(w => {
        const u = userMap[w.userId];
        const userName = (w.userName || (u ? `${u.firstName || ''} ${u.lastName || ''} ${u.username || ''}` : '')).toLowerCase();
        const userId = (w.userId || '').toLowerCase();
        const bankName = (w.bankName || '').toLowerCase();
        const accNum = (w.accountNumber || '').toLowerCase();
        const accName = (w.accountName || '').toLowerCase();
        const typeStr = (w.withdrawalType || 'task').toLowerCase();
        const amount = String(w.amountNaira || '');
        const points = String(w.points || '');
        return userName.includes(pendingQuery) || userId.includes(pendingQuery) || bankName.includes(pendingQuery) || accNum.includes(pendingQuery) || accName.includes(pendingQuery) || amount.includes(pendingQuery) || points.includes(pendingQuery) || typeStr.includes(pendingQuery);
      });
    }

    if (fullPendingBadge) {
      fullPendingBadge.textContent = (pendingQuery || selectedType !== 'all') 
        ? `${filteredPending.length} of ${pending.length} Found`
        : `${pending.length} Pending`;
    }

    if (filteredPending.length === 0) {
      fullPendingBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">
            ${pendingQuery ? 'No pending withdrawal requests match your search.' : 'No pending withdrawal requests found.'}
          </td>
        </tr>
      `;
    } else {
      fullPendingBody.innerHTML = filteredPending.map(w => createPendingWithdrawalRowHtml(w, userMap[w.userId], true)).join('');
    }
  }

  const financeCompletedBody = document.getElementById('admCompletedWithdrawalsBodyFinance') || document.getElementById('admCompletedWithdrawalsBody');
  const fullCompletedBody = document.getElementById('admCompletedWithdrawalsBodyFull');

  const emptyCompletedMsg = `
    <tr>
      <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
        No completed transactions in history.
      </td>
    </tr>
  `;

  // Financial preview tab (scrollable within max 5 items height)
  if (financeCompletedBody) {
    if (completed.length === 0) {
      financeCompletedBody.innerHTML = emptyCompletedMsg;
    } else {
      financeCompletedBody.innerHTML = completed.map(w => createCompletedWithdrawalRowHtml(w, userMap[w.userId])).join('');
    }
  }

  // Full logs subpage with search & filter
  if (fullCompletedBody) {
    const logsSearchInput = document.getElementById('admWithdrawalLogsSearchInputFull');
    const logsStatusSelect = document.getElementById('admWithdrawalLogsStatusFilterFull');
    const logsQuery = (logsSearchInput?.value || '').toLowerCase().trim();
    const logsStatus = logsStatusSelect?.value || 'all';

    let filteredCompleted = completed;
    if (logsStatus !== 'all') {
      filteredCompleted = filteredCompleted.filter(w => w.status === logsStatus);
    }
    if (logsQuery) {
      filteredCompleted = filteredCompleted.filter(w => {
        const u = userMap[w.userId];
        const userName = (w.userName || (u ? `${u.firstName || ''} ${u.lastName || ''} ${u.username || ''}` : '')).toLowerCase();
        const bankName = (w.bankName || '').toLowerCase();
        const accNum = (w.accountNumber || '').toLowerCase();
        const accName = (w.accountName || '').toLowerCase();
        const amount = String(w.amountNaira || '');
        const status = (w.status || '').toLowerCase();
        const reason = (w.declineReason || '').toLowerCase();
        const dateStr = new Date(w.requestedAt).toLocaleDateString().toLowerCase();
        return userName.includes(logsQuery) || bankName.includes(logsQuery) || accNum.includes(logsQuery) || accName.includes(logsQuery) || amount.includes(logsQuery) || status.includes(logsQuery) || reason.includes(logsQuery) || dateStr.includes(logsQuery);
      });
    }

    if (fullLogsBadge) {
      fullLogsBadge.textContent = (logsQuery || logsStatus !== 'all')
        ? `${filteredCompleted.length} of ${completed.length} Found`
        : `${completed.length} Records`;
    }

    if (filteredCompleted.length === 0) {
      fullCompletedBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            ${(logsQuery || logsStatus !== 'all') ? 'No transaction logs match your search and filter criteria.' : 'No completed transactions in history.'}
          </td>
        </tr>
      `;
    } else {
      fullCompletedBody.innerHTML = filteredCompleted.map(w => createCompletedWithdrawalRowHtml(w, userMap[w.userId])).join('');
    }
  }
}
window.renderWithdrawalsQueue = renderWithdrawalsQueue;

// Modal State & Payout Processing Handlers
let currentPayoutWithdrawalId = null;

function openAdminPayoutModal(withdrawalId) {
  const wdr = window.TaskEarnDB.getWithdrawals().find(w => w.id === withdrawalId);
  if (!wdr) {
    window.showCustomAlert('Withdrawal request not found.', { title: 'Not Found', type: 'error' });
    return;
  }

  currentPayoutWithdrawalId = withdrawalId;

  const amtEl = document.getElementById('payoutModalAmount');
  const userEl = document.getElementById('payoutModalUser');
  const bankEl = document.getElementById('payoutModalBank');
  const accNumEl = document.getElementById('payoutModalAccountNum');
  const accNameEl = document.getElementById('payoutModalAccountName');
  const alertEl = document.getElementById('payoutModalAlert');
  const btnPaystack = document.getElementById('btnConfirmPaystackPayout');
  const btnBypass = document.getElementById('btnManualPayoutBypass');

  if (amtEl) amtEl.textContent = `₦${Number(wdr.amountNaira || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (userEl) userEl.textContent = `${wdr.userName || 'User'} (${wdr.userId})`;
  if (bankEl) bankEl.textContent = wdr.bankName || '-';
  if (accNumEl) accNumEl.textContent = wdr.accountNumber || '-';
  if (accNameEl) accNameEl.textContent = wdr.accountName || wdr.userName || '-';

  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }

  if (btnPaystack) {
    btnPaystack.disabled = false;
    btnPaystack.textContent = 'Authorize & Transfer via Paystack';
  }
  if (btnBypass) btnBypass.disabled = false;

  const modal = document.getElementById('admPayoutModal');
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
}
window.openAdminPayoutModal = openAdminPayoutModal;

function closeAdminPayoutModal() {
  const modal = document.getElementById('admPayoutModal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  currentPayoutWithdrawalId = null;
}
window.closeAdminPayoutModal = closeAdminPayoutModal;

let isProcessingPayout = false;

async function executePaystackPayout() {
  if (isProcessingPayout || !currentPayoutWithdrawalId) return;
  const wdr = window.TaskEarnDB.getWithdrawals().find(w => w.id === currentPayoutWithdrawalId);
  if (!wdr) {
    closeAdminPayoutModal();
    return;
  }

  isProcessingPayout = true;
  const settings = window.TaskEarnDB.getSettings();
  const secretKey = (settings.paystackSecretKey || '').trim();
  const alertEl = document.getElementById('payoutModalAlert');
  const btnPaystack = document.getElementById('btnConfirmPaystackPayout');
  const btnBypass = document.getElementById('btnManualPayoutBypass');

  if (!secretKey) {
    isProcessingPayout = false;
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.innerHTML = '<strong>Missing Secret Key:</strong> Paystack Secret Key is not configured. Please enter your live secret key in Financial Rules.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (alertEl) alertEl.style.display = 'none';
  if (btnPaystack) {
    btnPaystack.disabled = true;
    btnPaystack.innerHTML = `<span class="spinner-sm" style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;"></span> Debiting Paystack & Transferring...`;
  }
  if (btnBypass) btnBypass.disabled = true;

  try {
    // 1. Resolve Bank Code
    const bankCode = await resolvePaystackBankCode(wdr.bankName, secretKey);
    if (!bankCode) {
      throw new Error(`Could not determine Paystack bank code for "${wdr.bankName}". Please verify the bank name.`);
    }

    const cleanAcc = String(wdr.accountNumber || '').replace(/[^0-9]/g, '');
    if (cleanAcc.length !== 10) {
      throw new Error(`Account number "${wdr.accountNumber}" must be exactly 10 digits.`);
    }

    // 2. Create / Get Paystack Transfer Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'nuban',
        name: wdr.accountName || wdr.userName,
        account_number: cleanAcc,
        bank_code: bankCode,
        currency: 'NGN'
      })
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status || !recipientData.data || !recipientData.data.recipient_code) {
      const errMsg = recipientData.message || 'Failed to create transfer recipient on Paystack. Please check account details.';
      throw new Error(errMsg);
    }

    const recipientCode = recipientData.data.recipient_code;

    // 3. Initiate Transfer (Debits live Paystack balance)
    const amountInKobo = Math.round(Number(wdr.amountNaira) * 100);
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountInKobo,
        recipient: recipientCode,
        reason: `TaskEarn Payout - ${wdr.userName}`
      })
    });

    const transferData = await transferRes.json();
    if (!transferData.status || !transferData.data) {
      const errMsg = transferData.message || 'Paystack balance debit/transfer failed.';
      throw new Error(errMsg);
    }

    const transferInfo = {
      gateway: 'Paystack Automated Debit',
      recipientCode: recipientCode,
      transferCode: transferData.data.transfer_code || '',
      reference: transferData.data.reference || '',
      status: transferData.data.status || 'success',
      debitedAmountKobo: amountInKobo,
      transferredAt: new Date().toISOString()
    };

    // 4. Update Database as Approved with Paystack metadata
    window.TaskEarnDB.reviewWithdrawal(wdr.id, 'approved', '', transferInfo);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    closeAdminPayoutModal();
    renderWithdrawalsQueue();
    renderOverviewStats();
    updateAdminTabIndicators();

    await window.showCustomAlert(
      `Payout of ₦${Number(wdr.amountNaira).toLocaleString('en-NG', { minimumFractionDigits: 2 })} has been debited from your Paystack balance and transferred to ${wdr.userName} (${wdr.bankName}).\n\nTransfer Reference: ${transferInfo.reference}\nTransfer Code: ${transferInfo.transferCode}`,
      { title: 'Paystack Transfer Initiated', type: 'success' }
    );
  } catch (err) {
    console.error('Paystack Transfer Error:', err);
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px;">Paystack Debit Failed:</div>
        <div>${escapeHtml(err.message)}</div>
        <div style="margin-top: 8px; font-size: 0.8rem; color: #7f1d1d;">
          The withdrawal request remains <strong>PENDING</strong> and user points were <strong>NOT</strong> debited or lost.
          Fund your Paystack account balance or use "Approve Manually" if you already transferred outside Paystack.
        </div>
      `;
      alertEl.style.display = 'block';
    }
  } finally {
    isProcessingPayout = false;
    if (btnPaystack) {
      btnPaystack.disabled = false;
      btnPaystack.textContent = 'Authorize & Transfer via Paystack';
    }
    if (btnBypass) btnBypass.disabled = false;
  }
}
window.executePaystackPayout = executePaystackPayout;

async function executeManualPayoutBypass() {
  if (isProcessingPayout || !currentPayoutWithdrawalId) return;
  const wdr = window.TaskEarnDB.getWithdrawals().find(w => w.id === currentPayoutWithdrawalId);
  if (!wdr) {
    closeAdminPayoutModal();
    return;
  }

  isProcessingPayout = true;
  try {
    const confirmed = await window.showCustomConfirm(
      `Bypass Paystack automated debit for ₦${Number(wdr.amountNaira).toLocaleString('en-NG', { minimumFractionDigits: 2 })} to ${wdr.userName}?\n\nChoose this ONLY if you have already transferred the money to the user manually via your personal bank app.`,
      {
        title: 'Manual Payout Approval',
        confirmText: 'Confirm Manual Approval',
        cancelText: 'Cancel'
      }
    );

    if (!confirmed) return;

    const transferInfo = {
      gateway: 'Manual Transfer (Bypass)',
      status: 'manual_settled',
      transferredAt: new Date().toISOString()
    };

    window.TaskEarnDB.reviewWithdrawal(wdr.id, 'approved', '', transferInfo);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }

    closeAdminPayoutModal();
    renderWithdrawalsQueue();
    renderOverviewStats();
    updateAdminTabIndicators();

    await window.showCustomAlert(
      `Withdrawal of ₦${Number(wdr.amountNaira).toLocaleString('en-NG', { minimumFractionDigits: 2 })} for ${wdr.userName} marked as Approved (Manual).`,
      { title: 'Payout Approved', type: 'success' }
    );
  } finally {
    isProcessingPayout = false;
  }
}
window.executeManualPayoutBypass = executeManualPayoutBypass;

async function handleReviewWithdrawal(withdrawalId, status) {
  let reason = '';
  if (status === 'declined') {
    const promptResult = await window.showCustomPrompt(
      'Reason for declining withdrawal (will be shown to user and points refunded):',
      'Incorrect bank details.',
      {
        title: 'Decline Withdrawal',
        confirmText: 'Decline Withdrawal',
        cancelText: 'Cancel',
        danger: true,
        placeholder: 'Reason for declining...'
      }
    );
    if (promptResult === null) return;
    reason = promptResult.trim() || 'Incorrect bank details.';
    window.TaskEarnDB.reviewWithdrawal(withdrawalId, status, reason);
    if (window.TaskEarnDB && window.TaskEarnDB.pushToCloud) {
      await window.TaskEarnDB.pushToCloud();
    }
    renderWithdrawalsQueue();
    renderOverviewStats();
    updateAdminTabIndicators();
  } else if (status === 'approved') {
    openAdminPayoutModal(withdrawalId);
  }
}

// =================== TAB 5: MORE & SUPPORT INBOX ===================

function openAdminNewChatModal() {
  const modal = document.getElementById('admNewChatModal');
  if (!modal) return;
  const searchInput = document.getElementById('admNewChatSearchInput');
  if (searchInput) searchInput.value = '';
  modal.classList.add('open');
  renderAdminNewChatUserList();
}

function closeAdminNewChatModal() {
  const modal = document.getElementById('admNewChatModal');
  if (modal) modal.classList.remove('open');
}

function renderAdminNewChatUserList() {
  const container = document.getElementById('admNewChatUserList');
  if (!container) return;
  const users = window.TaskEarnDB.getUsers();
  const searchInput = document.getElementById('admNewChatSearchInput');
  const query = (searchInput?.value || '').toLowerCase().trim();

  let filtered = users;
  if (query) {
    filtered = users.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''} ${u.username || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.85rem;">No members match "${escapeHtml(query)}".</div>`;
    return;
  }

  container.innerHTML = filtered.map(u => {
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;" onclick="startAdminChatWithUser('${u.id}')">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background-color: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; overflow: hidden; flex-shrink: 0; font-size: 0.85rem;">
            ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (u.firstName ? u.firstName[0].toUpperCase() : 'U')}
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}
              ${u.username ? `<span style="font-weight: 500; font-size: 0.78rem; color: var(--primary-blue); margin-left: 4px;">@${escapeHtml(u.username)}</span>` : ''}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${escapeHtml(u.email)}
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 0.72rem; flex-shrink: 0; margin-left: 8px;">
          Message
        </button>
      </div>
    `;
  }).join('');
}

function startAdminChatWithUser(userId) {
  closeAdminNewChatModal();
  selectUserForAdminChat(userId);
  renderAdminConversationList();
  const textInput = document.getElementById('admChatTextInput');
  if (textInput) textInput.focus();
}

window.openAdminNewChatModal = openAdminNewChatModal;
window.closeAdminNewChatModal = closeAdminNewChatModal;
window.renderAdminNewChatUserList = renderAdminNewChatUserList;
window.startAdminChatWithUser = startAdminChatWithUser;

function renderAdminConversationList() {
  const users = window.TaskEarnDB.getUsers();
  const allMessages = window.TaskEarnDB.getMessages();
  const container = document.getElementById('admConversationList');
  if (!container) return;

  const userLastMsgMap = {};
  const userUnreadMap = {};
  allMessages.forEach(m => {
    if (!userLastMsgMap[m.userId] || new Date(m.createdAt) > new Date(userLastMsgMap[m.userId].createdAt)) {
      userLastMsgMap[m.userId] = m;
    }
    if (m.sender === 'user' && !m.read) {
      userUnreadMap[m.userId] = (userUnreadMap[m.userId] || 0) + 1;
    }
  });

  // Users who have messages OR the currently selected user
  const chatUsers = users.filter(u => userLastMsgMap[u.id] || (selectedUserForChat && selectedUserForChat.id === u.id));

  // Sort chat users by latest message date
  chatUsers.sort((a, b) => {
    const timeA = userLastMsgMap[a.id] ? new Date(userLastMsgMap[a.id].createdAt).getTime() : 0;
    const timeB = userLastMsgMap[b.id] ? new Date(userLastMsgMap[b.id].createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const convCountBadge = document.getElementById('admInboxConvCountBadge');
  const searchInput = document.getElementById('admInboxSearchInput');
  const query = (searchInput?.value || '').toLowerCase().trim();

  let displayedUsers = chatUsers;

  // When admin searches, search ALL registered users so they can message anyone
  if (query) {
    displayedUsers = users.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''} ${u.username || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }

  if (convCountBadge) {
    convCountBadge.textContent = query ? `${displayedUsers.length}` : `${chatUsers.length}`;
  }

  if (displayedUsers.length === 0) {
    if (query) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 12px; text-align: center;">
          No members match "${escapeHtml(query)}".
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 12px; text-align: center;">
          <div style="font-weight: 600; color: var(--text-main); margin-bottom: 6px;">No conversations yet</div>
          <p style="font-size: 0.8rem; margin-bottom: 12px;">Start a direct message with any member.</p>
          <button type="button" class="btn btn-primary btn-sm" onclick="openAdminNewChatModal()">
            + Start Conversation
          </button>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = displayedUsers.map(u => {
    const isSelected = selectedUserForChat && selectedUserForChat.id === u.id;
    const unreadCount = userUnreadMap[u.id] || 0;
    const lastMsg = userLastMsgMap[u.id];
    const unreadBadgeText = window.TaskEarnDB.formatBadgeCount(unreadCount);

    return `
      <div style="padding: 10px 12px; border-radius: var(--radius-md); background-color: ${isSelected ? 'var(--primary-green-light)' : 'var(--bg-subtle)'}; cursor: pointer; display: flex; align-items: center; gap: 10px; border: 1px solid ${isSelected ? 'var(--primary-green)' : 'transparent'}; position: relative;" onclick="selectUserForAdminChat('${u.id}')">
        <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background-color: var(--primary-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; overflow: hidden; flex-shrink: 0; font-size: 0.85rem;">
          ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : (u.firstName ? u.firstName[0].toUpperCase() : 'U')}
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <strong style="font-size: 0.88rem; color: var(--text-main); display: block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</strong>
            ${lastMsg ? `<span style="font-size: 0.7rem; color: var(--text-muted); flex-shrink: 0;">${new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <div style="font-size: 0.76rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
              ${lastMsg ? (lastMsg.sender === 'admin' ? `You: ${escapeHtml(lastMsg.text || 'Attachment')}` : escapeHtml(lastMsg.text || 'Attachment')) : (u.username ? `@${escapeHtml(u.username)}` : escapeHtml(u.email))}
            </div>
            ${unreadCount > 0 ? `<span class="badge badge-approved" style="font-size: 0.65rem; padding: 1px 6px; border-radius: 999px;">${unreadBadgeText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Auto-select saved conversation or first conversation on desktop
  const savedChatUserId = localStorage.getItem('taskearn_admin_active_chat_user');
  if (!selectedUserForChat && savedChatUserId && displayedUsers.some(u => u.id === savedChatUserId)) {
    selectUserForAdminChat(savedChatUserId);
  } else if (!selectedUserForChat && displayedUsers.length > 0 && window.innerWidth >= 900) {
    selectUserForAdminChat(displayedUsers[0].id);
  }
}

function selectUserForAdminChat(userId) {
  selectedUserForChat = window.TaskEarnDB.getUserById(userId);
  if (!selectedUserForChat) {
    try {
      localStorage.removeItem('taskearn_admin_active_chat_user');
    } catch (e) {}
    return;
  }

  try {
    localStorage.setItem('taskearn_admin_active_chat_user', userId);
  } catch (e) {}

  const headerAvatar = document.getElementById('admChatCurrentUserAvatar');
  if (headerAvatar) {
    headerAvatar.style.display = 'flex';
    if (selectedUserForChat.avatar) {
      headerAvatar.innerHTML = `<img src="${selectedUserForChat.avatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      headerAvatar.textContent = (selectedUserForChat.firstName ? selectedUserForChat.firstName[0] : 'U').toUpperCase();
    }
  }

  document.getElementById('admChatCurrentUserName').textContent = `${selectedUserForChat.firstName} ${selectedUserForChat.lastName}`;
  document.getElementById('admChatCurrentUserEmail').textContent = `${selectedUserForChat.email} • ${selectedUserForChat.phone}`;

  const inboxLayout = document.getElementById('admInboxLayout');
  if (inboxLayout) {
    inboxLayout.classList.remove('viewing-list');
    inboxLayout.classList.add('viewing-chat');
  }

  window.TaskEarnDB.markMessagesRead(userId, 'admin');
  updateAdminTabIndicators();
  renderAdminChatMessages();
}

function backToConversationList() {
  selectedUserForChat = null;
  try {
    localStorage.removeItem('taskearn_admin_active_chat_user');
  } catch (e) {}
  const inboxLayout = document.getElementById('admInboxLayout');
  if (inboxLayout) {
    inboxLayout.classList.remove('viewing-chat');
    inboxLayout.classList.add('viewing-list');
  }
}

function renderAdminChatMessages() {
  if (!selectedUserForChat) return;
  const msgs = window.TaskEarnDB.getMessages(selectedUserForChat.id);
  const container = document.getElementById('admChatMessages');

  if (msgs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); margin: auto; padding: 24px;">
        <div style="font-weight: 700; color: var(--text-main); font-size: 1.05rem; margin-bottom: 4px;">
          Start conversation with ${escapeHtml(selectedUserForChat.firstName)}
        </div>
        <div style="font-size: 0.84rem; color: var(--text-muted); max-width: 320px; margin: 0 auto; line-height: 1.45;">
          No messages with this user yet. Type your first message below and press Send.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = msgs.map(m => {
    const isAdmin = m.sender === 'admin';
    return `
      <div class="message-bubble ${isAdmin ? 'message-user' : 'message-admin'}">
        <div>${escapeHtml(m.text)}</div>
        ${m.image ? `<img src="${m.image}" class="message-image" alt="Attachment">` : ''}
        <div class="message-meta">
          ${isAdmin ? 'Admin' : selectedUserForChat.firstName} &bull; ${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
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

async function handleAdminChatImagePreview(event) {
  const file = event.target.files[0];
  if (!file) return;

  const compressed = await compressImage(file, 800, 800, 0.75);
  if (compressed) {
    tempAdminChatImageData = compressed;
    document.getElementById('admChatImagePreviewName').textContent = file.name;
    document.getElementById('admChatImagePreviewContainer').style.display = 'flex';
  }
}

function clearAdminChatImagePreview() {
  tempAdminChatImageData = null;
  document.getElementById('admChatImageInput').value = '';
  document.getElementById('admChatImagePreviewContainer').style.display = 'none';
}

let isSendingAdminReply = false;

async function handleSendAdminReply(event) {
  event.preventDefault();
  if (isSendingAdminReply) return;

  if (!selectedUserForChat) {
    await window.showCustomAlert('Please select a user conversation first.', {
      title: 'Conversation Required',
      type: 'warning'
    });
    return;
  }

  const input = document.getElementById('admChatTextInput');
  const text = (input?.value || '').trim();
  const image = tempAdminChatImageData;
  if (!text && !image) return;

  isSendingAdminReply = true;
  const sendBtn = event.target.querySelector('button[type="submit"]');
  if (sendBtn) sendBtn.disabled = true;

  try {
    window.TaskEarnDB.sendMessage({
      userId: selectedUserForChat.id,
      sender: 'admin',
      text,
      image
    });

    if (input) input.value = '';
    clearAdminChatImagePreview();
    renderAdminChatMessages();
    renderAdminConversationList();
    updateAdminTabIndicators();
  } finally {
    setTimeout(() => {
      isSendingAdminReply = false;
      if (sendBtn) sendBtn.disabled = false;
    }, 600);
  }
}

function exportDatabaseJson() {
  const data = {
    settings: window.TaskEarnDB.getSettings(),
    users: window.TaskEarnDB.getUsers(),
    tasks: window.TaskEarnDB.getTasks(),
    submissions: window.TaskEarnDB.getSubmissions(),
    withdrawals: window.TaskEarnDB.getWithdrawals(),
    messages: window.TaskEarnDB.getMessages()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `taskearn_backup_${Date.now()}.json`;
  a.click();
}

async function manualCloudSync() {
  const badge = document.getElementById('cloudSyncStatusBadge');
  if (badge) {
    badge.textContent = 'Syncing...';
    badge.className = 'badge badge-pending';
  }
  try {
    await window.TaskEarnDB.syncNow();
    if (typeof refreshAdminDataViews === 'function') {
      refreshAdminDataViews();
    }
    if (badge) {
      badge.textContent = 'Supabase Connected';
      badge.className = 'badge badge-approved';
    }
    await window.showCustomAlert('Cloud database synchronized successfully with Supabase!', {
      title: 'Cloud Sync Successful',
      type: 'success'
    });
  } catch (err) {
    if (badge) {
      badge.textContent = 'Sync Error';
      badge.className = 'badge badge-declined';
    }
    await window.showCustomAlert('Cloud sync failed: ' + err.message, {
      title: 'Cloud Sync Failed',
      type: 'error'
    });
  }
}

async function resetDatabaseDemoData() {
  const confirmed = await window.showCustomConfirm(
    'This will wipe all data and reset to completely clean empty state in both local cache and Supabase cloud. Proceed?',
    {
      title: 'Wipe & Reset Database',
      confirmText: 'Wipe All Data',
      danger: true
    }
  );
  if (!confirmed) return;
  localStorage.clear();
  window.TaskEarnDB.init();
  try {
    await window.TaskEarnDB.pushToCloud();
  } catch (e) {}
  location.reload();
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.handleAdminPasswordChange = handleAdminPasswordChange;
window.handleAdminRemoveUserAvatar = handleAdminRemoveUserAvatar;
window.handleAdminResetUserPassword = handleAdminResetUserPassword;
window.handleAdminSaveUserDetails = handleAdminSaveUserDetails;

