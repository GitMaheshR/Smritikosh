package app.smritikosh.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the activation screen ask whether this copy is genuine (a second, independent check). */
@CapacitorPlugin(name = "Integrity")
public class IntegrityPlugin extends Plugin {
    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("genuine", IntegrityCheck.isGenuine(getContext()));
        call.resolve(result);
    }
}
