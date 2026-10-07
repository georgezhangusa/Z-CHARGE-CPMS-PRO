import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || '(default)'
);
export const googleProvider = new GoogleAuthProvider();

export type UserRole =
  | 'admin'
  | 'site_manager'
  | 'technician'
  | 'viewer'
  | 'superadmin'
  | 'operator';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  role: UserRole;
  assignedSiteIds?: string[];
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Multi-Level Access Control (RBAC) Permissions Matrix
export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    canAddCharger: boolean;
    canEditCharger: boolean;
    canDeleteCharger: boolean;
    canTriggerRemoteCommands: boolean; // Start, Stop, Reset, Cable Unlock
    canAdjustPricing: boolean;
    canManageUsers: boolean;
    canManageRoaming: boolean;
    canViewTelemetry: boolean;
    badgeLabel: string;
    badgeColor: string;
    description: string;
  }
> = {
  admin: {
    canAddCharger: true,
    canEditCharger: true,
    canDeleteCharger: true,
    canTriggerRemoteCommands: true,
    canAdjustPricing: true,
    canManageUsers: true,
    canManageRoaming: true,
    canViewTelemetry: true,
    badgeLabel: 'Admin',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    description: 'System Administrator: Full authority over user provisioning, passwords, OCPI roaming, pricing, and stations.',
  },
  site_manager: {
    canAddCharger: true,
    canEditCharger: true,
    canDeleteCharger: true,
    canTriggerRemoteCommands: true,
    canAdjustPricing: true,
    canManageUsers: false,
    canManageRoaming: true,
    canViewTelemetry: true,
    badgeLabel: 'Site Manager',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300 font-bold',
    description: 'Site operations manager: Supervises assigned hub locations, adjusts tariffs, commissions stations, monitors revenue.',
  },
  technician: {
    canAddCharger: true,
    canEditCharger: true,
    canDeleteCharger: false,
    canTriggerRemoteCommands: true, // Diagnostics, resets, soft unlocks
    canAdjustPricing: false,
    canManageUsers: false,
    canManageRoaming: false,
    canViewTelemetry: true,
    badgeLabel: 'Technician',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
    description: 'Field engineer: Adds and provisions hardware, checks ground isolation, soft resets, logs, and diagnostics.',
  },
  viewer: {
    canAddCharger: false,
    canEditCharger: false,
    canDeleteCharger: false,
    canTriggerRemoteCommands: false,
    canAdjustPricing: false,
    canManageUsers: false,
    canManageRoaming: false,
    canViewTelemetry: true,
    badgeLabel: 'Viewer',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
    description: 'Read-only audit: Monitors fleet status, real-time sessions, and OCPI CDR reports without control authority.',
  },
  superadmin: {
    canAddCharger: true,
    canEditCharger: true,
    canDeleteCharger: true,
    canTriggerRemoteCommands: true,
    canAdjustPricing: true,
    canManageUsers: true,
    canManageRoaming: true,
    canViewTelemetry: true,
    badgeLabel: 'Admin',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    description: 'System Administrator: Full authority over user provisioning, passwords, OCPI roaming, pricing, and stations.',
  },
  operator: {
    canAddCharger: true,
    canEditCharger: true,
    canDeleteCharger: true,
    canTriggerRemoteCommands: true,
    canAdjustPricing: true,
    canManageUsers: false,
    canManageRoaming: true,
    canViewTelemetry: true,
    badgeLabel: 'Site Manager',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300 font-bold',
    description: 'Site operations manager: Supervises assigned hub locations, adjusts tariffs, commissions stations, monitors revenue.',
  },
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<UserProfile | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user) return null;

    // Check or create user profile in Firestore
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    // Initial role determination:
    // If user's email matches the app developer/owner, grant superadmin.
    // Otherwise, default to 'operator' for instant evaluation or preserved role.
    const isOwnerEmail =
      user.email?.toLowerCase() === 'gzhang.v@gmail.com' ||
      user.email?.toLowerCase().includes('admin');
    const defaultRole: UserRole = isOwnerEmail ? 'superadmin' : 'operator';

    let profileData: UserProfile;

    if (!snap.exists()) {
      profileData = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || undefined,
        role: defaultRole,
        assignedSiteIds: ['site-houston-03', 'site-austin-hub', 'site-dallas-galleria', 'site-san-antonio'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, profileData);
    } else {
      const existing = snap.data() as UserProfile;
      profileData = {
        ...existing,
        email: user.email || existing.email,
        displayName: user.displayName || existing.displayName,
        photoURL: user.photoURL || existing.photoURL,
        // Upgrade to superadmin if matching owner email
        role: isOwnerEmail ? 'superadmin' : existing.role || 'operator',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, profileData, { merge: true });
    }

    return profileData;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  return fbSignOut(auth);
};
