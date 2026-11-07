package io.github.dmatsib000create.timefall;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // TimeFall's own plugin, beside the installed ones: the floating window.
        registerPlugin(FloatingPlugin.class);
        super.onCreate(savedInstanceState);
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
