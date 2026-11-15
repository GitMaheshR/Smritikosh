package app.smritikosh.mobile;

import android.os.Bundle;
import androidx.appcompat.app.AlertDialog;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IntegrityPlugin.class);
        super.onCreate(savedInstanceState);
        // Screenshots and screen recording are allowed (the owner chose this on 2026-11-15).
        // A modified copy is stopped here, before the app can be used.
        if (!IntegrityCheck.isGenuine(this)) {
            new AlertDialog.Builder(this)
                .setTitle(R.string.integrity_title)
                .setMessage(R.string.integrity_message)
                .setCancelable(false)
                .setPositiveButton(R.string.integrity_close, (dialog, which) -> finishAndRemoveTask())
                .show();
        }
    }
}
