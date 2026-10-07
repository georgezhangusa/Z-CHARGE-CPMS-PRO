import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  UserProfile,
  UserRole,
  ROLE_PERMISSIONS,
} from './firebase';
import { authService, INITIAL_ADMIN_ACCOUNT } from './authService';
import { CpmsUserAccount, UserLevel, InviteEmailRecord } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  currentAccount: CpmsUserAccount | null;
  role: UserRole;
  userLevel: UserLevel;
  isAdmin: boolean;
  permissions: (typeof ROLE_PERMISSIONS)['admin'];
  loading: boolean;
  mustChangePassword: boolean;
  isAdminPasswordChanged: boolean;
  isRegularLoginOpen: boolean;
  openRegularLogin: () => void;
  closeRegularLogin: () => void;
  activeInviteToken: string | null;
  signIn: () => Promise<UserProfile | null>;
  signInWithCredentials: (username: string, password: string) => { success: boolean; user?: CpmsUserAccount; error?: string };
  signOut: () => Promise<void>;
  switchRoleForDemo: (newRole: UserRole) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  completeInvitation: (params: {
    inviteToken: string;
    chosenUsername: string;
    chosenPassword: string;
    displayName?: string;
  }) => Promise<{ success: boolean; error?: string; user?: CpmsUserAccount }>;
  clearActiveInvite: () => void;
  openInviteForToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Check if initial admin password has been customized already
  const adminChanged = authService.isAdminPasswordChanged();

  const [currentAccount, setCurrentAccount] = useState<CpmsUserAccount | null>(() => {
    const isChanged = authService.isAdminPasswordChanged();
    const cached = authService.getCurrentCachedUser();
    if (cached) return cached;
    // Only default to INITIAL_ADMIN_ACCOUNT (with mustChangePassword: true) if password NOT changed yet
    if (!isChanged) return INITIAL_ADMIN_ACCOUNT;
    return null;
  });

  // If default admin password was changed already and no active cached session on re-open, show regular login window!
  const [isRegularLoginOpen, setIsRegularLoginOpen] = useState<boolean>(() => {
    const isChanged = authService.isAdminPasswordChanged();
    const cached = authService.getCurrentCachedUser();
    return isChanged && !cached;
  });

  const [loading, setLoading] = useState(true);
  const [activeInviteToken, setActiveInviteToken] = useState<string | null>(null);

  // Check URL params on initial load for ?invite=token
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const invite = urlParams.get('invite');
      if (invite) {
        setActiveInviteToken(invite);
      }
    } catch {}
  }, []);

  // Compute effective role & permissions
  const effectiveRole: UserRole = useMemo(() => {
    if (currentAccount) {
      if (currentAccount.role === 'admin') return 'admin';
      if (currentAccount.role === 'site_manager') return 'site_manager';
      if (currentAccount.role === 'technician') return 'technician';
      if (currentAccount.role === 'viewer') return 'viewer';
    }
    if (userProfile?.role) {
      if (userProfile.role === 'superadmin') return 'admin';
      if (userProfile.role === 'operator') return 'site_manager';
      return userProfile.role;
    }
    return 'viewer';
  }, [currentAccount, userProfile]);

  const userLevel: UserLevel = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'superadmin') return 'admin';
    if (effectiveRole === 'site_manager' || effectiveRole === 'operator') return 'site_manager';
    if (effectiveRole === 'technician') return 'technician';
    return 'viewer';
  }, [effectiveRole]);

  const isAdmin: boolean = useMemo(() => {
    return (
      (userLevel === 'admin' || effectiveRole === 'admin' || effectiveRole === 'superadmin') &&
      Boolean(currentAccount || currentUser || userProfile)
    );
  }, [userLevel, effectiveRole, currentAccount, currentUser, userProfile]);

  const permissions = useMemo(() => {
    return ROLE_PERMISSIONS[effectiveRole] || ROLE_PERMISSIONS['viewer'];
  }, [effectiveRole]);

  // If admin password has already been changed, never force password change on 1st login window
  const isAdminPasswordChangedState = authService.isAdminPasswordChanged();
  const mustChangePassword = Boolean(currentAccount?.mustChangePassword) && !isAdminPasswordChangedState;

  // Sync Firebase Auth (if user signs in with Google)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            } else {
              const isOwner =
                user.email?.toLowerCase() === 'gzhang.v@gmail.com' ||
                user.email?.toLowerCase().includes('admin');
              const initial: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'CPMS Administrator',
                photoURL: user.photoURL || undefined,
                role: isOwner ? 'admin' : 'site_manager',
                assignedSiteIds: ['site-houston-03', 'site-austin-hub', 'site-dallas-galleria', 'site-san-antonio'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setDoc(userRef, initial).catch((err) => console.warn('Profile write:', err));
              setUserProfile(initial);
            }
            setLoading(false);
          },
          (err) => {
            console.warn('Profile listener notice:', err);
            setLoading(false);
          }
        );
        return () => unsubscribeDoc();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Username and password sign in
  const signInWithCredentials = useCallback(
    (usernameInput: string, passwordInput: string) => {
      const res = authService.loginWithUsernamePassword(usernameInput, passwordInput);
      if (res.success && res.user) {
        setCurrentAccount(res.user);
        setIsRegularLoginOpen(false);
      }
      return res;
    },
    []
  );

  // Change password for current account
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!currentAccount) {
        return { success: false, error: 'No user account currently logged in.' };
      }
      const res = await authService.changePassword(currentAccount.id, oldPassword, newPassword);
      if (res.success && res.user) {
        setCurrentAccount(res.user);
      }
      return res;
    },
    [currentAccount]
  );

  // Assignee completing invitation
  const completeInvitation = useCallback(
    async (params: {
      inviteToken: string;
      chosenUsername: string;
      chosenPassword: string;
      displayName?: string;
    }) => {
      const res = await authService.completeInvitationSetup(params);
      if (res.success && res.user) {
        setCurrentAccount(res.user);
        setActiveInviteToken(null);
        setIsRegularLoginOpen(false);
      }
      return res;
    },
    []
  );

  // Sign out
  const handleSignOut = useCallback(async () => {
    authService.clearCurrentCachedUser();
    setCurrentAccount(null);
    if (currentUser) {
      await signOutUser();
    }
    // Show regular login window on logout
    setIsRegularLoginOpen(true);
  }, [currentUser]);

  // Role demo switch
  const switchRoleForDemo = useCallback(
    async (newRole: UserRole) => {
      // Security check: only admin can change user level
      const isAuthorized =
        isAdmin ||
        currentAccount?.username?.toLowerCase() === 'admin' ||
        userProfile?.role === 'admin' ||
        userProfile?.role === 'superadmin';

      if (!isAuthorized) {
        throw new Error('Access Denied: Only Admin can change user level.');
      }

      const targetLevel: UserLevel =
        newRole === 'superadmin' || newRole === 'admin'
          ? 'admin'
          : newRole === 'operator' || newRole === 'site_manager'
          ? 'site_manager'
          : newRole === 'technician'
          ? 'technician'
          : 'viewer';

      if (currentAccount) {
        const updated: CpmsUserAccount = {
          ...currentAccount,
          role: targetLevel,
          updatedAt: new Date().toISOString(),
        };
        await authService.saveUserAccount(updated);
        setCurrentAccount(updated);
      }

      if (currentUser && userProfile) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { ...userProfile, role: newRole, updatedAt: new Date().toISOString() }, { merge: true });
      }
    },
    [currentAccount, currentUser, userProfile]
  );

  const clearActiveInvite = useCallback(() => {
    setActiveInviteToken(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  const openInviteForToken = useCallback((token: string) => {
    setActiveInviteToken(token);
  }, []);

  const openRegularLogin = useCallback(() => {
    setIsRegularLoginOpen(true);
  }, []);

  const closeRegularLogin = useCallback(() => {
    setIsRegularLoginOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        currentAccount,
        role: effectiveRole,
        userLevel,
        isAdmin,
        permissions,
        loading,
        mustChangePassword,
        isAdminPasswordChanged: isAdminPasswordChangedState,
        isRegularLoginOpen,
        openRegularLogin,
        closeRegularLogin,
        activeInviteToken,
        signIn: signInWithGoogle,
        signInWithCredentials,
        signOut: handleSignOut,
        switchRoleForDemo,
        changePassword,
        completeInvitation,
        clearActiveInvite,
        openInviteForToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
