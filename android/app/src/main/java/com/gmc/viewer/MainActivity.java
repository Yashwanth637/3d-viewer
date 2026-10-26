package com.gmc.viewer;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "GMC3DViewer";
    private String pendingFilePath = null;
    private String pendingFileName = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidFileInterface(), "AndroidFileBridge");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to attach AndroidFileBridge", e);
        }

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action) || Intent.ACTION_EDIT.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }

        if (uri == null) return;
        Log.i(TAG, "Received file intent with URI: " + uri);

        copyUriAndNotifyWeb(uri);
    }

    private void copyUriAndNotifyWeb(Uri uri) {
        new Thread(() -> {
            try {
                String displayName = queryDisplayName(uri);
                if (displayName == null || displayName.trim().isEmpty()) {
                    displayName = "imported_model.step";
                }

                File cacheDir = new File(getCacheDir(), "opened_models");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }

                File destFile = new File(cacheDir, displayName);
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(destFile)) {
                    byte[] buffer = new byte[65536];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                    out.flush();
                }

                final String absPath = destFile.getAbsolutePath();
                final String finalName = displayName;
                Log.i(TAG, "Copied intent file to: " + absPath + " (" + finalName + ")");

                runOnUiThread(() -> {
                    pendingFilePath = absPath;
                    pendingFileName = finalName;
                    sendToWebView(absPath, finalName);
                });
            } catch (Exception e) {
                Log.e(TAG, "Error handling file from intent", e);
            }
        }).start();
    }

    private String queryDisplayName(Uri uri) {
        String displayName = null;
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int colIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (colIdx >= 0) {
                        displayName = cursor.getString(colIdx);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not query display name from content resolver", e);
            }
        }
        if (displayName == null || displayName.trim().isEmpty()) {
            displayName = uri.getLastPathSegment();
        }
        return displayName;
    }

    private void sendToWebView(String filePath, String fileName) {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            String safePath = filePath.replace("\\", "\\\\").replace("'", "\\'");
            String safeName = fileName.replace("\\", "\\\\").replace("'", "\\'");
            String js = "if (window.handleAndroidOpenFile) { window.handleAndroidOpenFile('" + safePath + "', '" + safeName + "'); }";
            webView.evaluateJavascript(js, null);
        }
    }

    public class AndroidFileInterface {
        @JavascriptInterface
        public String getPendingFilePath() {
            return pendingFilePath;
        }

        @JavascriptInterface
        public String getPendingFileName() {
            return pendingFileName;
        }

        @JavascriptInterface
        public void clearPendingFile() {
            pendingFilePath = null;
            pendingFileName = null;
        }

        @JavascriptInterface
        public void notifyWebReady() {
            if (pendingFilePath != null && pendingFileName != null) {
                runOnUiThread(() -> sendToWebView(pendingFilePath, pendingFileName));
            }
        }
    }
}
