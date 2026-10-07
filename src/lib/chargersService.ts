import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChargingStation } from '../types';

const CHARGERS_COLLECTION = 'chargers';

/**
 * Save / Add a new or existing charger to Firestore
 */
export const saveChargerToFirestore = async (
  charger: ChargingStation,
  userId?: string,
  userEmail?: string
): Promise<void> => {
  const chargerRef = doc(db, CHARGERS_COLLECTION, charger.id);
  
  // Clean payload for Firestore
  const dataToSave = {
    ...charger,
    isDatabasePersisted: true,
    createdBy: userId || charger.createdBy || 'anonymous',
    createdByUserEmail: userEmail || 'unknown',
    updatedAt: new Date().toISOString(),
    createdAt: charger.createdAt || new Date().toISOString(),
  };

  await setDoc(chargerRef, dataToSave, { merge: true });
};

/**
 * Remove / decommission a charger record from Firestore
 */
export const deleteChargerFromFirestore = async (chargerId: string): Promise<void> => {
  const chargerRef = doc(db, CHARGERS_COLLECTION, chargerId);
  await deleteDoc(chargerRef);
};

/**
 * Real-time subscription to chargers stored in Firestore
 */
export const subscribeToFirestoreChargers = (
  onUpdate: (chargers: ChargingStation[]) => void,
  onError?: (err: Error) => void
) => {
  const q = collection(db, CHARGERS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const dbChargers: ChargingStation[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ChargingStation;
        dbChargers.push({
          ...data,
          id: docSnap.id,
          isDatabasePersisted: true,
        });
      });
      onUpdate(dbChargers);
    },
    (err) => {
      console.warn('Firestore chargers subscription notice:', err.message);
      onError?.(err);
    }
  );
};
