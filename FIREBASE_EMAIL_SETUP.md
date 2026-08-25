# Email invitations setup

The app writes invitation emails to Firestore's top-level `mail` collection. To deliver those emails, install Firebase's **Trigger Email** extension in the `travel-hub-app-4d314` project.

1. In the Firebase console, open **Extensions**, find **Trigger Email from Firestore**, and install it.
2. Keep the default collection name as `mail`.
3. Configure an SMTP provider and choose a verified sender address.
4. Add every deployed app URL to Firebase Authentication's **Authorized domains**. The magic-link sign-in continue URL must also be authorized.
5. Deploy the app over HTTPS. Invitation links are generated from the live app origin.

An invite is stored at `trips/{tripId}/invitations/{inviteId}` and emailed. The recipient clicks the link, signs in with the invited email address, and the app adds their Firebase UID to the trip's `members` map with the selected role. An email address alone never receives access before acceptance.

## Firestore rules

Ensure your Firestore rules allow a signed-in user to read a single invitation addressed to their email and atomically accept it by updating that invitation and the matching trip membership. Existing rules must also allow the owner to create invitations and queue `mail` documents. Do not make `mail` publicly writable in production; restrict it to trip owners or use a trusted Cloud Function.

Trigger Email queues and sends asynchronously. “Invitation queued” confirms the app created the mail document; delivery status is available on that document in Firestore.
