// src/utils/weeklySummaryGenerator.js
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

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
 * 
 * @param {string} startIso - Start date in ISO string format (inclusive)
 * @param {string} endIso - End date in ISO string format (inclusive)
 * @returns {Promise<{ stats: object, logs: Array }>}
 */
export async function fetchActivitySummaryData(startIso, endIso) {
  const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  const logs = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const createdAt = data.createdAt || (data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : null);
    if (createdAt) {
      if ((!startIso || createdAt >= startIso) && (!endIso || createdAt <= endIso)) {
        logs.push({ id: docSnap.id, ...data, createdAt });
      }
    }
  });

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
    const { stats, logs } = await fetchActivitySummaryData(startIso, endIso);

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
