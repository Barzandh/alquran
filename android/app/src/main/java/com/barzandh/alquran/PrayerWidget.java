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
        // scale the text with the widget size; drop the less important lines when the widget is short
        float f = w > 0 ? Math.max(0.75f, Math.min(1.45f, w / 300f)) : 1f;
        if (h > 0) f = Math.min(f, Math.max(0.75f, h / 380f));
        size(v, R.id.w_date, 15, f); size(v, R.id.w_hijri, 12, f); size(v, R.id.w_cityname, 24, f);
        size(v, R.id.w_cur, 11, f); size(v, R.id.w_clock, 38, f); size(v, R.id.w_sec, 13, f); size(v, R.id.w_ap, 15, f);
        size(v, R.id.w_label, 11, f); size(v, R.id.w_arl, 14, f); size(v, R.id.w_ar, 22, f); size(v, R.id.w_name, 17, f);
        size(v, R.id.w_time, 26, f); size(v, R.id.w_minus, 12, f); size(v, R.id.w_count, 12, f);
        boolean noRule = h > 0 && h < 330, noClock = h > 0 && h < 260, noDate = h > 0 && h < 200;
        v.setViewVisibility(R.id.w_rule, noRule ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_b2, noClock ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_date, noDate ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_hijri, noDate ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_lanl, noDate ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_lanr, noDate ? View.GONE : View.VISIBLE);

        long now = System.currentTimeMillis();
        JSONObject d = null;
        try { String s = Scheduler.prefs(c).getString("widget", ""); if (!s.isEmpty()) d = new JSONObject(s); } catch (Exception ignored) {}
        JSONArray days = d == null ? null : d.optJSONArray("days");
        int[] nx = days == null ? null : next(days, now);
        if (d != null) {
            v.setInt(R.id.w_root, "setLayoutDirection", d.optBoolean("rtl") ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
            String tz = d.optString("tz", "");
            if (!tz.isEmpty()) for (int t : new int[]{R.id.w_clock, R.id.w_sec, R.id.w_ap}) v.setString(t, "setTimeZone", tz);
            v.setTextViewText(R.id.w_cur, d.optBoolean("rtl") ? d.optString("cur", "Current time") : d.optString("cur", "Current time").toUpperCase());
            v.setTextViewText(R.id.w_cityname, d.optString("city", ""));
            // today's date: the day whose start (midnight in the city) is the latest one before now
            JSONArray dates = d.optJSONArray("dates"), starts = d.optJSONArray("starts");
            String date = "";
            if (dates != null && starts != null) for (int k = 0; k < starts.length() && k < dates.length(); k++) if (starts.optLong(k) <= now) date = dates.optString(k);
            int cut = date.indexOf("  •  ");
            v.setTextViewText(R.id.w_date, cut < 0 ? date : date.substring(0, cut));
            v.setTextViewText(R.id.w_hijri, cut < 0 ? "" : date.substring(cut + 5));
        }
        if (nx == null) {
            v.setTextViewText(R.id.w_label, "AlQuran");
            v.setTextViewText(R.id.w_name, d == null ? "Open AlQuran" : d.optString("refresh", "Open AlQuran"));
            for (int t : new int[]{R.id.w_arl, R.id.w_rule, R.id.w_ar, R.id.w_time, R.id.w_cdrow}) v.setViewVisibility(t, View.GONE);
            return v;
        }
        for (int t : new int[]{R.id.w_ar, R.id.w_time, R.id.w_cdrow}) v.setViewVisibility(t, View.VISIBLE);
        JSONArray day = days.optJSONArray(nx[0]), it = day.optJSONArray(nx[1]);
        long at = it.optLong(1);
        String ar = it.optString(3, ""), name = it.optString(0, ""), lbl = d.optString("label", "Next prayer");
        boolean isAr = d.optBoolean("ar"), rtl = d.optBoolean("rtl");
        v.setTextViewText(R.id.w_label, rtl ? lbl : lbl.toUpperCase());
        v.setTextViewText(R.id.w_arl, "الصلاة القادمة (" + ar + ")");
        v.setViewVisibility(R.id.w_arl, isAr ? View.GONE : View.VISIBLE);
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
