import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

// Claims an invitation only for the address it was sent to. Keeping this in a
// transaction prevents the same invite from being claimed by two accounts.
export async function claimRememberedInvite(user) {
  const invite = getRememberedInvite();
  if (!invite || !user?.email) return null;

  const tripRef = doc(db, 'trips', invite.tripId);
  const inviteRef = doc(db, 'trips', invite.tripId, 'invitations', invite.invitationId);
  const userEmail = user.email.trim().toLowerCase();

  const outcome = await runTransaction(db, async (transaction) => {
    const [tripSnap, inviteSnap] = await Promise.all([
      transaction.get(tripRef),
      transaction.get(inviteRef),
    ]);

    if (!tripSnap.exists()) throw new Error('This trip is no longer available.');
    if (!inviteSnap.exists()) throw new Error('This invitation is invalid or has been removed.');

    const invitation = inviteSnap.data();
    if (String(invitation.email || '').toLowerCase() !== userEmail) {
      throw new Error('Sign in with the email address that received this invitation.');
    }
    if (invitation.status === 'revoked') throw new Error('This invitation has been revoked.');
    if (invitation.acceptedBy && invitation.acceptedBy !== user.uid) {
      throw new Error('This invitation has already been used.');
    }

    const members = tripSnap.data().members || {};
    transaction.update(tripRef, {
      [`members.${user.uid}`]: {
        role: invitation.role || 'guest',
        email: user.email,
      },
    });
    transaction.update(inviteRef, {
      status: 'accepted',
      acceptedBy: user.uid,
      acceptedAt: serverTimestamp(),
    });

    return { tripId: invite.tripId, title: tripSnap.data().title || 'the trip', alreadyMember: Boolean(members[user.uid]) };
  });

  clearRememberedInvite();
  return outcome;
}
