# Assignment push notification setup

The inbox works without Firebase. Native push delivery is enabled when the following deployment/build secrets are configured.

## Dashboard / Netlify

- `FIREBASE_PROJECT_ID`: Firebase project ID.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: complete Firebase service-account JSON, stored as a protected environment variable.

Never commit the service-account JSON. The server uses Firebase Cloud Messaging HTTP v1 and records `SENT`, `PARTIAL`, `FAILED`, `NO_DEVICE`, or `NOT_CONFIGURED` on each durable inbox item.

## Mobile builds

Pass these values as protected `--dart-define` values during iOS and Android builds:

- `FIREBASE_API_KEY`
- `FIREBASE_APP_ID` (use the platform-specific Firebase app ID)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_IOS_BUNDLE_ID` (iOS only; defaults to `com.fireopssim.careerroadmap`)

For iOS, upload the APNs authentication key to the Firebase project and enable Push Notifications plus Background Modes / Remote notifications for the App Store identifier. The repository includes the production APNs entitlement and background mode.

For Android, register the production package name in the same Firebase project. Notification permission is requested by `firebase_messaging` on supported Android versions.

After deployment, verify with two physical devices and confirm the corresponding inbox item still appears when push permission is denied. Push is an alert channel; the database inbox remains the source of truth.
