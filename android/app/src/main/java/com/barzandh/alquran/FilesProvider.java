package com.barzandh.alquran;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/** Hands backup and calendar files to other apps (share sheet, Files, Calendar). */
public class FilesProvider extends ContentProvider {
    static final String AUTH = "com.barzandh.alquran.files";

    static Uri uriFor(File f) { return Uri.parse("content://" + AUTH + "/" + Uri.encode(f.getName())); }

    File fileFor(Uri u) throws FileNotFoundException {
        File dir = new File(getContext().getCacheDir(), "share");
        String name = u.getLastPathSegment();
        if (name == null) throw new FileNotFoundException();
        File f = new File(dir, name);
        try { if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) throw new FileNotFoundException(); }
        catch (IOException e) { throw new FileNotFoundException(); }
        if (!f.exists()) throw new FileNotFoundException();
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public String getType(Uri uri) {
        String n = String.valueOf(uri.getLastPathSegment()).toLowerCase();
        if (n.endsWith(".ics")) return "text/calendar";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    @Override public Cursor query(Uri uri, String[] proj, String sel, String[] args, String sort) {
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        try { File f = fileFor(uri); c.addRow(new Object[]{f.getName(), f.length()}); } catch (FileNotFoundException ignored) {}
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
