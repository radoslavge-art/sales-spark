import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Rule {
  type: string;
  title: string;
  severity: "high" | "medium" | "low";
  check: (logs: any[], userId: string) => { triggered: boolean; description: string; metadata: Record<string, any> };
}

const WINDOW_MINUTES = 10;

const RULES: Rule[] = [
  {
    type: "bulk_delete",
    title: "Bulk deletions detected",
    severity: "high",
    check: (logs, userId) => {
      const deletes = logs.filter(
        (l) => l.user_id === userId && (l.action.includes("delete") || l.action.includes("Delete"))
      );
      if (deletes.length >= 5) {
        return {
          triggered: true,
          description: `${deletes.length} delete actions in ${WINDOW_MINUTES} minutes`,
          metadata: {
            delete_count: deletes.length,
            actions: deletes.map((d: any) => d.action).slice(0, 10),
            window_minutes: WINDOW_MINUTES,
          },
        };
      }
      return { triggered: false, description: "", metadata: {} };
    },
  },
  {
    type: "high_volume",
    title: "Unusually high activity volume",
    severity: "medium",
    check: (logs, userId) => {
      const userLogs = logs.filter((l) => l.user_id === userId);
      if (userLogs.length >= 50) {
        return {
          triggered: true,
          description: `${userLogs.length} actions in ${WINDOW_MINUTES} minutes`,
          metadata: {
            action_count: userLogs.length,
            window_minutes: WINDOW_MINUTES,
            action_breakdown: userLogs.reduce((acc: Record<string, number>, l: any) => {
              acc[l.action] = (acc[l.action] || 0) + 1;
              return acc;
            }, {}),
          },
        };
      }
      return { triggered: false, description: "", metadata: {} };
    },
  },
  {
    type: "rapid_moves",
    title: "Rapid card movements",
    severity: "low",
    check: (logs, userId) => {
      const moves = logs.filter(
        (l) => l.user_id === userId && l.action === "move_card"
      );
      if (moves.length >= 15) {
        return {
          triggered: true,
          description: `${moves.length} card moves in ${WINDOW_MINUTES} minutes — possible automation or misuse`,
          metadata: {
            move_count: moves.length,
            window_minutes: WINDOW_MINUTES,
          },
        };
      }
      return { triggered: false, description: "", metadata: {} };
    },
  },
  {
    type: "data_export_spike",
    title: "Mass data access pattern",
    severity: "medium",
    check: (logs, userId) => {
      const userLogs = logs.filter((l) => l.user_id === userId);
      // Diverse entity access: if user touches many different entity_ids
      const uniqueEntities = new Set(userLogs.map((l: any) => l.entity_id).filter(Boolean));
      if (uniqueEntities.size >= 20) {
        return {
          triggered: true,
          description: `Accessed ${uniqueEntities.size} distinct entities in ${WINDOW_MINUTES} minutes`,
          metadata: {
            unique_entities: uniqueEntities.size,
            window_minutes: WINDOW_MINUTES,
          },
        };
      }
      return { triggered: false, description: "", metadata: {} };
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

    // Fetch recent activity logs
    const { data: recentLogs, error: logError } = await supabase
      .from("activity_logs")
      .select("*")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false });

    if (logError) throw logError;
    if (!recentLogs?.length) {
      return new Response(JSON.stringify({ ok: true, alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique user IDs from recent logs
    const userIds = [...new Set(recentLogs.map((l: any) => l.user_id))];

    let alertsCreated = 0;

    for (const userId of userIds) {
      for (const rule of RULES) {
        const result = rule.check(recentLogs, userId);
        if (!result.triggered) continue;

        // Check if we already alerted for this user+type in the last hour (debounce)
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("security_alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("alert_type", rule.type)
          .gte("created_at", oneHourAgo)
          .limit(1);

        if (existing?.length) continue;

        await supabase.from("security_alerts").insert({
          user_id: userId,
          alert_type: rule.type,
          severity: rule.severity,
          title: rule.title,
          description: result.description,
          metadata: result.metadata,
          status: "open",
        });
        alertsCreated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, alerts: alertsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
