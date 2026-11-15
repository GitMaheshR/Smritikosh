# Smritikosh security and activation: owner's guide

Modelled on the Civentral app, adapted to Smritikosh. Everything works offline; there is no server.

## Device activation (only approved devices can use the app)
Every phone and PC starts **locked**. The lock screen shows a **Device ID** (16 characters, for example `AB12-CD34-EF56-GH78`) and asks for an
**activation code** that only the owner can make. The code is digitally signed (ECDSA P-256): the app holds only the public key, so it can
*check* a code but never *make* one. A code works on **one device only** and can optionally **expire**.

**The owner's folder: `Documents\Smritikosh-license\`**

| File | What it is |
|---|---|
| `smritikosh-private-key.json` | The secret licence key. **Never share it; keep a backup** (USB drive or your own cloud). If it is lost, no new codes can be made until a new key is created and every device is activated again. |
| `smritikosh-release.jks` | The Android signing key. Phones can only update to apps signed with it. **Back it up together with its password.** |
| `Smritikosh-License-Generator.html` | The page for making codes. Open it in Chrome or Edge, choose the secret key file, paste a Device ID, pick an expiry, copy the code. Keeps a list of codes issued (CSV export). |

**Activating a device:** open Smritikosh, copy or *Send ID*, make a code in the generator (or `node scripts/issue-code.mjs <Device ID> [YYYY-MM-DD]`),
send it, paste it into the app and tap Activate. For codes that expire, the app warns 15 days ahead (Home) and a new code is entered in
Settings, This device. Setting the clock back does not extend an expiry (the latest date seen is kept).

**The Device ID changes** when the app is signed with a different key (for example moving from the debug build to the signed release),
or after a factory reset. A new code is then needed. Windows uses the machine's MachineGuid.

## Other protections
- **App PIN:** stored only as a salted PBKDF2-SHA256 hash (600,000 rounds). After 5 wrong PINs the keypad waits 30 s, doubling each time up to 15 minutes
  (kept across restarts). *Forgot PIN?* accepts a **different, newer** activation code for the device, removes the PIN and keeps the data.
- **Data tied to activation:** the database is only opened after the activation check passes (`license/session.ts`). Cutting the activation screen out of the code leaves an app that cannot load its data.
- **Tamper check (Android release):** the release carries the SHA-256 fingerprint of the signing certificate; native code (`IntegrityCheck.java`) compares it at start,
  and the activation screen asks again through a second plugin call. A copy re-signed with another key shows "This copy has been modified" and closes.
- **Scrambled licence code:** `src/license/*.ts` and `packages/core/src/license.ts` are obfuscated in production builds (`apps/ui/obfuscate-license.ts`).
- **Release hardening:** not debuggable, Android backup off, clear-text traffic off, no internet permission, screenshots and screen recording blocked and a blank
  recent-apps card (release builds only; debug builds can still be captured for testing).

## Building the signed APK
```bash
pnpm apk:create-key     # once: a password box opens; creates Documents\Smritikosh-license\smritikosh-release.jks
pnpm apk:release        # a password box opens; builds, signs and verifies the APK (add -NoSample to leave out sample data)
```
The password is typed into a Windows box, used for that one run, and never saved. Output: `apps\mobile\android\app\build\outputs\apk\release\app-release.apk`,
copied to `F:\ClaudeWork\Smritikosh.apk`. The release build loads the sample data (the everyday sample: tasks, notes, journal entries and goals) once, on first launch.

Other commands: `pnpm license:keygen` (once, refuses to overwrite an existing key), `pnpm license:tool` (rebuilds the generator page), `pnpm icons` (regenerates the icons).

## Honest limits
- An offline licence stops casual sharing completely. Someone willing to take the app apart could still get around it; the signature check, scrambling and tamper check make that harder.
  Real enforcement would need a server, which this app deliberately does not have.
- The Windows app has the activation screen but no tamper check, because the installer is not signed with a paid code-signing certificate.
- R8 code shrinking is still off. Turn it on after trying a release on a real phone.
- The notes database itself is not encrypted on the device (the private vault planned for Phase 6 will be).
