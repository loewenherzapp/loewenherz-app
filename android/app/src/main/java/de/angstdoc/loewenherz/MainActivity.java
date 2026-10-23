package de.angstdoc.loewenherz;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigenes Plugin VOR dem Bridge-Start registrieren (Capacitor-Regel).
        registerPlugin(ErinnerungskanalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
