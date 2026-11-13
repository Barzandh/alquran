package com.barzandh.alquran;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/**
 * Shows a reminder notification. When AlQuran is on screen the app shows its own banner and sound instead,
 * except for the adhan, which always plays from here (the sound is the notification channel's sound, so it
 * stops when the notification is swiped away, its Stop button is tapped, or the app is opened).
 */
public class AlarmReceiver extends BroadcastReceiver {
    static final String CH_PRAYER = "prayer", CH_OTHER = "reminders", CH_ADHAN = "adhan_full", CH_ADHAN_SHORT = "adhan_takbir";
    static final String ACTION_STOP = "com.barzandh.alquran.STOP_ADHAN";

    static Uri raw(Context c, int id) { return Uri.parse("android.resource://" + c.getPackageName() + "/" + id); }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        AudioAttributes aa = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        NotificationChannel p = new NotificationChannel(CH_PRAYER, "Prayer times", NotificationManager.IMPORTANCE_HIGH);
        p.setDescription("Prayer time and before-prayer reminders");
        p.enableVibration(true);
        p.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), aa);
        NotificationChannel o = new NotificationChannel(CH_OTHER, "Azkar & Quran reminders", NotificationManager.IMPORTANCE_HIGH);
        o.setDescription("Azkar, khatma and Quran reading reminders");
        o.enableVibration(true);
        AudioAttributes an = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        NotificationChannel f = new NotificationChannel(CH_ADHAN, "Adhan (full)", NotificationManager.IMPORTANCE_HIGH);
        f.setDescription("The full adhan at prayer time");
        f.enableVibration(true);
        f.setSound(raw(c, R.raw.adhan), an);
        NotificationChannel t = new NotificationChannel(CH_ADHAN_SHORT, "Adhan (takbir only)", NotificationManager.IMPORTANCE_HIGH);
        t.setDescription("The opening takbir of the adhan at prayer time");
        t.enableVibration(true);
        t.setSound(raw(c, R.raw.adhan_short), an);
        nm.createNotificationChannel(p);
        nm.createNotificationChannel(o);
        nm.createNotificationChannel(f);
        nm.createNotificationChannel(t);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (ACTION_STOP.equals(i.getAction())) {
            try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(i.getIntExtra("id", 0)); } catch (Exception ignored) {}
            return;
        }
        String adhan = i.getStringExtra("adhan");
        boolean isAdhan = "full".equals(adhan) || "short".equals(adhan);
        if (MainActivity.foreground && !isAdhan) return;
        post(c, i.getStringExtra("key"), i.getStringExtra("title"), i.getStringExtra("body"), i.getStringExtra("link"),
             i.getStringExtra("kind"), adhan, i.getStringExtra("stop"));
    }

    static void post(Context c, String key, String title, String body, String link, String kind, String adhan, String stop) {
        boolean isAdhan = "full".equals(adhan) || "short".equals(adhan), isShort = "short".equals(adhan);
        if (key == null) key = String.valueOf(System.currentTimeMillis());
        channels(c);
        int nid = key.hashCode();
        Intent open = new Intent(c, MainActivity.class).putExtra("link", link == null ? "" : link)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String ch = isAdhan ? (isShort ? CH_ADHAN_SHORT : CH_ADHAN) : "prayer".equals(kind) ? CH_PRAYER : CH_OTHER;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat)
         .setContentTitle(title == null ? "AlQuran" : title)
         .setContentText(body == null ? "" : body)
         .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
         .setColor(0xFF155A41)
         .setAutoCancel(true)
         .setContentIntent(pi)
         .setCategory(isAdhan ? Notification.CATEGORY_ALARM : Notification.CATEGORY_REMINDER)
         .setWhen(System.currentTimeMillis())
         .setShowWhen(true);
        if (isAdhan) {
            Intent st = new Intent(c, AlarmReceiver.class).setAction(ACTION_STOP).putExtra("id", nid);
            PendingIntent sp = PendingIntent.getBroadcast(c, nid, st, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.addAction(new Notification.Action.Builder((android.graphics.drawable.Icon) null, stop == null || stop.isEmpty() ? "Stop" : stop, sp).build());
        }
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            if (isAdhan) { b.setDefaults(Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS); b.setSound(raw(c, isShort ? R.raw.adhan_short : R.raw.adhan), AudioManager.STREAM_NOTIFICATION); }
            else b.setDefaults(Notification.DEFAULT_ALL);
        }
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify(nid, b.build());
            Scheduler.markShown(c, key);
        } catch (SecurityException ignored) {}
    }
}
