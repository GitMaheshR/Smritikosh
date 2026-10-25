package app.smritikosh.mobile;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Checks that the installed app is signed with the owner's release certificate.
 * A repackaged copy has to be re-signed with someone else's key, so its certificate
 * fingerprint will not match the one built into the genuine release (see app/build.gradle).
 * Development (debug) builds carry no fingerprint and skip the check.
 */
final class IntegrityCheck {
    private IntegrityCheck() {}

    static boolean isGenuine(Context context) {
        String expected = BuildConfig.SIGNING_CERT_SHA256;
        if (expected == null || expected.isEmpty()) return true;
        try {
            PackageManager pm = context.getPackageManager();
            Signature[] signers;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                if (info.signingInfo == null || info.signingInfo.hasMultipleSigners()) return false;
                signers = info.signingInfo.getApkContentsSigners();
            } else {
                PackageInfo info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
                signers = info.signatures;
            }
            if (signers == null || signers.length != 1) return false;
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02X", b));
            return MessageDigest.isEqual(
                hex.toString().getBytes(StandardCharsets.US_ASCII),
                expected.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            return false;
        }
    }
}
