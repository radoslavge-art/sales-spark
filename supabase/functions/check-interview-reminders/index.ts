import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();

    // Windows: 1 hour (55-65 min) and 1 day (23h55m - 24h05m)
    const windows = [
      { key: "1h", minMs: 55 * 60000, maxMs: 65 * 60000, label: "in 1 hour" },
      { key: "1d", minMs: 23 * 3600000 + 55 * 60000, maxMs: 24 * 3600000 + 5 * 60000, label: "tomorrow" },
    ];

    let created = 0;

    for (const w of windows) {
      const from = new Date(now.getTime() + w.minMs).toISOString();
      const to = new Date(now.getTime() + w.maxMs).toISOString();

      // Fetch scheduled interviews in window
      const { data: interviews } = await supabase
        .from("interviews")
        .select("id, user_id, title, scheduled_at, candidate_id")
        .eq("status", "scheduled")
        .gte("scheduled_at", from)
        .lte("scheduled_at", to);

      if (!interviews?.length) continue;

      // Get unique user ids and their reminder settings
      const userIds = [...new Set(interviews.map((i: any) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, reminder_settings")
        .in("id", userIds);

      const settingsMap = new Map(
        (profiles || []).map((p: any) => [p.id, p.reminder_settings || { "1h": true, "1d": true }])
      );

      for (const interview of interviews) {
        const settings = settingsMap.get(interview.user_id) || { "1h": true, "1d": true };
        if (!settings[w.key]) continue;

        // Check if we already sent this reminder
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", interview.user_id)
          .eq("entity_id", interview.id)
          .eq("type", `reminder_${w.key}`)
          .limit(1);

        if (existing?.length) continue;

        // Create notification
        await supabase.from("notifications").insert({
          user_id: interview.user_id,
          type: `reminder_${w.key}`,
          entity_type: "interview",
          entity_id: interview.id,
          content: `Interview "${interview.title}" is ${w.label}`,
        });
        created++;
      }
    }

    return new Response(JSON.stringify({ ok: true, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
