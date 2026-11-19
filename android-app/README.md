# Sudha Vatika Android app

A thin Android app (Capacitor) that opens the live website
https://kushagra486.github.io/Sudha-Vatika-/ full screen. Website changes show up in the app
automatically; the app itself only needs rebuilding to change its name, icon or address.

The Android project is generated in CI (`.github/workflows/android.yml`), so nothing generated is
committed. To get the APK: GitHub → Actions → "Build Android app" → latest run → **Artifacts** →
`sudha-vatika-apk`. Install it by opening the .apk on an Android phone (allow "install unknown apps").

Local build (needs JDK 17 and the Android SDK):

    cd android-app && npm ci && npx cap add android
    npx capacitor-assets generate --android
    npx cap sync android && cd android && ./gradlew assembleDebug
