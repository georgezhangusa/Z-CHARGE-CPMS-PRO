import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Site } from '../types';

const SITES_COLLECTION = 'sites';

/**
 * Save / Add a new or existing site to Firestore
 */
export const saveSiteToFirestore = async (
  site: Site,
  userId?: string,
  userEmail?: string
): Promise<void> => {
  const siteRef = doc(db, SITES_COLLECTION, site.id);

  const dataToSave = {
    ...site,
    createdBy: userId || 'operator',
    createdByUserEmail: userEmail || 'unknown',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await setDoc(siteRef, dataToSave, { merge: true });
};

/**
 * Remove a site from Firestore
 */
export const deleteSiteFromFirestore = async (siteId: string): Promise<void> => {
  const siteRef = doc(db, SITES_COLLECTION, siteId);
  await deleteDoc(siteRef);
};

/**
 * Real-time subscription to sites stored in Firestore
 */
export const subscribeToFirestoreSites = (
  onUpdate: (sites: Site[]) => void,
  onError?: (err: Error) => void
) => {
  const q = collection(db, SITES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const dbSites: Site[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Site;
        dbSites.push({
          ...data,
          id: docSnap.id,
        });
      });
      onUpdate(dbSites);
    },
    (err) => {
      console.warn('Firestore sites subscription notice:', err.message);
      onError?.(err);
    }
  );
};
