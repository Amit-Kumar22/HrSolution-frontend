# Worker Mobile

Separate Expo Router app for the Worker panel. It does not modify the parent Next.js app.

## Configure and run

```powershell
cd worker-mobile
Copy-Item .env.example .env
# Set EXPO_PUBLIC_API_URL in .env. The current root backend value is:
# http://76.13.245.49:8085/api/v1
npm install
npm start
```

`npm start` uses Expo's tunnel mode so the QR code can be scanned even when the
phone and development computer are not on the same local network. For a faster
same-Wi-Fi connection, use `npm run start:lan` instead.

Use `npm run android`, `npm run ios`, `npm run lint`, and `npm run typecheck` as needed.

## Backend coverage

Integrated: `/auth/login`, `/auth/me`, `/auth/logout`, `/leave`, `/leave/apply`, worker documents, worker bank accounts, and notifications. Authentication tokens are stored with Expo SecureStore and every request sends the bearer token.

The existing backend contracts do not provide a worker attendance/check-in API, worker payslip list/download API, or worker profile update API. Those screens remain explicit unavailable/read-only states.
