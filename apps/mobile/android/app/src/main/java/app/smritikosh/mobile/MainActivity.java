package app.smritikosh.mobile;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AlertDialog;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IntegrityPlugin.class);
        super.onCreate(savedInstanceState);
        // Release builds keep personal notes private: screenshots and screen recording are blocked and the
        // recent-apps screen shows a blank card instead of the last page. Debug builds stay capturable for testing.
        if (!BuildConfig.DEBUG) {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
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
