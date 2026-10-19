// Run once after `npx cap add android` (the GitHub workflow does this for you).
// Adds what Nova needs on Android that Capacitor does not add by itself:
//   - permissions: camera (photo questions), microphone (voice input), notifications (timer)
//   - a "share to Nova" intent filter, so any app's Share sheet can send text or a link to Nova
//   - MainActivity code that hands shared text to the web app
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (!existsSync(manifestPath)) { console.error('android/ not found — run `npx cap add android` first.'); process.exit(1); }
let m = await readFile(manifestPath, 'utf8');

const perms = ['android.permission.INTERNET', 'android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'];
for (const p of perms) if (!m.includes(`"${p}"`)) m = m.replace('<application', `<uses-permission android:name="${p}" />\n    <application`);
if (!m.includes('android.hardware.camera')) m = m.replace('<application', '<uses-feature android:name="android.hardware.camera" android:required="false" />\n    <application');
if (!m.includes('android.intent.action.SEND')) {
  m = m.replace(/(<activity[\s\S]*?<intent-filter>[\s\S]*?<\/intent-filter>)/, `$1
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>`);
}
// recognise-speech support on Android 11+
if (!m.includes('android.speech.RecognitionService')) m = m.replace('</manifest>', '    <queries>\n        <intent><action android:name="android.speech.RecognitionService" /></intent>\n        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>\n    </queries>\n</manifest>');
await writeFile(manifestPath, m);

const dir = 'android/app/src/main/java/app/nova/ai';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/MainActivity.java`, `package app.nova.ai;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import java.util.Locale;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/** Receives text shared from other apps and passes it to the web app (window.__novaShared + a 'nova-share' event). */
public class MainActivity extends BridgeActivity {
    private volatile int insTop = 0, insBottom = 0;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge: the app is drawn behind the status bar and the navigation bar, like ChatGPT
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ic.setAppearanceLightStatusBars(!night);
        ic.setAppearanceLightNavigationBars(!night);
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            insTop = bars.top;
            insBottom = Math.max(bars.bottom, ime.bottom);
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('nova-insets'))", null);
            }
            return insets;
        });
        tts = new TextToSpeech(this, status -> ttsReady = (status == TextToSpeech.SUCCESS));
        getBridge().getWebView().addJavascriptInterface(new InsetsBridge(), "NovaInsets");
        getBridge().getWebView().addJavascriptInterface(new TtsBridge(), "NovaTTS");
        handleShare(getIntent());
    }

    /** Safe-area sizes in CSS pixels for the web app. */
    public class InsetsBridge {
        @JavascriptInterface public float top() { return insTop / getResources().getDisplayMetrics().density; }
        @JavascriptInterface public float bottom() { return insBottom / getResources().getDisplayMetrics().density; }
    }

    /** Read-aloud: Android WebView has no speechSynthesis, so use the phone's own text-to-speech engine. */
    public class TtsBridge {
        @JavascriptInterface public void speak(String text, String lang) {
            if (!ttsReady || text == null) return;
            try { tts.setLanguage(Locale.forLanguageTag(lang == null ? "en-IN" : lang)); } catch (Exception e) { /* keep default */ }
            tts.stop();
            int i = 0, n = text.length();
            while (i < n) {
                int end = Math.min(n, i + 3500);
                tts.speak(text.substring(i, end), TextToSpeech.QUEUE_ADD, null, "nova" + i);
                i = end;
            }
        }
        @JavascriptInterface public void stop() { if (tts != null) tts.stop(); }
        @JavascriptInterface public boolean isSpeaking() { return tts != null && tts.isSpeaking(); }
    }

    @Override
    public void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null) return;
        if ("app.nova.ai.VOICE".equals(intent.getAction())) {
            // the home-screen widget's microphone button: open Nova and start voice input
            final String vjs = "window.__novaVoice=true;window.dispatchEvent(new Event('nova-voice'));";
            for (long d : new long[] {700, 2000}) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (getBridge() != null && getBridge().getWebView() != null) getBridge().eval(vjs, null);
                }, d);
            }
            return;
        }
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return;
        final String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return;
        final String js = "window.__novaShared=" + JSONObject.quote(text) + ";window.dispatchEvent(new Event('nova-share'));";
        // the page may still be loading on a cold start, so deliver a few times; the web app de-duplicates
        long[] delays = {600, 1800, 4000};
        for (long d : delays) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) getBridge().eval(js, null);
            }, d);
        }
    }
}
`);

// ---- Home-screen widget: "Ask Nova…" search bar + microphone ----
const res = 'android/app/src/main/res';
await mkdir(`${res}/xml`, { recursive: true }); await mkdir(`${res}/layout`, { recursive: true }); await mkdir(`${res}/drawable`, { recursive: true });
await writeFile(`${res}/xml/nova_widget_info.xml`, `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp" android:minHeight="56dp" android:targetCellWidth="4" android:targetCellHeight="1"
    android:updatePeriodMillis="0" android:resizeMode="horizontal" android:widgetCategory="home_screen"
    android:initialLayout="@layout/nova_widget" android:previewLayout="@layout/nova_widget" />
`);
await writeFile(`${res}/drawable/nova_widget_bg.xml`, `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FF14141C" />
    <stroke android:width="1dp" android:color="#FF2A2A3A" />
    <corners android:radius="28dp" />
</shape>
`);
await writeFile(`${res}/layout/nova_widget.xml`, `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/nova_widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
    android:background="@drawable/nova_widget_bg" android:gravity="center_vertical" android:orientation="horizontal"
    android:paddingStart="14dp" android:paddingEnd="8dp">
    <ImageView android:layout_width="26dp" android:layout_height="26dp" android:src="@mipmap/ic_launcher" android:contentDescription="Nova" />
    <TextView android:id="@+id/nova_widget_ask" android:layout_width="0dp" android:layout_height="wrap_content"
        android:layout_weight="1" android:paddingStart="12dp" android:text="Ask Nova anything…"
        android:textColor="#FFB9B6CE" android:textSize="15sp" android:maxLines="1" />
    <ImageButton android:id="@+id/nova_widget_mic" android:layout_width="44dp" android:layout_height="44dp"
        android:background="@android:color/transparent" android:src="@android:drawable/ic_btn_speak_now"
        android:contentDescription="Speak to Nova" />
</LinearLayout>
`);
await writeFile(`${dir}/NovaWidget.java`, `package app.nova.ai;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Home-screen search bar: tap to ask, tap the microphone to speak. */
public class NovaWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = new Intent(ctx, MainActivity.class).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent mic = new Intent(ctx, MainActivity.class).setAction("app.nova.ai.VOICE").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(ctx, 1, open, flags);
        PendingIntent micPi = PendingIntent.getActivity(ctx, 2, mic, flags);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.nova_widget);
            v.setOnClickPendingIntent(R.id.nova_widget_root, openPi);
            v.setOnClickPendingIntent(R.id.nova_widget_ask, openPi);
            v.setOnClickPendingIntent(R.id.nova_widget_mic, micPi);
            mgr.updateAppWidget(id, v);
        }
    }
}
`);
if (!m.includes('NovaWidget')) {
  m = m.replace('</application>', `    <receiver android:name=".NovaWidget" android:exported="false">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/nova_widget_info" />
        </receiver>
    </application>`);
  await writeFile(manifestPath, m);
}
console.log('android-patch: permissions, share intent, home-screen widget and MainActivity written');
