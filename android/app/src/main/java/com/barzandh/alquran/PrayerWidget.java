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
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget, styled like a mosque display board: date, city, the next prayer and its time,
 * a live clock and a countdown.
 * The web app sends two weeks of prayer times (already worked out and formatted in the user's
 * language) through the bridge; the widget refreshes itself at every prayer time.
 */
public class PrayerWidget extends AppWidgetProvider {
    static final String ACTION_TICK = "com.barzandh.alquran.WIDGET_TICK";

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

    static void size(RemoteViews v, int id, float sp, float f) { v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sp * f); }

    static RemoteViews build(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_prayer);
        Intent open = new Intent(c, MainActivity.class).putExtra("link", "prayer")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7701, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        int w = 0, h = 0;
        try {
            Bundle o = m.getAppWidgetOptions(id);
            if (o != null) { w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0); h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0); }
        } catch (Exception ignored) {}
        // scale the text with the widget width; drop the date and label rows when the widget is short
        float f = w > 0 ? Math.max(0.8f, Math.min(1.5f, w / 300f)) : 1f;
        if (h > 0) f = Math.min(f, Math.max(0.8f, h / 200f));
        size(v, R.id.w_date, 11, f); size(v, R.id.w_label, 11, f); size(v, R.id.w_cityname, 28, f);
        size(v, R.id.w_ar, 15, f); size(v, R.id.w_name, 19, f); size(v, R.id.w_time, 22, f);
        size(v, R.id.w_clock, 34, f); size(v, R.id.w_clock2, 14, f); size(v, R.id.w_minus, 24, f); size(v, R.id.w_count, 24, f);
        boolean tight = h > 0 && h < 170, tiny = h > 0 && h < 125;
        v.setViewVisibility(R.id.w_date, tight ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_lblrow, tight ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_lanl, tight ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_lanr, tight ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_city, tiny ? View.GONE : View.VISIBLE);

        long now = System.currentTimeMillis();
        JSONObject d = null;
        try { String s = Scheduler.prefs(c).getString("widget", ""); if (!s.isEmpty()) d = new JSONObject(s); } catch (Exception ignored) {}
        JSONArray days = d == null ? null : d.optJSONArray("days");
        int[] nx = days == null ? null : next(days, now);
        if (d != null) {
            v.setInt(R.id.w_root, "setLayoutDirection", d.optBoolean("rtl") ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
            String tz = d.optString("tz", "");
            if (!tz.isEmpty()) { v.setString(R.id.w_clock, "setTimeZone", tz); v.setString(R.id.w_clock2, "setTimeZone", tz); }
        }
        if (nx == null) {
            v.setTextViewText(R.id.w_date, "AlQuran");
            v.setTextViewText(R.id.w_label, "");
            v.setTextViewText(R.id.w_cityname, d == null ? "Open AlQuran" : d.optString("refresh", "Open AlQuran"));
            v.setViewVisibility(R.id.w_boxes, View.GONE);
            v.setViewVisibility(R.id.w_cdrow, View.GONE);
            return v;
        }
        v.setViewVisibility(R.id.w_boxes, View.VISIBLE);
        v.setViewVisibility(R.id.w_cdrow, View.VISIBLE);
        JSONArray day = days.optJSONArray(nx[0]), it = day.optJSONArray(nx[1]);
        long at = it.optLong(1);
        String ar = it.optString(3, ""), name = it.optString(0, "");
        // today's date: the day whose start (midnight in the city) is the latest one before now
        JSONArray dates = d.optJSONArray("dates"), starts = d.optJSONArray("starts");
        String date = "";
        if (dates != null && starts != null) for (int k = 0; k < starts.length() && k < dates.length(); k++) if (starts.optLong(k) <= now) date = dates.optString(k);
        v.setTextViewText(R.id.w_date, date);
        v.setViewVisibility(R.id.w_date, tight || date.isEmpty() ? View.GONE : View.VISIBLE);
        String lbl = d.optString("label", "Next prayer");
        v.setTextViewText(R.id.w_label, d.optBoolean("ar") ? lbl + " (" + ar + ")" : lbl.toUpperCase() + "  •  الصلاة القادمة (" + ar + ")");
        v.setTextViewText(R.id.w_cityname, d.optString("city", ""));
        v.setTextViewText(R.id.w_ar, ar);
        v.setTextViewText(R.id.w_name, name);
        v.setViewVisibility(R.id.w_name, name.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_time, it.optString(2));
        v.setChronometer(R.id.w_count, SystemClock.elapsedRealtime() + (at - now), null, true);
        v.setChronometerCountDown(R.id.w_count, true);
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
