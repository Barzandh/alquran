package com.barzandh.alquran;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the next prayer, a live countdown and the day's five prayer times.
 * The web app sends two weeks of prayer times (already worked out and formatted in the user's
 * language) through the bridge; the widget refreshes itself at every prayer time.
 */
public class PrayerWidget extends AppWidgetProvider {
    static final String ACTION_TICK = "com.barzandh.alquran.WIDGET_TICK";
    static final int[] NAMES = {R.id.w_n1, R.id.w_n2, R.id.w_n3, R.id.w_n4, R.id.w_n5};
    static final int[] TIMES = {R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4, R.id.w_t5};
    static final int GOLD = 0xFFE8C873, WHITE = 0xFFFFFFFF, SOFT = 0xFFBFD8CB;

    static void save(Context c, String json) {
        Scheduler.prefs(c).edit().putString("widget", json == null ? "" : json).apply();
        updateAll(c);
    }

    static int[] ids(Context c) {
        try { return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, PrayerWidget.class)); }
        catch (Exception e) { return new int[0]; }
    }

    static void updateAll(Context c) {
        int[] ids = ids(c);
        if (ids == null || ids.length == 0) { cancelTick(c); return; }
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : ids) m.updateAppWidget(id, build(c, m, id));
        scheduleTick(c);
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c, m, id));
        scheduleTick(c);
    }

    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {
        m.updateAppWidget(id, build(c, m, id));
    }

    @Override public void onDisabled(Context c) { cancelTick(c); }

    @Override public void onReceive(Context c, Intent i) {
        if (ACTION_TICK.equals(i.getAction())) { updateAll(c); return; }
        super.onReceive(c, i);
    }

    /** the next prayer after now as {dayIndex, itemIndex}, or null */
    static int[] next(JSONArray days, long now) {
        for (int d = 0; d < days.length(); d++) {
            JSONArray day = days.optJSONArray(d);
            if (day == null) continue;
            for (int k = 0; k < day.length(); k++) {
                JSONArray it = day.optJSONArray(k);
                if (it != null && it.optLong(1) > now) return new int[]{d, k};
            }
        }
        return null;
    }

    static RemoteViews build(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_prayer);
        Intent open = new Intent(c, MainActivity.class).putExtra("link", "prayer")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7701, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        try {
            Bundle o = m.getAppWidgetOptions(id);
            int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            v.setViewVisibility(R.id.w_row, h > 0 && h < 100 ? View.GONE : View.VISIBLE);
        } catch (Exception ignored) {}
        long now = System.currentTimeMillis();
        JSONObject d = null;
        try { String s = Scheduler.prefs(c).getString("widget", ""); if (!s.isEmpty()) d = new JSONObject(s); } catch (Exception ignored) {}
        JSONArray days = d == null ? null : d.optJSONArray("days");
        int[] nx = days == null ? null : next(days, now);
        if (d != null) v.setInt(R.id.w_root, "setLayoutDirection", d.optBoolean("rtl") ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
        if (nx == null) {
            v.setTextViewText(R.id.w_label, "AlQuran");
            v.setTextViewText(R.id.w_name, d == null ? "Open AlQuran" : d.optString("refresh", "Open AlQuran"));
            v.setTextViewText(R.id.w_time, "");
            v.setViewVisibility(R.id.w_count, View.GONE);
            v.setViewVisibility(R.id.w_row, View.GONE);
            return v;
        }
        JSONArray day = days.optJSONArray(nx[0]), it = day.optJSONArray(nx[1]);
        long at = it.optLong(1);
        String city = d.optString("city", "");
        v.setTextViewText(R.id.w_label, d.optString("label", "Next prayer") + (city.isEmpty() ? "" : " · " + city));
        v.setTextViewText(R.id.w_name, it.optString(0));
        v.setTextViewText(R.id.w_time, it.optString(2));
        v.setViewVisibility(R.id.w_count, View.VISIBLE);
        v.setChronometer(R.id.w_count, SystemClock.elapsedRealtime() + (at - now), null, true);
        v.setChronometerCountDown(R.id.w_count, true);
        for (int k = 0; k < NAMES.length; k++) {
            JSONArray p = k < day.length() ? day.optJSONArray(k) : null;
            v.setTextViewText(NAMES[k], p == null ? "" : p.optString(0));
            v.setTextViewText(TIMES[k], p == null ? "" : p.optString(2));
            boolean on = k == nx[1];
            v.setTextColor(NAMES[k], on ? GOLD : SOFT);
            v.setTextColor(TIMES[k], on ? GOLD : WHITE);
        }
        return v;
    }

    static PendingIntent tickIntent(Context c, int flag) {
        Intent i = new Intent(c, PrayerWidget.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(c, 7702, i, flag | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelTick(Context c) {
        PendingIntent pi = tickIntent(c, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) { ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(pi); pi.cancel(); }
    }

    /** wake up just after the next prayer time to move the widget on to the following one */
    static void scheduleTick(Context c) {
        long now = System.currentTimeMillis(), at = 0;
        try {
            JSONObject d = new JSONObject(Scheduler.prefs(c).getString("widget", "{}"));
            JSONArray days = d.optJSONArray("days");
            int[] nx = days == null ? null : next(days, now);
            if (nx != null) at = days.optJSONArray(nx[0]).optJSONArray(nx[1]).optLong(1) + 1500;
        } catch (Exception ignored) {}
        if (at <= now) { cancelTick(c); return; }
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = tickIntent(c, PendingIntent.FLAG_UPDATE_CURRENT);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        // RTC (not a wake-up alarm): if the screen is off, the widget moves on as soon as the phone wakes
        if (exact) am.setExact(AlarmManager.RTC, at, pi);
        else am.set(AlarmManager.RTC, at, pi);
    }
}
