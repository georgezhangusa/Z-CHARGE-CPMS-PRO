import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { CpmsUserAccount, UserLevel, InviteEmailRecord } from '../types';

const STORAGE_USERS_KEY = 'zcharge_cpms_users_v3';
const STORAGE_INVITES_KEY = 'zcharge_cpms_invites_v3';
const STORAGE_CURRENT_USER_KEY = 'zcharge_cpms_current_user_v3';
export const STORAGE_ADMIN_PASSWORD_CHANGED = 'zcharge_admin_password_changed_v3';

// Initial default admin as specified by user requirements
export const INITIAL_ADMIN_ACCOUNT: CpmsUserAccount = {
  id: 'user-admin-root',
  username: 'admin',
  displayName: 'System Administrator',
  email: 'admin@zcharge-cpms.com',
  role: 'admin',
  password: 'password', // Initial default password
  mustChangePassword: true, // MUST change password on 1st login
  assignedSiteIds: ['site-houston-03', 'site-austin-hub', 'site-dallas-galleria', 'site-san-antonio'],
  status: 'active',
  createdAt: '2026-01-01T08:00:00Z',
  updatedAt: new Date().toISOString(),
  notes: 'Primary Root Administrator (Default Credentials: admin / password)',
};

// Initial demonstration accounts representing other user levels
export const INITIAL_DEMO_USERS: CpmsUserAccount[] = [
  INITIAL_ADMIN_ACCOUNT,
  {
    id: 'user-manager-marcus',
    username: 'm_vance',
    displayName: 'Marcus Vance',
    email: 'mvance@energycorridor.com',
    role: 'site_manager',
    password: 'password123',
    mustChangePassword: false,
    assignedSiteIds: ['site-houston-03', 'site-austin-hub'],
    status: 'active',
    createdAt: '2026-01-15T10:00:00Z',
    notes: 'Houston Energy Corridor Hub Lead',
  },
  {
    id: 'user-tech-elena',
    username: 'e_rostova',
    displayName: 'Elena Rostova',
    email: 'erostova@ev-fieldtech.com',
    role: 'technician',
    password: 'password123',
    mustChangePassword: false,
    assignedSiteIds: ['site-houston-03', 'site-austin-hub', 'site-dallas-galleria', 'site-san-antonio'],
    status: 'active',
    createdAt: '2026-02-01T14:30:00Z',
    notes: 'High-Voltage DC Fast Charging Hardware Specialist',
  },
  {
    id: 'user-viewer-jordan',
    username: 'j_taylor',
    displayName: 'Jordan Taylor',
    email: 'jtaylor@cleanfleet-audit.org',
    role: 'viewer',
    password: 'password123',
    mustChangePassword: false,
    assignedSiteIds: ['site-houston-03'],
    status: 'active',
    createdAt: '2026-02-20T09:15:00Z',
    notes: 'Compliance & Telemetry Auditor',
  },
];

// Helper to get local stored users
function getLocalUsers(): CpmsUserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AuthService] Error reading users from localStorage:', err);
  }
  return INITIAL_DEMO_USERS;
}

function saveLocalUsers(users: CpmsUserAccount[]) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('[AuthService] Error saving users to localStorage:', err);
  }
}

function getLocalInvites(): InviteEmailRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_INVITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[AuthService] Error reading invites from localStorage:', err);
  }
  return [];
}

function saveLocalInvites(invites: InviteEmailRecord[]) {
  try {
    localStorage.setItem(STORAGE_INVITES_KEY, JSON.stringify(invites));
  } catch (err) {
    console.warn('[AuthService] Error saving invites to localStorage:', err);
  }
}

// --------------------------------------------------------------------------
// User Accounts Service
// --------------------------------------------------------------------------
export const authService = {
  // Get all users
  getUsers(): CpmsUserAccount[] {
    return getLocalUsers();
  },

  // Listen to users from Firestore (with local fallback)
  subscribeUsers(callback: (users: CpmsUserAccount[]) => void) {
    // Initial emit
    callback(getLocalUsers());

    try {
      const usersCol = collection(db, 'user_accounts');
      const unsubscribe = onSnapshot(
        usersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: CpmsUserAccount[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as CpmsUserAccount);
            });
            // Ensure admin is present
            if (!list.some((u) => u.username.toLowerCase() === 'admin')) {
              list.unshift(INITIAL_ADMIN_ACCOUNT);
            }
            saveLocalUsers(list);
            callback(list);
          } else {
            // First time seeding to Firestore
            const initialList = getLocalUsers();
            initialList.forEach((u) => {
              setDoc(doc(db, 'user_accounts', u.id), u).catch(() => {});
            });
            callback(initialList);
          }
        },
        (error) => {
          console.warn('[AuthService] Firestore onSnapshot user_accounts notice (using local fallback):', error.message);
          callback(getLocalUsers());
        }
      );
      return unsubscribe;
    } catch {
      return () => {};
    }
  },

  // Authenticate with username and password
  loginWithUsernamePassword(
    usernameInput: string,
    passwordInput: string
  ): { success: boolean; user?: CpmsUserAccount; error?: string } {
    const users = getLocalUsers();
    const cleanUsername = usernameInput.trim().toLowerCase();
    const user = users.find(
      (u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanUsername
    );

    if (!user) {
      return { success: false, error: 'User account not found. Please check username or email.' };
    }

    if (user.status === 'suspended') {
      return { success: false, error: 'This user account has been suspended by an Administrator.' };
    }

    if (user.status === 'invited') {
      return {
        success: false,
        error: 'This account has not been activated yet. Please click the invitation link sent to your email to set your password.',
      };
    }

    // Password comparison
    if (user.password !== passwordInput) {
      return { success: false, error: 'Invalid password. Please try again.' };
    }

    // Update last login
    const updatedUser: CpmsUserAccount = {
      ...user,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveUserAccount(updatedUser);
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedUser));

    return { success: true, user: updatedUser };
  },

  // Save or update user account in storage & Firestore
  async saveUserAccount(account: CpmsUserAccount): Promise<void> {
    const current = getLocalUsers();
    const index = current.findIndex((u) => u.id === account.id || u.username.toLowerCase() === account.username.toLowerCase());
    let nextList: CpmsUserAccount[];

    if (index >= 0) {
      nextList = [...current];
      nextList[index] = account;
    } else {
      nextList = [account, ...current];
    }

    saveLocalUsers(nextList);

    // Sync to Firestore
    try {
      const userRef = doc(db, 'user_accounts', account.id);
      await setDoc(userRef, account, { merge: true });
    } catch (err: any) {
      console.warn('[AuthService] Notice: saved to local store, Firestore sync deferred:', err.message);
    }
  },

  // Change password (especially for 1st-login admin requirement)
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string; user?: CpmsUserAccount }> {
    const users = getLocalUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    if (user.password && user.password !== oldPassword) {
      return { success: false, error: 'Current password does not match.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    const updatedUser: CpmsUserAccount = {
      ...user,
      password: newPassword,
      mustChangePassword: false, // Requirement satisfied!
      updatedAt: new Date().toISOString(),
    };

    if (user.username.toLowerCase() === 'admin') {
      try {
        localStorage.setItem(STORAGE_ADMIN_PASSWORD_CHANGED, 'true');
      } catch {}
    }

    await this.saveUserAccount(updatedUser);
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedUser));

    return { success: true, user: updatedUser };
  },

  // Check if initial admin password has already been changed
  isAdminPasswordChanged(): boolean {
    try {
      if (localStorage.getItem(STORAGE_ADMIN_PASSWORD_CHANGED) === 'true') {
        return true;
      }
      const users = getLocalUsers();
      const admin = users.find((u) => u.username.toLowerCase() === 'admin');
      if (admin && admin.mustChangePassword === false && admin.password !== 'password') {
        return true;
      }
    } catch {}
    return false;
  },

  // Admin invites a new user with level (Site Manager, Technician, Viewer, Admin)
  async inviteUser(params: {
    recipientName: string;
    recipientEmail: string;
    role: UserLevel;
    assignedSiteIds: string[];
    assignedSiteNames: string[];
    notes?: string;
  }): Promise<{ user: CpmsUserAccount; emailRecord: InviteEmailRecord }> {
    const cleanEmail = params.recipientEmail.trim().toLowerCase();
    const users = getLocalUsers();

    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error(`A user account with email "${cleanEmail}" already exists.`);
    }

    const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const userId = `user-inv-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48h validity

    const newAccount: CpmsUserAccount = {
      id: userId,
      username: cleanEmail.split('@')[0], // placeholder until user chooses
      displayName: params.recipientName.trim(),
      email: cleanEmail,
      role: params.role,
      mustChangePassword: true,
      assignedSiteIds: params.assignedSiteIds,
      status: 'invited',
      inviteToken,
      inviteSentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      notes: params.notes || `Invited as ${params.role} by System Administrator`,
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cpms.zcharge.network';
    const inviteUrl = `${origin}?invite=${inviteToken}&email=${encodeURIComponent(cleanEmail)}`;

    const emailRecord: InviteEmailRecord = {
      id: `email-${Date.now()}`,
      recipientEmail: cleanEmail,
      recipientName: params.recipientName.trim(),
      role: params.role,
      inviteToken,
      inviteUrl,
      sentAt: new Date().toISOString(),
      status: 'delivered',
      assignedSiteNames: params.assignedSiteNames,
      expiresAt,
    };

    // Save user and invite
    await this.saveUserAccount(newAccount);

    const invites = getLocalInvites();
    invites.unshift(emailRecord);
    saveLocalInvites(invites);

    try {
      await setDoc(doc(db, 'invite_emails', emailRecord.id), emailRecord);
    } catch {}

    return { user: newAccount, emailRecord };
  },

  // Assignee accepts invitation and creates their permanent username & password
  async completeInvitationSetup(params: {
    inviteToken: string;
    chosenUsername: string;
    chosenPassword: string;
    displayName?: string;
  }): Promise<{ success: boolean; user?: CpmsUserAccount; error?: string }> {
    const users = getLocalUsers();
    const user = users.find((u) => u.inviteToken === params.inviteToken);

    if (!user) {
      return { success: false, error: 'Invalid or expired invitation token.' };
    }

    const cleanUsername = params.chosenUsername.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }

    // Check username collision (excluding current user id)
    if (users.some((u) => u.id !== user.id && u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `Username "${cleanUsername}" is already taken. Please choose another.` };
    }

    if (params.chosenPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const updatedUser: CpmsUserAccount = {
      ...user,
      username: cleanUsername,
      displayName: params.displayName?.trim() || user.displayName,
      password: params.chosenPassword,
      mustChangePassword: false,
      status: 'active',
      inviteAcceptedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveUserAccount(updatedUser);

    // Update invite status
    const invites = getLocalInvites();
    const inv = invites.find((i) => i.inviteToken === params.inviteToken);
    if (inv) {
      inv.status = 'accepted';
      saveLocalInvites(invites);
    }

    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedUser));
    return { success: true, user: updatedUser };
  },

  // Admin updates user role
  async updateUserRole(userId: string, newRole: UserLevel): Promise<void> {
    const currentCached = this.getCurrentCachedUser();
    // Security check: Only admin can change user level
    if (
      currentCached &&
      currentCached.role !== 'admin' &&
      currentCached.username.toLowerCase() !== 'admin'
    ) {
      throw new Error('Access Denied: Only Admin can change user level.');
    }

    const users = getLocalUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');

    const updated: CpmsUserAccount = {
      ...user,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    await this.saveUserAccount(updated);

    // If updating the active user session, keep cache synchronized
    if (currentCached && currentCached.id === userId) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updated));
    }
  },

  // Admin resets password (forces user to change on next login)
  async resetUserPasswordByAdmin(userId: string, temporaryPassword?: string): Promise<string> {
    const users = getLocalUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    const tempPass = temporaryPassword || `TempPass!${Math.floor(1000 + Math.random() * 9000)}`;
    const updated: CpmsUserAccount = {
      ...user,
      password: tempPass,
      mustChangePassword: true, // Force change on next login
      updatedAt: new Date().toISOString(),
    };
    await this.saveUserAccount(updated);
    return tempPass;
  },

  // Admin deletes user
  async deleteUser(userId: string): Promise<void> {
    const current = getLocalUsers();
    const target = current.find((u) => u.id === userId);
    if (target?.username.toLowerCase() === 'admin') {
      throw new Error('The primary root admin account cannot be deleted.');
    }

    const filtered = current.filter((u) => u.id !== userId);
    saveLocalUsers(filtered);

    try {
      await deleteDoc(doc(db, 'user_accounts', userId));
    } catch {}
  },

  // Toggle user suspension
  async toggleUserSuspension(userId: string): Promise<boolean> {
    const users = getLocalUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    if (user.username.toLowerCase() === 'admin') {
      throw new Error('Primary root administrator cannot be suspended.');
    }

    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const updated: CpmsUserAccount = {
      ...user,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    await this.saveUserAccount(updated);
    return newStatus === 'suspended';
  },

  // Get all invites
  getInvites(): InviteEmailRecord[] {
    return getLocalInvites();
  },

  // Get current cached user session
  getCurrentCachedUser(): CpmsUserAccount | null {
    try {
      const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  },

  clearCurrentCachedUser() {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  },
};
