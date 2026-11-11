# Löwenherz — eigene R8-Regeln (Release-Build seit versionCode 9)
#
# Den Großteil bringen die Bibliotheken als Consumer-Regeln selbst mit
# (vollständige Liste nach jedem Bau: build/outputs/mapping/release/configuration.txt):
#   - Capacitor (@capacitor/android): jede Klasse „extends com.getcapacitor.Plugin"
#     bleibt samt Name und allen Methoden — die Bridge lädt die Plugins per
#     Klassenname aus capacitor.plugins.json und findet @PluginMethod per Reflexion.
#   - OneSignal 5.9: Module per Class.forName, Konstruktoren für die
#     Reflexions-DI, Model-Getter, Enum-Namen, Worker (WorkManager).
#   - AGP-Standard (proguard-android-optimize.txt): @JavascriptInterface-Methoden
#     (Capacitor-Bridge, SystemBars, OneSignal-In-App-Nachrichten).

# Eigenes Plugin: Die WebView ruft setzen() und einstellungenOeffnen() über den
# Namen „Erinnerungskanal" auf (js/push-native.js, js/screens/settings.js).
# Deckt sich mit der Capacitor-Regel, hängt so aber nicht an deren Formulierung.
-keep class de.angstdoc.loewenherz.ErinnerungskanalPlugin { *; }

# Lesbare Absturzberichte in der Play Console: Zeilennummern behalten,
# die Mapping-Datei übersetzt die verschleierten Namen zurück.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
