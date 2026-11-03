# My Finance — Android app (Capacitor)

The existing React + Vite app is packaged locally inside a native Android WebView using Capacitor. It continues to use the same Supabase project and authentication; no service-role key or wallet credentials belong in the app.

## Requirements

- Node.js 20 or newer
- Android Studio with the Android SDK
- A Java Development Kit supported by the installed Android Gradle Plugin
- Android device with USB debugging enabled, or an Android emulator

## First-time Android project setup

Run these commands from the repository root:

```bash
npm install
npx cap add android
npm run mobile:build
npm run cap:open:android
```

The `cap add android` command creates the native `android/` project once. Commit that generated folder to GitHub so the native project and Gradle wrapper are versioned with the app.

## Build and run

After the native project has been created:

```bash
npm run mobile:build
npm run cap:open:android
```

In Android Studio, wait for Gradle sync, select a device, then use **Run** to install the debug app. For a release, use **Build → Generate Signed Bundle / APK** and create a signed Android App Bundle (AAB) for Google Play.

For a connected device, the Android Studio terminal can also run:

```bash
npx cap run android
```

## Updating the app after React changes

```bash
npm run mobile:build
```

This rebuilds the Vite site into `dist/` and copies it into the native Android project.

## Notes

- Capacitor is configured with a local bundled web build; the installed app does not simply open the production website URL.
- Supabase URL and anon/publishable key remain the only client-side credentials. Keep Row Level Security enabled.
- Test login, password change, CSV statement file picker, charts, keyboard resizing, back navigation, and session persistence on a real Android device before release.
- App ID is currently `com.myfinance.app`. Choose the final Play Store package ID before publishing; changing it later creates a separate Android app identity.
- App icon and Play Store screenshots should be added before public release.
