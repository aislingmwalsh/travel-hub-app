// src/utils/weeklySummaryGenerator.js
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, addDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';

/**
 * Finds the earliest recorded activity or trip creation date in Firestore.
 * 
 * @param {object} [user] - Current Firebase user object
 * @returns {Promise<string>} ISO date string of earliest recorded item
 */
export async function findEarliestActivityDate(user = auth.currentUser) {
  const dates = [];

  try {
    // 1. Check activity_logs
    const logQ = query(collection(db, 'activity_logs'), orderBy('createdAt', 'asc'), limit(1));
    const logSnap = await getDocs(logQ);
    if (!logSnap.empty) {
      const data = logSnap.docs[0].data();
      const c = data.createdAt || (data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : null);
      if (c) dates.push(c);
    }
  } catch (err) {
    console.warn('Could not query earliest activity log:', err);
  }

  const ADMIN_EMAILS = ['away@homeincork.com', 'aislingmwalsh@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase());

  try {
    // 2. Check trips
    let tripDocs = [];
    if (isAdmin) {
      try {
        const allSnap = await getDocs(collection(db, "trips"));
        tripDocs = allSnap.docs;
      } catch (e) {
        console.warn("Admin trip fetch fallback:", e);
      }
    }

    if (tripDocs.length === 0 && user?.uid) {
      const qCreated = query(collection(db, "trips"), where("createdBy", "==", user.uid));
      const qMember = query(collection(db, "trips"), where(`members.${user.uid}`, "!=", null));
      const [snapCreated, snapMember] = await Promise.all([getDocs(qCreated), getDocs(qMember)]);
      const tripMap = new Map();
      snapCreated.docs.forEach(d => tripMap.set(d.id, d));
      snapMember.docs.forEach(d => tripMap.set(d.id, d));
      tripDocs = Array.from(tripMap.values());
    }

    tripDocs.forEach(d => {
      const data = d.data();
      if (data.createdAt) {
        const c = data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : null);
        if (c) dates.push(c);
      }
      if (data.startDate) {
        dates.push(`${data.startDate}T00:00:00.000Z`);
      }
    });
  } catch (err) {
    console.warn('Could not query earliest trip:', err);
  }

  // Filter valid dates and sort ascending (oldest first)
  const validDates = dates.filter(d => d && !isNaN(new Date(d).getTime())).sort((a, b) => new Date(a) - new Date(b));

  if (validDates.length > 0) {
    return validDates[0];
  }

  return '2026-08-01T00:00:00.000Z';
}

/**
 * Returns a list of discrete Monday-to-Sunday weekly intervals from the earliest recorded date up to the current week.
 * 
 * @param {string|Date} [earliestDateInput] - Earliest date to anchor the first available week. Defaults to 60 days ago or 2026-08-01.
 * @returns {Array<{ key: string, label: string, startIso: string, endIso: string, startFormatted: string, endFormatted: string, isCurrent: boolean }>}
 */
export function generateWeeklyIntervals(earliestDateInput) {
  const now = new Date();

  // Find Monday of the current week (ISO 8601 week start)
  const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const currentWeekMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday, 0, 0, 0, 0));

  // Determine earliest boundary
  let earliest;
  if (earliestDateInput) {
    earliest = new Date(earliestDateInput);
    if (isNaN(earliest.getTime())) earliest = new Date(Date.UTC(2026, 7, 1)); // Default Aug 1, 2026
  } else {
    earliest = new Date(Date.UTC(2026, 7, 1)); // Default Aug 1, 2026
  }

  const intervals = [];
  let iterMonday = new Date(currentWeekMonday);
  let index = 0;

  while (iterMonday >= earliest || index === 0) {
    const iterSunday = new Date(iterMonday);
    iterSunday.setUTCDate(iterSunday.getUTCDate() + 6);
    iterSunday.setUTCHours(23, 59, 59, 999);

    const startFormatted = iterMonday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endFormatted = iterSunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

    let label = `${startFormatted} – ${endFormatted}`;
    if (index === 0) {
      label = `This Week (${startFormatted} – ${endFormatted}) [Current]`;
    } else if (index === 1) {
      label = `Last Week (${startFormatted} – ${endFormatted})`;
    }

    intervals.push({
      key: `${iterMonday.toISOString().split('T')[0]}_${iterSunday.toISOString().split('T')[0]}`,
      label,
      startIso: iterMonday.toISOString(),
      endIso: iterSunday.toISOString(),
      startFormatted,
      endFormatted,
      isCurrent: index === 0
    });

    // Move to previous Monday
    iterMonday = new Date(iterMonday);
    iterMonday.setUTCDate(iterMonday.getUTCDate() - 7);
    index++;

    // Safety guard to avoid runaway loops
    if (index > 104) break; // Max 2 years
  }

  return intervals;
}

/**
 * Fetches activity logs within a given date range and returns computed metrics and log items.
 * Seamlessly merges /activity_logs with historical trips and subcollections for comprehensive auditing.
 * 
 * @param {string} startIso - Start date in ISO string format (inclusive)
 * @param {string} endIso - End date in ISO string format (inclusive)
 * @param {object} [user=auth.currentUser] - Current authenticated user
 * @returns {Promise<{ stats: object, logs: Array }>}
 */
export async function fetchActivitySummaryData(startIso, endIso, user = auth.currentUser) {
  const logs = [];
  const seenEventKeys = new Set();

  // 1. Fetch from activity_logs collection
  try {
    const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt || (data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : null);
      if (createdAt) {
        if ((!startIso || createdAt >= startIso) && (!endIso || createdAt <= endIso)) {
          const key = `${data.action}_${data.tripId || ''}_${data.summary || ''}_${createdAt.split('T')[0]}`;
          seenEventKeys.add(key);
          logs.push({ id: docSnap.id, ...data, createdAt });
        }
      }
    });
  } catch (err) {
    console.warn('Error reading activity_logs:', err);
  }

  // 2. Synthesize historical logs from existing Firestore trips & subcollections
  try {
    const ADMIN_EMAILS = ['away@homeincork.com', 'aislingmwalsh@gmail.com'];
    const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase());

    let userTrips = [];
    if (isAdmin) {
      try {
        const allSnap = await getDocs(collection(db, "trips"));
        userTrips = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn("Admin trip fetch fallback:", e);
      }
    }

    if (userTrips.length === 0 && user?.uid) {
      const qCreated = query(collection(db, "trips"), where("createdBy", "==", user.uid));
      const qMember = query(collection(db, "trips"), where(`members.${user.uid}`, "!=", null));
      const [snapCreated, snapMember] = await Promise.all([getDocs(qCreated), getDocs(qMember)]);

      const tripMap = new Map();
      snapCreated.docs.forEach(d => tripMap.set(d.id, { id: d.id, ...d.data() }));
      snapMember.docs.forEach(d => tripMap.set(d.id, { id: d.id, ...d.data() }));
      userTrips = Array.from(tripMap.values());
    }

      function getTripMemberName(t, uid) {
        if (!t || !uid) return null;
        if (t.members && t.members[uid]) {
          const m = t.members[uid];
          if (typeof m === 'object') {
            return m.displayName || m.name || (m.email ? m.email.split('@')[0] : null);
          }
        }
        return null;
      }

      function getTripOwnerName(t, fallbackUser = null) {
        if (!t) return 'Trip Organizer';
        if (fallbackUser && t.createdBy === fallbackUser.uid) {
          return fallbackUser.displayName || (fallbackUser.email ? fallbackUser.email.split('@')[0] : 'Trip Organizer');
        }
        if (t.createdBy && t.members && t.members[t.createdBy]) {
          const m = t.members[t.createdBy];
          if (typeof m === 'object') {
            const name = m.displayName || m.name || (m.email ? m.email.split('@')[0] : null);
            if (name) return name;
          }
        }
        if (t.members) {
          for (const [, mVal] of Object.entries(t.members)) {
            if (typeof mVal === 'object' && (mVal.role === 'owner' || mVal.role === 'admin')) {
              const name = mVal.displayName || mVal.name || (mVal.email ? mVal.email.split('@')[0] : null);
              if (name) return name;
            }
          }
          for (const [, mVal] of Object.entries(t.members)) {
            if (typeof mVal === 'object' && mVal.email) {
              return mVal.displayName || mVal.name || mVal.email.split('@')[0];
            }
          }
        }
        if (t.createdByName) return t.createdByName;
        if (t.creatorEmail) return t.creatorEmail.split('@')[0];
        return 'Trip Organizer';
      }

      for (const trip of userTrips) {
        const tripOwnerName = getTripOwnerName(trip, user);
        let creatorEmail = '';
        if (trip.createdBy === user?.uid) {
          creatorEmail = user.email || '';
        } else if (trip.members && trip.createdBy && trip.members[trip.createdBy]?.email) {
          creatorEmail = trip.members[trip.createdBy].email;
        } else if (trip.creatorEmail) {
          creatorEmail = trip.creatorEmail;
        }

        // A. Trip creation event
        let tripCreatedAt = null;
        if (trip.createdAt) {
          tripCreatedAt = trip.createdAt.toDate ? trip.createdAt.toDate().toISOString() : (typeof trip.createdAt === 'string' ? trip.createdAt : null);
        }
        if (!tripCreatedAt && trip.startDate) {
          tripCreatedAt = `${trip.startDate}T09:00:00.000Z`;
        }

        if (tripCreatedAt && (!startIso || tripCreatedAt >= startIso) && (!endIso || tripCreatedAt <= endIso)) {
          const key = `trip_created_${trip.id}`;
          const summary = `Created trip "${trip.title || 'Untitled Trip'}"${trip.destination ? ` (${trip.destination})` : ''}`;
          const duplicateKey = `trip_created_${trip.id}_${summary}_${tripCreatedAt.split('T')[0]}`;
          if (!seenEventKeys.has(key) && !seenEventKeys.has(duplicateKey)) {
            seenEventKeys.add(key);
            logs.push({
              id: `historical-trip-${trip.id}`,
              action: 'trip_created',
              userName: tripOwnerName,
              userEmail: creatorEmail,
              summary: summary,
              tripId: trip.id,
              createdAt: tripCreatedAt
            });
          }
        }

        // Fetch subcollections in parallel
        try {
          const [itinSnap, invSnap, vaultSnap, packingSnap] = await Promise.all([
            getDocs(collection(db, 'trips', trip.id, 'itinerary')),
            getDocs(collection(db, 'trips', trip.id, 'invitations')),
            getDocs(collection(db, 'trips', trip.id, 'vault')),
            getDoc(doc(db, 'trips', trip.id, 'settings', 'packing_list'))
          ]);

          // B. Invitations
          invSnap.docs.forEach(invDoc => {
            const inv = invDoc.data();
            let invCreatedAt = inv.createdAt?.toDate ? inv.createdAt.toDate().toISOString() : (inv.createdAt || tripCreatedAt);
            if (invCreatedAt && (!startIso || invCreatedAt >= startIso) && (!endIso || invCreatedAt <= endIso)) {
              const key = `member_invited_${trip.id}_${inv.email}`;
              if (!seenEventKeys.has(key)) {
                seenEventKeys.add(key);
                const inviterName = inv.inviterName
                  || (inv.inviterEmail ? inv.inviterEmail.split('@')[0] : null)
                  || (inv.inviterUid ? getTripMemberName(trip, inv.inviterUid) : null)
                  || tripOwnerName;
                logs.push({
                  id: `historical-inv-${invDoc.id}`,
                  action: 'member_invited',
                  userName: inviterName,
                  userEmail: inv.inviterEmail || '',
                  summary: `Invited ${inv.email} as ${inv.role || 'collaborator'} to "${trip.title}"`,
                  tripId: trip.id,
                  invitedEmail: inv.email,
                  role: inv.role,
                  createdAt: invCreatedAt
                });
              }
            }
          });

          // C. Itinerary Activities
          itinSnap.docs.forEach(itemDoc => {
            const item = itemDoc.data();
            let itemCreatedAt = item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : (item.createdAt || (item.date ? `${item.date}T10:00:00.000Z` : tripCreatedAt));
            if (itemCreatedAt && (!startIso || itemCreatedAt >= startIso) && (!endIso || itemCreatedAt <= endIso)) {
              const key = `itinerary_${trip.id}_${itemDoc.id}`;
              if (!seenEventKeys.has(key)) {
                seenEventKeys.add(key);
                const isLuggage = item.category === 'luggage' || item.title?.toLowerCase().includes('luggage');
                const authorName = item.addedByName 
                  || (item.createdBy ? getTripMemberName(trip, item.createdBy) : null)
                  || (item.createdBy && item.createdBy === user?.uid ? (user.displayName || user.email?.split('@')[0]) : null)
                  || tripOwnerName;
                logs.push({
                  id: `historical-itinerary-${itemDoc.id}`,
                  action: isLuggage ? 'luggage_drop_added' : 'itinerary_added',
                  userName: authorName,
                  summary: `Added activity "${item.title || 'Activity'}" to "${trip.title}"${item.date ? ` (${item.date})` : ''}`,
                  tripId: trip.id,
                  itemId: itemDoc.id,
                  createdAt: itemCreatedAt
                });
              }
            }
          });

          // D. Vault items
          vaultSnap.docs.forEach(vDoc => {
            const v = vDoc.data();
            let vCreatedAt = v.createdAt?.toDate ? v.createdAt.toDate().toISOString() : (v.createdAt || tripCreatedAt);
            if (vCreatedAt && (!startIso || vCreatedAt >= startIso) && (!endIso || vCreatedAt <= endIso)) {
              const key = `vault_${trip.id}_${vDoc.id}`;
              if (!seenEventKeys.has(key)) {
                seenEventKeys.add(key);
                const vaultAuthor = v.addedByName 
                  || (v.createdBy ? getTripMemberName(trip, v.createdBy) : null)
                  || (v.createdBy && v.createdBy === user?.uid ? (user.displayName || user.email?.split('@')[0]) : null)
                  || tripOwnerName;
                logs.push({
                  id: `historical-vault-${vDoc.id}`,
                  action: 'vault_link_added',
                  userName: vaultAuthor,
                  summary: `Added link "${v.title || 'Document'}" to "${trip.title}" vault`,
                  tripId: trip.id,
                  createdAt: vCreatedAt
                });
              }
            }
          });

          // E. Packing List
          if (packingSnap.exists()) {
            const pData = packingSnap.data();
            let pCreatedAt = pData.createdAt?.toDate ? pData.createdAt.toDate().toISOString() : (pData.createdAt || tripCreatedAt);
            if (pCreatedAt && (!startIso || pCreatedAt >= startIso) && (!endIso || pCreatedAt <= endIso)) {
              const key = `packing_${trip.id}`;
              if (!seenEventKeys.has(key)) {
                seenEventKeys.add(key);
                const packingAuthor = pData.updatedByName 
                  || pData.addedByName 
                  || (pData.createdBy ? getTripMemberName(trip, pData.createdBy) : null)
                  || (pData.createdBy && pData.createdBy === user?.uid ? (user.displayName || user.email?.split('@')[0]) : null)
                  || tripOwnerName;
                logs.push({
                  id: `historical-packing-${trip.id}`,
                  action: 'packing_list_created',
                  userName: packingAuthor,
                  summary: `Created packing list for "${trip.title}"`,
                  tripId: trip.id,
                  createdAt: pCreatedAt
                });
              }
            }
          }
        } catch (subErr) {
          console.warn(`Error reading subcollections for trip ${trip.id}:`, subErr);
        }
      }
  } catch (err) {
    console.warn('Error synthesizing historical logs from trips:', err);
  }

  // Sort newest first
  logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Calculate statistics
  const stats = {
    tripsCreated: 0,
    membersInvited: 0,
    itineraryAdded: 0,
    itineraryModified: 0,
    packingActions: 0,
    vaultLinksAdded: 0,
    otherActions: 0,
    totalEvents: logs.length
  };

  logs.forEach(log => {
    const act = log.action || '';
    if (act.includes('trip_created')) stats.tripsCreated++;
    else if (act.includes('member_invited') || act.includes('member_joined')) stats.membersInvited++;
    else if (act.includes('itinerary_added') || act.includes('luggage_drop_added')) stats.itineraryAdded++;
    else if (act.includes('itinerary_updated') || act.includes('itinerary_deleted')) stats.itineraryModified++;
    else if (act.includes('packing')) stats.packingActions++;
    else if (act.includes('vault')) stats.vaultLinksAdded++;
    else stats.otherActions++;
  });

  return { stats, logs };
}

/**
 * Aggregates activity logs for a specified week and queues a weekly digest email to away@homeincork.com.
 * 
 * @param {object} [options]
 * @param {string} [options.targetEmail='away@homeincork.com'] - Recipient email
 * @param {string} [options.startIso] - Start of the reporting period (ISO string)
 * @param {string} [options.endIso] - End of the reporting period (ISO string)
 * @param {string} [options.customLabel] - Optional display label for the period
 * @returns {Promise<{ success: boolean, message: string, stats: object, logCount: number }>}
 */
export async function generateAndSendWeeklySummary(options = {}) {
  const targetEmail = options.targetEmail || 'away@homeincork.com';
  
  let startIso = options.startIso;
  let endIso = options.endIso;

  // Default to past 7 days if no explicit date range provided
  if (!startIso || !endIso) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (options.days || 7));
    startIso = cutoffDate.toISOString();
    endIso = new Date().toISOString();
  }

  try {
    const user = options.user || auth.currentUser;
    const { stats, logs } = await fetchActivitySummaryData(startIso, endIso, user);

    const startDateFormatted = new Date(startIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endDateFormatted = new Date(endIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const periodHeading = options.customLabel || `${startDateFormatted} to ${endDateFormatted}`;

    // Build timeline items (most recent first, up to 60 items for readability)
    const timelineHtml = logs.length > 0
      ? logs.slice(0, 60).map(log => {
          const time = new Date(log.createdAt).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `<li style="margin-bottom: 8px; color: #334155; font-size: 13px;">
            <span style="color: #64748b; font-size: 11px;">[${time}]</span> 
            <strong>${escapeHtml(log.userName || 'A user')}</strong>: ${escapeHtml(log.summary || 'performed an action')}
          </li>`;
        }).join('')
      : `<li style="color: #94a3b8; font-style: italic; font-size: 13px;">No new user activity recorded for this period.</li>`;

    // Construct responsive HTML email
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 24px; text-align: left;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">✈️ Away from Home: Weekly Activity Digest</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Reporting Period: <strong>${periodHeading}</strong></p>
        </div>

        <div style="padding: 24px;">
          <h2 style="color: #1e293b; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 16px;">📊 Usage Highlights</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
              <div style="font-size: 24px; font-weight: 800; color: #2563eb;">${stats.tripsCreated}</div>
              <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Trips Created</div>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
              <div style="font-size: 24px; font-weight: 800; color: #7c3aed;">${stats.membersInvited}</div>
              <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Collaborators Invited</div>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
              <div style="font-size: 24px; font-weight: 800; color: #059669;">${stats.itineraryAdded}</div>
              <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Itinerary Items Added</div>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
              <div style="font-size: 24px; font-weight: 800; color: #d97706;">${stats.packingActions}</div>
              <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Packing List Actions</div>
            </div>
          </div>

          <h2 style="color: #1e293b; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">📝 Activity Timeline (${logs.length} events)</h2>
          <ul style="padding-left: 18px; margin: 0; line-height: 1.5;">
            ${timelineHtml}
          </ul>

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent by Away from Home: Travel Planner Activity Reporter.
          </div>
        </div>
      </div>
    `;

    const emailText = `Away from Home: Weekly Activity Digest (${periodHeading})\n\n`
      + `Highlights:\n`
      + `- Trips Created: ${stats.tripsCreated}\n`
      + `- Collaborators Invited: ${stats.membersInvited}\n`
      + `- Itinerary Items Added: ${stats.itineraryAdded}\n`
      + `- Packing List Actions: ${stats.packingActions}\n`
      + `- Total Events: ${stats.totalEvents}\n\n`
      + `Activity Timeline:\n`
      + logs.map(l => `* ${l.userName}: ${l.summary}`).join('\n');

    // Queue email to Firestore /mail collection
    await addDoc(collection(db, 'mail'), {
      to: targetEmail,
      from: '"Away from Home: Travel Planner" <away@homeincork.com>',
      replyTo: 'away@homeincork.com',
      senderUid: auth.currentUser?.uid || 'cron_system',
      createdAt: serverTimestamp(),
      message: {
        subject: `📊 Weekly Activity Digest: ${stats.totalEvents} events (${periodHeading})`,
        html: emailHtml,
        text: emailText
      }
    });

    return {
      success: true,
      message: `Weekly summary email for "${periodHeading}" queued for ${targetEmail}.`,
      stats,
      logCount: logs.length
    };
  } catch (err) {
    console.error('Error generating weekly summary:', err);
    throw err;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}
