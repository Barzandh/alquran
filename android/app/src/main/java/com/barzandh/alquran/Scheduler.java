package com.barzandh.alquran;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Keeps the reminder list from the web app as real Android alarms (survive closing the app and restarts). */
public class Scheduler {
    static final String PREFS = "alquran";
    static final String ACTION = "com.barzandh.alquran.REMIND";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static int save(Context c, String json) {
        prefs(c).edit().putString("sched", json == null ? "[]" : json).apply();
        return apply(c);
    }

    static PendingIntent pending(Context c, int n, JSONObject o, int flag) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION);
        if (o != null) {
            i.putExtra("key", o.optString("key"));
            i.putExtra("title", o.optString("title"));
            i.putExtra("body", o.optString("body"));
            i.putExtra("link", o.optString("link"));
            i.putExtra("kind", o.optString("kind"));
            i.putExtra("adhan", o.optString("adhan"));
            i.putExtra("stop", o.optString("stop"));
        }
        return PendingIntent.getBroadcast(c, 1000 + n, i, flag | PendingIntent.FLAG_IMMUTABLE);
    }

    static synchronized int apply(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(c);
        int old = p.getInt("count", 0);
        for (int n = 0; n < old; n++) {
            PendingIntent pi = pending(c, n, null, PendingIntent.FLAG_NO_CREATE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
        int n = 0;
        long now = System.currentTimeMillis();
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            JSONArray a = new JSONArray(p.getString("sched", "[]"));
            for (int k = 0; k < a.length() && n < 200; k++) {
                JSONObject o = a.getJSONObject(k);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                PendingIntent pi = pending(c, n, o, PendingIntent.FLAG_UPDATE_CURRENT);
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                n++;
            }
        } catch (Exception ignored) {}
        p.edit().putInt("count", n).apply();
        return n;
    }

    static synchronized void markShown(Context c, String key) {
        SharedPreferences p = prefs(c);
        List<String> l = new ArrayList<>(Arrays.asList(p.getString("shown", "").split("\n")));
        l.remove("");
        l.add(key);
        while (l.size() > 120) l.remove(0);
        p.edit().putString("shown", android.text.TextUtils.join("\n", l)).apply();
    }

    static boolean wasNotified(Context c, String key) {
        return Arrays.asList(prefs(c).getString("shown", "").split("\n")).contains(key);
    }

    /** opening the app clears notifications it already showed */
    static void clearShown(Context c) {
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll(); } catch (Exception ignored) {}
    }
}
