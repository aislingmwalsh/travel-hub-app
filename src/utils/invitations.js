import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const INVITE_STORAGE_KEY = 'travelHubPendingInvite';

export function rememberInviteFromUrl(url = window.location.href) {
  const params = new URL(url).searchParams;
  const tripId = params.get('trip');
  const invitationId = params.get('invite');

  if (!tripId || !invitationId) return null;

  const invite = { tripId, invitationId };
  window.localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(invite));
  return invite;
}

export function getRememberedInvite() {
  try {
    const rawInvite = window.localStorage.getItem(INVITE_STORAGE_KEY);
    return rawInvite ? JSON.parse(rawInvite) : null;
  } catch {
    window.localStorage.removeItem(INVITE_STORAGE_KEY);
    return null;
  }
}

export function clearRememberedInvite() {
  window.localStorage.removeItem(INVITE_STORAGE_KEY);
}

// Claims an invitation using the secure Cloud Function to bypass client-side database rules restrictions.
export async function claimRememberedInvite(user) {
  const invite = getRememberedInvite();
  if (!invite || !user?.email) return null;

  try {
    const acceptInviteFn = httpsCallable(functions, 'acceptTripInvitation');
    const result = await acceptInviteFn({
      tripId: invite.tripId,
      invitationId: invite.invitationId
    });

    return result.data;
  } catch (error) {
    console.error('Cloud Function error accepting invite:', error);
    throw new Error(error.message || 'Unable to accept this trip invitation.');
  } finally {
    clearRememberedInvite();
  }
}
