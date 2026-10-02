// src/utils/activityLogger.js
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Non-blocking activity logger for tracking high-level application events.
 * 
 * @param {string} action - Event type key (e.g. 'trip_created', 'member_invited', 'itinerary_added')
 * @param {string} summary - Human-readable summary (e.g. 'Aisling created a trip "Rome Summer" and invited Leon')
 * @param {object} [metadata] - Optional additional context (tripId, count, role, etc.)
 */
export async function logActivity(action, summary, metadata = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Resolve user display name from auth or email
    const userName = user.displayName || (user.email ? user.email.split('@')[0] : 'Someone');

    await addDoc(collection(db, 'activity_logs'), {
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email || '',
      userName: userName,
      action: action,
      summary: summary,
      metadata: metadata || {}
    });
  } catch (err) {
    // Non-blocking fire-and-forget: fail silently so UI is never interrupted
    console.warn('Activity logging skipped:', err);
  }
}
