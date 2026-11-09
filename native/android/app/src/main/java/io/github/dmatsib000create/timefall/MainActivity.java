package io.github.dmatsib000create.timefall;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // TimeFall's own plugin, beside the installed ones: the floating window.
        registerPlugin(FloatingPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // When the phone switches between light and dark while TimeFall is open, the shell re-applies
    // the system-bar style it worked out at launch, so the clock and signal icons at the top could
    // stay dark on the dark paper. Decide again from the new configuration, after the shell's turn.
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean night = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(!night);
        bars.setAppearanceLightNavigationBars(!night);
    }

    private FloatingPlugin floating() {
        if (getBridge() == null) return null;
        PluginHandle handle = getBridge().getPlugin("Floating");
        return handle == null ? null : (FloatingPlugin) handle.getInstance();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        FloatingPlugin plugin = floating();
        if (plugin != null) plugin.onUserLeaveHint();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        FloatingPlugin plugin = floating();
        if (plugin != null) plugin.onModeChanged(isInPictureInPictureMode);
    }
}
