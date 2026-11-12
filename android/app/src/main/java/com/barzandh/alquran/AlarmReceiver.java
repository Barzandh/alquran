package com.barzandh.alquran;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/** Shows a reminder notification. When AlQuran is on screen the app shows its own banner and sound instead. */
public class AlarmReceiver extends BroadcastReceiver {
    static final String CH_PRAYER = "prayer", CH_OTHER = "reminders";

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
        nm.createNotificationChannel(p);
        nm.createNotificationChannel(o);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (MainActivity.foreground) return;
        String key = i.getStringExtra("key"), title = i.getStringExtra("title"), body = i.getStringExtra("body"),
               link = i.getStringExtra("link"), kind = i.getStringExtra("kind");
        if (key == null) key = String.valueOf(System.currentTimeMillis());
        channels(c);
        Intent open = new Intent(c, MainActivity.class).putExtra("link", link == null ? "" : link)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, key.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String ch = "prayer".equals(kind) ? CH_PRAYER : CH_OTHER;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat)
         .setContentTitle(title == null ? "AlQuran" : title)
         .setContentText(body == null ? "" : body)
         .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
         .setColor(0xFF155A41)
         .setAutoCancel(true)
         .setContentIntent(pi)
         .setCategory(Notification.CATEGORY_REMINDER)
         .setWhen(System.currentTimeMillis())
         .setShowWhen(true);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify(key.hashCode(), b.build());
            Scheduler.markShown(c, key);
        } catch (SecurityException ignored) {}
    }
}
