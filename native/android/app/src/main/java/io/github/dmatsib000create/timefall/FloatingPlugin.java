package io.github.dmatsib000create.timefall;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Rational;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The floating view on Android: the whole app shrinks to a small window that
 * stays over other apps (picture-in-picture, Android 8 and later). The page
 * hears "floatingChanged" and keeps only the picture and the words that matter.
 *
 * "setAutoEnter" lets the window open on its own when the person leaves the
 * app during a session: Android 12 and later do that themselves from the
 * params; older versions are nudged from onUserLeaveHint in MainActivity.
 */
@CapacitorPlugin(name = "Floating")
public class FloatingPlugin extends Plugin {

    private boolean autoEnter = false;

    boolean available() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", available());
        call.resolve(ret);
    }

    @PluginMethod
    public void enter(PluginCall call) {
        if (!available()) {
            JSObject ret = new JSObject();
            ret.put("entered", false);
            call.resolve(ret);
            return;
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            boolean entered = false;
            try {
                entered = activity.enterPictureInPictureMode(params());
            } catch (IllegalStateException e) {
                // Not allowed right now (for example while the activity is not resumed).
            }
            JSObject ret = new JSObject();
            ret.put("entered", entered);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setAutoEnter(PluginCall call) {
        autoEnter = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (available() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Activity activity = getActivity();
            activity.runOnUiThread(() -> {
                try {
                    activity.setPictureInPictureParams(params());
                } catch (IllegalStateException e) {
                    // The activity isn't in a state to take params; the next call will set them.
                }
            });
        }
        call.resolve();
    }

    private PictureInPictureParams params() {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
            .setAspectRatio(new Rational(4, 5));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(autoEnter).setSeamlessResizeEnabled(false);
        }
        return builder.build();
    }

    /** Android 8 to 11: float when the person leaves, if they asked for that. */
    void onUserLeaveHint() {
        if (!autoEnter || !available() || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return;
        try {
            getActivity().enterPictureInPictureMode(params());
        } catch (IllegalStateException e) {
            // Nothing to do: the app simply goes to the background.
        }
    }

    void onModeChanged(boolean active) {
        JSObject data = new JSObject();
        data.put("active", active);
        notifyListeners("floatingChanged", data);
    }
}
