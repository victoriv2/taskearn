/**
 * TaskEarn - Administration Controller
 * Manages overview stats, user directory, drawer details, task creation/editing with dwell timer,
 * financial rates, withdrawal processing, and user DM inbox.
 */

let selectedUserForChat = null;
let tempAdminChatImageData = null;

document.addEventListener('DOMContentLoaded', () => {
  injectAdminSvgIcons();
  initAdminDashboard();
});

function injectAdminSvgIcons() {
  const setIcon = (id, svg) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  };

  // Desktop Sidebar Icons
  setIcon('admDIconOverview', window.ICONS.tasks);
  setIcon('admDIconTasks', window.ICONS.video);
  setIcon('admDIconCreate', window.ICONS.plus);
  setIcon('admDIconFinancial', window.ICONS.wallet);
  setIcon('admDIconMore', window.ICONS.more);
  setIcon('admSidebarLogoutIcon', window.ICONS.logout);

  // Mobile Bottom Nav Icons
  setIcon('mAdmIconOverview', window.ICONS.tasks);
  setIcon('mAdmIconTasks', window.ICONS.video);
  setIcon('mAdmIconCreate', window.ICONS.plus);
  setIcon('mAdmIconFinancial', window.ICONS.wallet);
  setIcon('mAdmIconMore', window.ICONS.more);

  // UI Icons
  setIcon('admSearchIcon', window.ICONS.search);
  setIcon('admTaskSearchIcon', window.ICONS.search);
  setIcon('admPayInSearchIcon', window.ICONS.search);
  setIcon('admBtnIconPlus', window.ICONS.plus);
  setIcon('admIconAttach', window.ICONS.image);
  setIcon('admIconSend', window.ICONS.send);
  setIcon('admHeaderLogoutIcon', window.ICONS.logout);
  setIcon('iconCloseDrawer', window.ICONS.close);
  setIcon('iconCloseEditModal', window.ICONS.close);

  if (window.initPasswordToggleIcons) {
    window.initPasswordToggleIcons();
  }
}

function initAdminDashboard() {
  checkAdminAuth();

  if (window.TaskEarnDB && window.TaskEarnDB.onSync) {
    window.TaskEarnDB.onSync((type) => {
      const badge = document.getElementById('cloudSyncStatusBadge');
      if (badge) {
        badge.textContent = 'JSONBin Connected';
        badge.className = 'badge badge-approved';
      }
      if (window.TaskEarnDB.isAdminLoggedIn()) {
        renderOverviewTab();
        const activeSection = document.querySelector('.admin-section.active');
        if (activeSection) {
          if (activeSection.id === 'sec-tasks') renderAdminTasks();
          if (activeSection.id === 'sec-users') renderUsersTable();
          if (activeSection.id === 'sec-financial') {
            renderFinancialTab();
            renderWithdrawalsTable();
            renderPayInTable();
          }
          if (activeSection.id === 'sec-messages') {
            renderAdminChatUserList();
            if (selectedUserForChat) renderAdminChatMessages();
          }
        }
      }
    });
  }
}

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

    const tabs = ['overview', 'tasks', 'create-task', 'financial', 'more'];
    let savedTab = '';
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (tabs.includes(hash)) {
      savedTab = hash;
    } else {
      savedTab = localStorage.getItem('taskearn_admin_active_tab') || 'overview';
    }
    if (!tabs.includes(savedTab)) savedTab = 'overview';

    switchAdminTab(savedTab);
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
      await window.TaskEarnDB.pullFromCloud();
    }
    window.TaskEarnDB.loginAdmin(email, pass);
    checkAdminAuth();
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

function handleAdminLogout() {
  window.TaskEarnDB.logoutAdmin();
  try {
    localStorage.removeItem('taskearn_admin_active_tab');
    history.replaceState(null, '', window.location.pathname);
  } catch (e) {}
  checkAdminAuth();
}

function switchAdminTab(tabName) {
  const tabs = ['overview', 'tasks', 'create-task', 'financial', 'more'];
  if (!tabs.includes(tabName)) tabName = 'overview';

  try {
    localStorage.setItem('taskearn_admin_active_tab', tabName);
    history.replaceState(null, '', '#' + tabName);
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
    renderAdminConversationList();
  }
}

window.addEventListener('hashchange', () => {
  if (!window.TaskEarnDB.isAdminLoggedIn()) return;
  const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
  const tabs = ['overview', 'tasks', 'create-task', 'financial', 'more'];
  if (tabs.includes(hash)) {
    switchAdminTab(hash);
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

// Live activity feed of auto-verified completions
function renderRecentActivity() {
  const completions = window.TaskEarnDB.getSubmissions();
  const tbody = document.getElementById('admRecentActivityTableBody');

  if (completions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No task completions yet. When users perform tasks, live auto-verified completions appear here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = completions.slice(0, 10).map(c => `
    <tr>
      <td>${new Date(c.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>
        <strong>${escapeHtml(c.userName)}</strong>
        <div style="font-size: 0.78rem; color: var(--text-muted);">User ID: ${c.userId}</div>
      </td>
      <td><strong>${escapeHtml(c.taskTitle)}</strong></td>
      <td><span class="badge badge-approved">+${c.points} PTS</span></td>
      <td>
        <span class="badge badge-active">Auto Click & Dwell</span>
      </td>
    </tr>
  `).join('');
}

function renderAdminUsers() {
  const users = window.TaskEarnDB.getUsers();
  const query = (document.getElementById('admUserSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('admUserStatusFilter')?.value || 'all';
  const sortFilter = document.getElementById('admUserSortFilter')?.value || 'newest';

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

  const tbody = document.getElementById('admUsersTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No users match the criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div style="font-weight: 700; color: var(--text-main); cursor: pointer;" onclick="openUserDrawer('${u.id}')">
          ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}
          ${u.username ? `<span style="font-weight: 500; font-size: 0.8rem; color: var(--primary-blue); margin-left: 4px;">@${escapeHtml(u.username)}</span>` : ''}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">Joined ${new Date(u.createdAt).toLocaleDateString()}</div>
      </td>
      <td>
        <div>${escapeHtml(u.email)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(u.phone)}</div>
      </td>
      <td>
        <strong style="letter-spacing: 0.04em; color: var(--primary-blue);">${escapeHtml(u.referralCode || u.username)}</strong>
        ${u.referredBy ? `<div style="font-size: 0.75rem; color: var(--text-muted);">Invited by: @${escapeHtml(u.referredBy)}</div>` : ''}
      </td>
      <td>
        <strong>${u.pointsBalance.toLocaleString()} PTS</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Total: ${u.totalEarnedPoints.toLocaleString()} PTS</div>
      </td>
      <td>
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
  `).join('');
}

function openUserDrawer(userId) {
  const user = window.TaskEarnDB.getUserById(userId);
  if (!user) return;

  const submissions = window.TaskEarnDB.getUserSubmissions(userId);
  const settings = window.TaskEarnDB.getSettings();
  const rate = Number(settings.pointRateNaira) || 1.0;

  const drawerContent = document.getElementById('drawerContent');
  drawerContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
      <div style="width: 50px; height: 50px; border-radius: var(--radius-full); background-color: var(--primary-blue); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700;">
        ${user.firstName[0]}
      </div>
      <div>
        <h4 style="font-size: 1.1rem; font-weight: 700;">
          ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}
          ${user.username ? `<span style="font-size: 0.85rem; font-weight: 500; color: var(--primary-blue); margin-left: 6px;">@${escapeHtml(user.username)}</span>` : ''}
        </h4>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(user.email)} &bull; ${escapeHtml(user.phone)}</div>
      </div>
    </div>

    <div class="grid-stats" style="grid-template-columns: 1fr 1fr; margin-bottom: 20px;">
      <div class="stat-box">
        <div class="stat-label">Wallet Balance</div>
        <div class="stat-value" style="font-size: 1.2rem;">${user.pointsBalance.toLocaleString()} PTS</div>
        <div class="stat-sub">₦${(user.pointsBalance * rate).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Total Earned</div>
        <div class="stat-value" style="font-size: 1.2rem;">${user.totalEarnedPoints.toLocaleString()} PTS</div>
        <div class="stat-sub">${submissions.length} Completed</div>
      </div>
    </div>

    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0;">Account Verification</h5>
        <span class="badge ${user.isVerified ? 'badge-approved' : 'badge-pending'}">
          ${user.isVerified ? 'VERIFIED (₦100 PAID)' : 'UNVERIFIED (PENDING ₦100)'}
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
      <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Adjust User Points</h5>
      <div style="display: flex; gap: 8px;">
        <input type="number" id="drawerAdjustPointsInput" placeholder="+100 or -50" style="flex: 1;">
        <button class="btn btn-secondary btn-sm" onclick="handleDrawerPointsAdjustment('${user.id}')">Apply</button>
      </div>
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

    <div style="margin-top: 20px;">
      ${user.status === 'active' 
        ? `<button class="btn btn-danger btn-block" onclick="handleToggleUserStatus('${user.id}', 'suspended')">Suspend Account</button>`
        : `<button class="btn btn-primary btn-block" onclick="handleToggleUserStatus('${user.id}', 'active')">Reactivate Account</button>`
      }
    </div>
  `;

  document.getElementById('userDrawer').classList.add('open');
}

function handleAdminSaveUserDetails(userId) {
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
      alert('Bank account number must be exactly 10 digits (NUBAN).');
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
    openUserDrawer(userId);
    renderAdminUsers();
    const updatedAlert = document.getElementById('drawerEditAlert');
    if (updatedAlert) {
      updatedAlert.className = 'alert alert-success';
      updatedAlert.textContent = 'User details and bank info updated successfully.';
      updatedAlert.style.display = 'block';
    }
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } else {
      alert(err.message);
    }
  }
}

function handleToggleUserVerification(userId, newVerifiedState) {
  window.TaskEarnDB.setVerificationStatus(userId, newVerifiedState);
  openUserDrawer(userId);
  renderAdminUsers();
  renderOverviewStats();
}

function closeUserDrawer() {
  document.getElementById('userDrawer').classList.remove('open');
}

function handleDrawerPointsAdjustment(userId) {
  const input = document.getElementById('drawerAdjustPointsInput');
  const delta = Number(input.value);
  if (!delta || isNaN(delta)) return;

  const user = window.TaskEarnDB.getUserById(userId);
  const newBal = Math.max(0, user.pointsBalance + delta);
  window.TaskEarnDB.updateUser(userId, { pointsBalance: newBal });
  alert(`User balance updated to ${newBal.toLocaleString()} PTS`);
  openUserDrawer(userId);
  renderOverviewStats();
  renderAdminUsers();
}

function handleToggleUserStatus(userId, newStatus) {
  if (!confirm(`Are you sure you want to change user status to ${newStatus.toUpperCase()}?`)) return;
  window.TaskEarnDB.updateUser(userId, { status: newStatus });
  openUserDrawer(userId);
  renderAdminUsers();
}

// =================== TAB 2: TASKS LIST ===================

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
          <div style="font-weight: 700;">${escapeHtml(t.title)}</div>
          <a href="${t.targetUrl}" target="_blank" style="font-size: 0.78rem; color: var(--primary-green-dark);">
            ${escapeHtml(t.targetUrl.substring(0, 36))}...
          </a>
        </td>
        <td><span class="badge badge-active">${escapeHtml(t.category)}</span></td>
        <td><strong>${t.points} PTS</strong></td>
        <td><span class="badge badge-approved">${t.timerSeconds || 15}s Dwell</span></td>
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

function toggleTaskVisibility(taskId) {
  const task = window.TaskEarnDB.getTaskById(taskId);
  if (!task) return;
  const nextStatus = task.status === 'hidden' ? 'active' : 'hidden';
  window.TaskEarnDB.updateTask(taskId, { status: nextStatus });
  renderAdminTasks();
}

function handleDeleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task campaign?')) return;
  window.TaskEarnDB.deleteTask(taskId);
  renderAdminTasks();
}

function openEditTaskModal(taskId) {
  const task = window.TaskEarnDB.getTaskById(taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskPoints').value = task.points;
  document.getElementById('editTaskUrl').value = task.targetUrl;
  document.getElementById('editTaskTimerSeconds').value = task.timerSeconds || 15;
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

function handleSaveTaskEdit(event) {
  event.preventDefault();
  const id = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value;
  const points = Number(document.getElementById('editTaskPoints').value);
  const targetUrl = document.getElementById('editTaskUrl').value;
  const timerSeconds = Number(document.getElementById('editTaskTimerSeconds').value);
  const status = document.getElementById('editTaskStatus').value;
  const description = document.getElementById('editTaskDesc').value;

  window.TaskEarnDB.updateTask(id, { title, points, targetUrl, timerSeconds, status, description });
  closeEditTaskModal();
  renderAdminTasks();
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

function handleCreateTaskSubmit(event) {
  event.preventDefault();
  const title = document.getElementById('taskTitle').value;
  const category = document.getElementById('taskCategory').value;
  const points = Number(document.getElementById('taskPoints').value);
  const targetUrl = document.getElementById('taskTargetUrl').value;
  const timerSeconds = Number(document.getElementById('taskTimerSeconds').value) || 15;
  const maxCompletions = Number(document.getElementById('taskMaxCompletions').value);
  const description = document.getElementById('taskDescription').value;
  const alertEl = document.getElementById('createTaskAlert');

  try {
    window.TaskEarnDB.createTask({
      title,
      category,
      points,
      targetUrl,
      timerSeconds,
      maxCompletions,
      description
    });

    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Task published successfully! Live in user catalog.';
    alertEl.style.display = 'block';

    document.getElementById('createTaskForm').reset();
    setTimeout(() => {
      alertEl.style.display = 'none';
      switchAdminTab('tasks');
    }, 1200);
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

// =================== TAB 4: FINANCIALS & PAYOUTS ===================

function loadFinancialSettings() {
  const settings = window.TaskEarnDB.getSettings();
  document.getElementById('settingPointRate').value = settings.pointRateNaira;
  document.getElementById('settingReferralPoints').value = settings.referralPoints;
  document.getElementById('settingMinWithdrawal').value = settings.minWithdrawalNaira;
  if (document.getElementById('settingVerificationFee')) {
    document.getElementById('settingVerificationFee').value = settings.verificationFeeNaira ?? 100;
  }
  if (document.getElementById('settingPaystackKey')) {
    document.getElementById('settingPaystackKey').value = settings.paystackPublicKey || 'pk_live_732d9b62cd035b8dad96e981d7f6982540342e80';
  }
  if (document.getElementById('settingAdminPhone')) {
    document.getElementById('settingAdminPhone').value = settings.adminPhone || '08012345678';
  }
  if (document.getElementById('settingAdminEmail')) {
    document.getElementById('settingAdminEmail').value = settings.adminEmail || 'admin@taskearn.com';
  }
}

function handleSaveFinancialSettings(event) {
  event.preventDefault();
  const pointRateNaira = parseFloat(document.getElementById('settingPointRate').value);
  const referralPoints = parseInt(document.getElementById('settingReferralPoints').value, 10);
  const minWithdrawalNaira = parseFloat(document.getElementById('settingMinWithdrawal').value);
  const verificationFeeNaira = parseFloat(document.getElementById('settingVerificationFee').value) || 100;
  const paystackPublicKey = document.getElementById('settingPaystackKey').value.trim();
  const adminPhoneInput = (document.getElementById('settingAdminPhone')?.value || '').trim();
  const adminEmailInput = (document.getElementById('settingAdminEmail')?.value || '').trim();
  const alertEl = document.getElementById('financialSettingsAlert');

  let adminPhone = undefined;
  if (adminPhoneInput) {
    const cleanAdminPhone = adminPhoneInput.replace(/[\s-]/g, '');
    if (!/^\d{11}$/.test(cleanAdminPhone)) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Admin support phone number must be exactly 11 digits (e.g. 08012345678).';
      alertEl.style.display = 'block';
      return;
    }
    adminPhone = cleanAdminPhone;
  }

  const updates = {
    pointRateNaira,
    referralPoints,
    minWithdrawalNaira,
    verificationFeeNaira,
    paystackPublicKey
  };
  if (adminPhone) updates.adminPhone = adminPhone;
  if (adminEmailInput) updates.adminEmail = adminEmailInput;

  window.TaskEarnDB.updateSettings(updates);

  alertEl.className = 'alert alert-success';
  alertEl.textContent = 'Settings and administrative contact info updated successfully!';
  alertEl.style.display = 'block';
  setTimeout(() => alertEl.style.display = 'none', 2500);

  renderOverviewStats();
  renderPayInRecords();
  renderWithdrawalsQueue();
}

// =================== PAY-IN RECORDS (VERIFICATION REVENUE) ===================

function renderPayInRecords() {
  const payments = window.TaskEarnDB.getPayments();
  const searchInput = document.getElementById('admPayInSearchInput');
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

  const tbody = document.getElementById('admPayInTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          ${query ? 'No pay-in records match your search.' : 'No pay-in transactions recorded yet.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td style="white-space: nowrap;">
        <div style="font-weight: 600;">${new Date(p.createdAt).toLocaleDateString()}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </td>
      <td>
        <div style="font-weight: 700; color: var(--text-main); cursor: pointer;" onclick="openUserDrawer('${p.userId}')">
          ${escapeHtml(p.userName || 'User')}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(p.userEmail || '')}</div>
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
  `).join('');
}

function renderWithdrawalsQueue() {
  const withdrawals = window.TaskEarnDB.getWithdrawals();
  const pending = withdrawals.filter(w => w.status === 'pending');
  const completed = withdrawals.filter(w => w.status !== 'pending');

  document.getElementById('pendingWithdrawalsBadge').textContent = `${pending.length} Pending`;

  const pendingBody = document.getElementById('admPendingWithdrawalsBody');
  if (pending.length === 0) {
    pendingBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No pending withdrawal requests. All payouts are cleared!
        </td>
      </tr>
    `;
  } else {
    pendingBody.innerHTML = pending.map(w => `
      <tr>
        <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
        <td>
          <strong>${escapeHtml(w.userName)}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">User ID: ${w.userId}</div>
        </td>
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
    `).join('');
  }

  const completedBody = document.getElementById('admCompletedWithdrawalsBody');
  if (completed.length === 0) {
    completedBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No completed transactions in history.
        </td>
      </tr>
    `;
  } else {
    completedBody.innerHTML = completed.map(w => {
      const isApproved = w.status === 'approved';
      return `
        <tr>
          <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
          <td>${escapeHtml(w.userName)}</td>
          <td><strong>₦${w.amountNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></td>
          <td>${escapeHtml(w.bankName)} &bull; ${escapeHtml(w.accountNumber)}</td>
          <td>
            <span class="badge ${isApproved ? 'badge-approved' : 'badge-declined'}">
              ${w.status.toUpperCase()}
            </span>
            ${w.declineReason ? `<div style="font-size: 0.75rem; color: #991b1b;">Reason: ${escapeHtml(w.declineReason)}</div>` : ''}
          </td>
          <td>${w.processedAt ? new Date(w.processedAt).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `;
    }).join('');
  }
}

function handleReviewWithdrawal(withdrawalId, status) {
  let reason = '';
  if (status === 'declined') {
    reason = prompt('Reason for declining withdrawal (will be shown to user and points refunded):') || 'Incorrect bank details.';
  }
  window.TaskEarnDB.reviewWithdrawal(withdrawalId, status, reason);
  renderWithdrawalsQueue();
  renderOverviewStats();
}

// =================== TAB 5: MORE & SUPPORT INBOX ===================

function renderAdminConversationList() {
  const users = window.TaskEarnDB.getUsers();
  const allMessages = window.TaskEarnDB.getMessages();
  const container = document.getElementById('admConversationList');

  const userMap = {};
  allMessages.forEach(m => {
    userMap[m.userId] = true;
  });

  const chatUsers = users.filter(u => userMap[u.id]);

  if (chatUsers.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px;">No active conversations yet.</div>`;
    return;
  }

  container.innerHTML = chatUsers.map(u => {
    const isSelected = selectedUserForChat && selectedUserForChat.id === u.id;
    return `
      <div style="padding: 10px 12px; border-radius: var(--radius-md); background-color: ${isSelected ? 'var(--primary-green-light)' : 'var(--bg-subtle)'}; cursor: pointer;" onclick="selectUserForAdminChat('${u.id}')">
        <strong style="font-size: 0.9rem; color: var(--text-main);">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</strong>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(u.email)}</div>
      </div>
    `;
  }).join('');

  // Auto-select on desktop only
  if (!selectedUserForChat && chatUsers.length > 0 && window.innerWidth >= 900) {
    selectUserForAdminChat(chatUsers[0].id);
  }
}

function selectUserForAdminChat(userId) {
  selectedUserForChat = window.TaskEarnDB.getUserById(userId);
  if (!selectedUserForChat) return;

  document.getElementById('admChatCurrentUserName').textContent = `${selectedUserForChat.firstName} ${selectedUserForChat.lastName}`;
  document.getElementById('admChatCurrentUserEmail').textContent = `${selectedUserForChat.email} • ${selectedUserForChat.phone}`;

  const inboxLayout = document.getElementById('admInboxLayout');
  if (inboxLayout) {
    inboxLayout.classList.remove('viewing-list');
    inboxLayout.classList.add('viewing-chat');
  }

  window.TaskEarnDB.markMessagesRead(userId, 'admin');
  renderAdminChatMessages();
}

function backToConversationList() {
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
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin: auto;">No messages with this user yet.</div>`;
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

function handleSendAdminReply(event) {
  event.preventDefault();
  if (!selectedUserForChat) {
    alert('Please select a user conversation first.');
    return;
  }

  const input = document.getElementById('admChatTextInput');
  const text = input.value.trim();
  if (!text && !tempAdminChatImageData) return;

  window.TaskEarnDB.sendMessage({
    userId: selectedUserForChat.id,
    sender: 'admin',
    text,
    image: tempAdminChatImageData
  });

  input.value = '';
  clearAdminChatImagePreview();
  renderAdminChatMessages();
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
    if (badge) {
      badge.textContent = 'JSONBin Connected';
      badge.className = 'badge badge-approved';
    }
    alert('Cloud database synchronized successfully with JSONBin.io!');
  } catch (err) {
    if (badge) {
      badge.textContent = 'Sync Error';
      badge.className = 'badge badge-declined';
    }
    alert('Cloud sync failed: ' + err.message);
  }
}

async function resetDatabaseDemoData() {
  if (!confirm('This will wipe all data and reset to completely clean empty state in both local cache and JSONBin cloud. Proceed?')) return;
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
