# AlQuran — Quran, Prayer & Azkar

Installable offline web app: the Holy Quran (Uthmani Hafs) with Al-Minshawi recitation, English/French/German/Kurdish translations, official Kurdistan & Iraq prayer timetables, Qibla, azkar, tasbih, khatma, reminders and backups.

**Install on iPhone:** open the site in Safari → Share → Add to Home Screen.

**Android app (APK):** [Download AlQuran.apk](https://github.com/Barzandh/alquran/releases/latest/download/AlQuran.apk) — open the file on your phone and tap Install (allow "Install unknown apps" for your browser if asked). Works offline from the first launch; reminders arrive as Android notifications even when the app is closed.

The Android project is in `android/`; GitHub Actions builds the APK on every update (`.github/workflows/apk.yml`). It is signed with a key made on the build server from the private `ALQURAN_KEY` repository secret — no key is stored in this repository.
