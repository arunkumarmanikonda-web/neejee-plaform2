package com.neejee.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.net.URI;
import java.util.HashSet;
import java.util.Set;

public final class Home extends Activity {
    private static final int PAPER = Color.rgb(249,245,234), INK = Color.rgb(43,37,31), WINE = Color.rgb(115,52,53);
    private final Set<String> reviewHosts = new HashSet<>();
    private String origin;
    private int dp(int size) { return Math.round(getResources().getDisplayMetrics().density * size); }
    private Bitmap asset(String name) {
        try (InputStream in = getAssets().open(name)) { return BitmapFactory.decodeStream(in); }
        catch (Exception e) { throw new IllegalStateException("Missing app artwork", e); }
    }
    private LinearLayout.LayoutParams row(int height) { return new LinearLayout.LayoutParams(-1, height < 0 ? height : dp(height)); }
    private TextView heading(String text, int size) {
        TextView label = new TextView(this); label.setText(text); label.setTextSize(size); label.setTextColor(INK);
        label.setTypeface(Typeface.SERIF); label.setGravity(Gravity.START); return label;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(getAssets().open("review-hosts.txt"), "UTF-8"))) {
            String line; while ((line = reader.readLine()) != null) if (!line.isEmpty()) reviewHosts.add(line);
        } catch (Exception e) { throw new IllegalStateException("Mobile configuration unavailable", e); }
        String stored = getPreferences(MODE_PRIVATE).getString("origin", Origin.SHOP);
        try { origin = Origin.origin(Origin.checked(stored, reviewHosts)); } catch (Exception e) { origin = Origin.SHOP; }
        ScrollView page = new ScrollView(this); page.setBackgroundColor(PAPER); page.setFillViewport(true);
        page.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout column = new LinearLayout(this); column.setOrientation(LinearLayout.VERTICAL);
        page.addView(column); setContentView(page);
        ImageView mark = new ImageView(this); mark.setImageBitmap(asset("wordmark.png")); mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        mark.setPadding(dp(30),dp(14),dp(30),dp(14)); mark.setContentDescription("Neejee. Found. Personal."); column.addView(mark,row(72));
        ImageView campaign = new ImageView(this); campaign.setImageBitmap(asset("surkh.webp")); campaign.setScaleType(ImageView.ScaleType.CENTER_CROP);
        campaign.setContentDescription("Surkh, a vermilion saree with gold checks."); column.addView(campaign,row(240));
        LinearLayout nav = new LinearLayout(this); nav.setOrientation(LinearLayout.VERTICAL); nav.setPadding(dp(22),dp(16),dp(22),dp(16)); column.addView(nav,row(-2));
        nav.addView(heading("Sarees, suits & objects",27),row(-2));
        addButton(nav,"Enter the shop",true,() -> visit("/"));
        addButton(nav,"Try a saree with Aaina",false,() -> visit("/ai/mirror"));
        addButton(nav,"Shopping bag",false,() -> visit("/cart"));
        addButton(nav,"My account and orders",false,() -> visit("/account"));
        addButton(nav,"Staff console",false,() -> visit("/admin"));
        if (!reviewHosts.isEmpty()) addButton(nav,"Open a review link",false,this::review);
    }
    private void addButton(LinearLayout parent, String title, boolean primary, Runnable action) {
        Button button = new Button(this); button.setText(title); button.setAllCaps(false); button.setTextSize(16);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary ? WINE : Color.rgb(242,234,219)));
        button.setTextColor(primary ? Color.WHITE : INK); button.setOnClickListener(v -> action.run()); parent.addView(button,row(52));
    }
    private void visit(String path) { open(Uri.parse(origin + path)); }
    private boolean open(Uri url) {
        // Use the system browser's Custom Tab. Login, camera permission, payments and UPI handoffs stay with the browser.
        Intent intent = new Intent(Intent.ACTION_VIEW,url);
        Bundle extras = new Bundle(); extras.putBinder("android.support.customtabs.extra.SESSION",null);
        intent.putExtras(extras); intent.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR",PAPER);
        try { startActivity(intent); return true; }
        catch (ActivityNotFoundException e) {
            new AlertDialog.Builder(this).setTitle("Open Neejee").setMessage("Install or enable an HTTPS browser to open the shop.").setPositiveButton("Close",null).show();
            return false;
        }
    }
    private void review() {
        EditText field = new EditText(this); field.setSingleLine(); field.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        field.setHint("Paste the Neejee review link");
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Open a review link").setView(field)
            .setPositiveButton("Open",null).setNegativeButton("Cancel",null)
            .setNeutralButton("Use public shop",(d,w) -> {
                origin = Origin.SHOP; getPreferences(MODE_PRIVATE).edit().remove("origin").apply(); visit("/");
            }).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                URI uri = Origin.checked(field.getText().toString(), reviewHosts);
                if (open(Uri.parse(uri.toASCIIString()))) {
                    origin = Origin.origin(uri); getPreferences(MODE_PRIVATE).edit().putString("origin",origin).apply(); dialog.dismiss();
                }
            } catch (Exception e) { field.setError("Use the Neejee preview link supplied with this build."); }
        }));
        dialog.show();
    }
}
