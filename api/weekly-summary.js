// api/weekly-summary.js
// Vercel Serverless Function triggered by Vercel Cron every Monday at 09:00 UTC

export default async function handler(req, res) {
  // Allow GET from Vercel Cron or POST for manual trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: check CRON_SECRET if configured in Vercel environment variables
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Vercel sets a special header on cron requests
    const isVercelCron = req.headers['user-agent']?.includes('vercel-cron');
    if (!isVercelCron) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const PROJECT_ID = 'travel-hub-app-4d314';
  const TARGET_EMAIL = 'away@homeincork.com';
  const DAYS = 7;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS);
    const cutoffIso = cutoffDate.toISOString();

    // 1. Fetch activity logs via Firestore REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/activity_logs?pageSize=300`;
    const response = await fetch(firestoreUrl);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to fetch activity logs from Firestore:', errText);
      return res.status(500).json({ error: 'Failed to fetch logs', details: errText });
    }

    const data = await response.json();
    const rawDocuments = data.documents || [];

    // Parse and filter last 7 days
    const logs = [];
    rawDocuments.forEach(doc => {
      const fields = doc.fields || {};
      const createdAt = fields.createdAt?.stringValue || fields.timestamp?.timestampValue || '';
      
      if (createdAt && createdAt >= cutoffIso) {
        logs.push({
          userName: fields.userName?.stringValue || 'Someone',
          summary: fields.summary?.stringValue || 'performed an action',
          action: fields.action?.stringValue || '',
          userEmail: fields.userEmail?.stringValue || '',
          createdAt: createdAt
        });
      }
    });

    // Sort newest first
    logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // 2. Compute stats
    const stats = {
      tripsCreated: 0,
      membersInvited: 0,
      itineraryAdded: 0,
      itineraryModified: 0,
      packingActions: 0,
      vaultLinksAdded: 0,
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
    });

    const startDateFormatted = cutoffDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDateFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // 3. Build HTML & Text content
    const timelineHtml = logs.length > 0
      ? logs.slice(0, 50).map(log => {
          const time = new Date(log.createdAt).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `<li style="margin-bottom: 8px; color: #334155; font-size: 13px;">
            <span style="color: #64748b; font-size: 11px;">[${time}]</span> 
            <strong>${escapeHtml(log.userName)}</strong>: ${escapeHtml(log.summary)}
          </li>`;
        }).join('')
      : `<li style="color: #94a3b8; font-style: italic; font-size: 13px;">No new user activity recorded in the past ${DAYS} days.</li>`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 24px; text-align: left;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">✈️ Away from Home: Weekly Activity Digest</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Reporting Period: <strong>${startDateFormatted}</strong> to <strong>${endDateFormatted}</strong></p>
        </div>

        <div style="padding: 24px;">
          <h2 style="color: #1e293b; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 16px;">📊 Weekly Usage Highlights</h2>
          
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

          <h2 style="color: #1e293b; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">📝 Recent Activity Timeline (${logs.length} events)</h2>
          <ul style="padding-left: 18px; margin: 0; line-height: 1.5;">
            ${timelineHtml}
          </ul>

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent automatically by Away from Home weekly Vercel Cron.
          </div>
        </div>
      </div>
    `;

    const emailText = `Away from Home: Weekly Activity Digest (${startDateFormatted} - ${endDateFormatted})\n\n`
      + `Highlights:\n`
      + `- Trips Created: ${stats.tripsCreated}\n`
      + `- Collaborators Invited: ${stats.membersInvited}\n`
      + `- Itinerary Items Added: ${stats.itineraryAdded}\n`
      + `- Packing List Actions: ${stats.packingActions}\n`
      + `- Total Events: ${stats.totalEvents}\n\n`
      + `Recent Activity:\n`
      + logs.map(l => `* ${l.userName}: ${l.summary}`).join('\n');

    // 4. Queue email document into Firestore /mail via REST API
    const mailPayload = {
      fields: {
        to: { stringValue: TARGET_EMAIL },
        from: { stringValue: '"Away from Home: Travel Planner" <away@homeincork.com>' },
        replyTo: { stringValue: 'away@homeincork.com' },
        senderUid: { stringValue: 'vercel_cron' },
        createdAt: { timestampValue: new Date().toISOString() },
        message: {
          mapValue: {
            fields: {
              subject: { stringValue: `📊 Weekly Activity Digest: ${stats.totalEvents} events (${startDateFormatted} - ${endDateFormatted})` },
              html: { stringValue: emailHtml },
              text: { stringValue: emailText }
            }
          }
        }
      }
    };

    const mailPostUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/mail`;
    const mailResponse = await fetch(mailPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailPayload)
    });

    if (!mailResponse.ok) {
      const mailErr = await mailResponse.text();
      console.error('Failed to queue mail document:', mailErr);
      return res.status(500).json({ error: 'Failed to queue mail', details: mailErr });
    }

    return res.status(200).json({
      success: true,
      message: `Weekly activity digest queued for ${TARGET_EMAIL}`,
      stats,
      eventsCount: logs.length
    });
  } catch (err) {
    console.error('Weekly summary error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}
