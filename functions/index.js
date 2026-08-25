const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();
const FUNCTION_REGION = 'us-central1';

function requiredId(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value.length > 256) {
    throw new HttpsError('invalid-argument', `${name} is invalid.`);
  }
  return value;
}

exports.acceptTripInvitation = onCall({ region: FUNCTION_REGION }, async (request) => {
  if (!request.auth?.uid || !request.auth.token.email || !request.auth.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Sign in with a verified email address to accept an invitation.');
  }

  const tripId = requiredId(request.data?.tripId, 'Trip ID');
  const invitationId = requiredId(request.data?.invitationId, 'Invitation ID');
  const userEmail = String(request.auth.token.email).trim().toLowerCase();
  const tripRef = db.collection('trips').doc(tripId);
  const invitationRef = tripRef.collection('invitations').doc(invitationId);

  try {
    return await db.runTransaction(async (transaction) => {
      const [tripSnap, invitationSnap] = await Promise.all([
        transaction.get(tripRef),
        transaction.get(invitationRef),
      ]);

      if (!tripSnap.exists) {
        throw new HttpsError('not-found', 'This trip is no longer available.');
      }
      if (!invitationSnap.exists) {
        throw new HttpsError('not-found', 'This invitation is invalid or has been removed.');
      }

      const invitation = invitationSnap.data();
      if (String(invitation.email || '').trim().toLowerCase() !== userEmail) {
        throw new HttpsError('permission-denied', 'Sign in with the email address that received this invitation.');
      }
      if (invitation.status === 'revoked') {
        throw new HttpsError('failed-precondition', 'This invitation has been revoked.');
      }
      if (invitation.acceptedBy && invitation.acceptedBy !== request.auth.uid) {
        throw new HttpsError('already-exists', 'This invitation has already been used.');
      }

      const trip = tripSnap.data();
      const members = trip.members || {};
      const alreadyMember = Boolean(members[request.auth.uid]);

      transaction.update(tripRef, {
        [`members.${request.auth.uid}`]: {
          role: invitation.role || 'guest',
          email: request.auth.token.email,
        },
      });
      transaction.update(invitationRef, {
        status: 'accepted',
        acceptedBy: request.auth.uid,
        acceptedAt: FieldValue.serverTimestamp(),
      });

      return {
        tripId,
        title: trip.title || 'the trip',
        alreadyMember,
      };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Failed to accept trip invitation', { tripId, invitationId, error });
    throw new HttpsError('internal', 'Unable to accept this trip invitation. Please try again.');
  }
});
