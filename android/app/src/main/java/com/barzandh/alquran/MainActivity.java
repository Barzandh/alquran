package com.barzandh.alquran;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** AlQuran for Android: the whole web app runs from files packed inside the APK (works offline from the first launch). */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String BASE = "https://" + HOST + "/";
    static volatile boolean foreground = false;

    private static final int REQ_FILE = 11, REQ_LOC = 12, REQ_NOTIF = 13;

    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private String pendingLink;
    private boolean loaded;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " AlQuranAndroid/" + version());

        web.addJavascriptInterface(new Bridge(), "AlQuranAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
                String mime = mimeOf(path);
                Map<String, String> h = new HashMap<>();
                h.put("Cache-Control", "no-cache");
                h.put("Access-Control-Allow-Origin", "*");
                try {
                    InputStream in = getAssets().open("www" + path);
                    WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "utf-8" : null, in);
                    r.setResponseHeaders(h);
                    return r;
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loaded = true;
                if (pendingLink != null) { openLink(pendingLink); pendingLink = null; }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (hasLocation()) { cb.invoke(origin, true, false); return; }
                geoCb = cb; geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(Intent.createChooser(i, "Choose a backup file"), REQ_FILE); }
                catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });

        handleIntent(getIntent());
        web.loadUrl(BASE + "index.html");
    }

    /* ---------- helpers ---------- */
    static String mimeOf(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    SharedPreferences prefs() { return getSharedPreferences(Scheduler.PREFS, Context.MODE_PRIVATE); }

    String notifState() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                return nm.areNotificationsEnabled() ? "granted" : "denied";
            boolean asked = prefs().getBoolean("notifAsked", false);
            if (asked && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) return "denied";
            return "default";
        }
        return nm.areNotificationsEnabled() ? "granted" : "denied";
    }

    void js(final String code) { runOnUiThread(() -> web.evaluateJavascript(code, null)); }

    void openLink(String link) { js("typeof openLink === 'function' && openLink(" + JSONObject.quote(link) + ")"); }

    void openExternal(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
        catch (Exception e) { Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show(); }
    }

    void openAppSettings() {
        try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) {}
    }

    void handleIntent(Intent i) {
        if (i == null) return;
        String link = i.getStringExtra("link");
        if (link == null || link.isEmpty()) return;
        i.removeExtra("link");
        if (loaded) openLink(link); else pendingLink = link;
    }

    File writeShareFile(String name, String text) throws IOException {
        File dir = new File(getCacheDir(), "share");
        if (!dir.exists()) dir.mkdirs();
        File f = new File(dir, new File(name).getName());
        try (OutputStream o = new FileOutputStream(f)) { o.write(text.getBytes(StandardCharsets.UTF_8)); }
        return f;
    }

    void shareFile(String name, String mime, String text) throws IOException {
        File f = writeShareFile(name, text);
        Uri uri = FilesProvider.uriFor(f);
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mime);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.putExtra(Intent.EXTRA_SUBJECT, name);
        send.setClipData(ClipData.newRawUri(name, uri));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(send, name));
    }

    /** Android 10+: put the file in Downloads/AlQuran. */
    boolean saveToDownloads(String name, String mime, String text) {
        if (Build.VERSION.SDK_INT < 29) return false;
        try {
            ContentResolver cr = getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AlQuran");
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return false;
            try (OutputStream o = cr.openOutputStream(uri)) {
                if (o == null) return false;
                o.write(text.getBytes(StandardCharsets.UTF_8));
            }
            return true;
        } catch (Exception e) { return false; }
    }

    /* ---------- the bridge the web app talks to (window.AlQuranAndroid) ---------- */
    class Bridge {
        @JavascriptInterface public String version() { return MainActivity.this.version(); }
        @JavascriptInterface public boolean isForeground() { return foreground; }

        @JavascriptInterface public void keepScreenOn(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface public String notifState() { return MainActivity.this.notifState(); }

        @JavascriptInterface public void requestNotifications() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && !"denied".equals(MainActivity.this.notifState())) {
                    prefs().edit().putBoolean("notifAsked", true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
                    return;
                }
                String st = MainActivity.this.notifState();
                if (!"granted".equals(st)) openAppSettings();
                js("window.__nativeNotif && window.__nativeNotif(" + JSONObject.quote(st) + ")");
            });
        }

        @JavascriptInterface public int schedule(String json) { return Scheduler.save(MainActivity.this, json); }
        @JavascriptInterface public boolean wasNotified(String key) { return Scheduler.wasNotified(MainActivity.this, key); }
        @JavascriptInterface public void widget(String json) { PrayerWidget.save(MainActivity.this, json); }
        @JavascriptInterface public void testAdhan(String mode, String title, String stop) {
            AlarmReceiver.post(MainActivity.this, "adhan-test", title, "", "prayer", "prayer", mode, stop);
        }

        @JavascriptInterface public String exactAlarms() {
            if (Build.VERSION.SDK_INT >= 31) {
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                return am.canScheduleExactAlarms() ? "granted" : "denied";
            }
            return "granted";
        }

        @JavascriptInterface public void openAlarmSettings() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 31) {
                    try { startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()))); return; }
                    catch (Exception ignored) {}
                }
                openAppSettings();
            });
        }

        @JavascriptInterface public String saveFile(final String name, final String mime, final String text) {
            if (saveToDownloads(name, mime, text)) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads › AlQuran", Toast.LENGTH_LONG).show());
                return "downloaded";
            }
            runOnUiThread(() -> { try { shareFile(name, mime, text); } catch (Exception e) { Toast.makeText(MainActivity.this, "Could not save the file", Toast.LENGTH_LONG).show(); } });
            return "shared";
        }

        @JavascriptInterface public String openFile(final String name, final String mime, final String text) {
            runOnUiThread(() -> {
                try {
                    File f = writeShareFile(name, text);
                    Uri uri = FilesProvider.uriFor(f);
                    Intent v = new Intent(Intent.ACTION_VIEW);
                    v.setDataAndType(uri, mime);
                    v.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try { startActivity(v); } catch (ActivityNotFoundException e) { shareFile(name, mime, text); }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Could not open the file", Toast.LENGTH_LONG).show();
                }
            });
            return "opened";
        }
    }

    /* ---------- lifecycle ---------- */
    @Override protected void onResume() { super.onResume(); foreground = true; Scheduler.clearShown(this); }
    @Override protected void onPause() { foreground = false; super.onPause(); }   // web view keeps running so recitation continues
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleIntent(intent); }
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__androidBack ? window.__androidBack() : false)", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (fileCb != null) {
                Uri[] r = null;
                if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
                fileCb.onReceiveValue(r);
                fileCb = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        boolean ok = false;
        for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
        if (req == REQ_LOC && geoCb != null) { geoCb.invoke(geoOrigin, ok, false); geoCb = null; }
        if (req == REQ_NOTIF) js("window.__nativeNotif && window.__nativeNotif(" + JSONObject.quote(notifState()) + ")");
    }
}
