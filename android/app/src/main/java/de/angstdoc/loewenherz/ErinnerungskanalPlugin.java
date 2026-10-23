package de.angstdoc.loewenherz;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Benachrichtigungskanal der Erinnerungen (nur Android).
 *
 * Seit Android 8 bestimmt der Kanal den Ton, nicht die einzelne Nachricht —
 * und der Ton eines Kanals ist nach dem Anlegen unveränderlich. Deshalb
 * trägt die Kanal-ID den Ton („lh-ton-4", „lh-system"): Wechselt der Nutzer
 * den Ton in den Einstellungen, legt setzen() den neuen Kanal an und löscht
 * den alten. In den Android-Einstellungen steht so immer genau EIN Kanal
 * „Erinnerungen". Der Server adressiert den Kanal über
 * existing_android_channel_id (api/send-notifications.js); fehlt er auf dem
 * Gerät, fällt das OneSignal-SDK auf seinen Standardkanal zurück — die
 * Erinnerung kommt dann mit Systemton, aber sie kommt.
 *
 * Gegenstück: js/push-native.js (ensureAndroidChannel), aufgerufen beim
 * SDK-Init und vor jedem Tag-Sync.
 */
@CapacitorPlugin(name = "Erinnerungskanal")
public class ErinnerungskanalPlugin extends Plugin {

    private static final String PREFIX = "lh-";
    private static final String TWA_CHANNEL_ID = "general_channel_id";

    @PluginMethod
    public void setzen(PluginCall call) {
        String id = call.getString("id");
        String name = call.getString("name", "Erinnerungen");
        String beschreibung = call.getString("beschreibung", "");
        String ton = call.getString("ton", "");   // Name der raw-Ressource, leer = Systemton
        if (id == null || !id.startsWith(PREFIX)) {
            call.reject("Kanal-ID muss mit '" + PREFIX + "' beginnen");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();   // Android 7: keine Kanäle, Ton kommt vom System
            return;
        }

        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

        // Andere Löwenherz-Kanäle (= andere Töne) weg, sonst sammeln sie sich
        // in den Android-Einstellungen. Android merkt sich Nutzer-Einstellungen
        // gelöschter Kanäle; kommt dieselbe ID zurück, gelten sie wieder.
        // Ebenfalls weg: der Kanal „General", den Chrome für die alte TWA
        // (Web-Push-Delegation bis versionCode 4) in dieser App angelegt hat —
        // er überlebt das Update und stünde sonst neben „Erinnerungen".
        for (NotificationChannel vorhanden : nm.getNotificationChannels()) {
            String vid = vorhanden.getId();
            boolean altLoewenherz = vid.startsWith(PREFIX) && !vid.equals(id);
            boolean twaRest = vid.equals(TWA_CHANNEL_ID);
            if (altLoewenherz || twaRest) nm.deleteNotificationChannel(vid);
        }

        if (nm.getNotificationChannel(id) == null) {
            NotificationChannel kanal = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
            kanal.setDescription(beschreibung);
            if (!ton.isEmpty()) {
                int resId = ctx.getResources().getIdentifier(ton, "raw", ctx.getPackageName());
                if (resId != 0) {
                    Uri uri = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/" + ton);
                    AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    kanal.setSound(uri, attrs);
                }
                // Unbekannte Ressource: Kanal mit Systemton anlegen statt abzubrechen.
            }
            nm.createNotificationChannel(kanal);
        }

        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);
    }

    /** Öffnet die Benachrichtigungs-Einstellungen DIESER App (bei blockiertem Push). */
    @PluginMethod
    public void einstellungenOeffnen(PluginCall call) {
        Context ctx = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        } else {
            intent = new Intent("android.settings.APP_NOTIFICATION_SETTINGS")
                .putExtra("app_package", ctx.getPackageName())
                .putExtra("app_uid", ctx.getApplicationInfo().uid);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Einstellungen nicht erreichbar: " + e.getMessage());
        }
    }
}
