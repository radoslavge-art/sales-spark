import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authentication: pg_net triggers send service_role via x-sync-secret header
    const authHeader = req.headers.get("Authorization");
    const internalSecret = req.headers.get("x-sync-secret");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isInternal = internalSecret === SERVICE_ROLE_KEY;

    // For non-internal calls, verify JWT (allow if valid authenticated user)
    let authenticated = isInternal;
    if (!authenticated && authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.replace("Bearer ", "");
      if (bearerToken === SERVICE_ROLE_KEY) {
        authenticated = true;
      } else {
        const supabaseLocal = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: userErr } =
          await supabaseLocal.auth.getUser(bearerToken);
        if (!userErr && user) {
          authenticated = true;
        }
      }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { table, operation, record, old_record } = body;

    if (!table || !operation) {
      return new Response(
        JSON.stringify({ error: "Missing table or operation" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!extUrl || !extKey) {
      return new Response(
        JSON.stringify({ error: "External Supabase not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const extClient = createClient(extUrl, extKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let result;

    if (operation === "DELETE") {
      const id = old_record?.id || record?.id;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "No id for delete" }),
          { status: 400, headers: corsHeaders }
        );
      }
      // For tables with composite PKs (like google_calendar_tokens using user_id)
      if (table === "google_calendar_tokens") {
        const userId = old_record?.user_id || record?.user_id;
        result = await extClient.from(table).delete().eq("user_id", userId);
      } else {
        result = await extClient.from(table).delete().eq("id", id);
      }
    } else if (operation === "INSERT" || operation === "UPDATE") {
      // Upsert handles both insert and update
      const onConflict =
        table === "google_calendar_tokens" ? "user_id" : "id";
      result = await extClient
        .from(table)
        .upsert(record, { onConflict });
    } else if (operation === "FULL_SYNC") {
      // Full table sync - fetch all from local, upsert to external
      const localClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const tables = [
        "companies",
        "positions",
        "stages",
        "owners",
        "candidates",
        "profiles",
        "user_roles",
        "activities",
        "activity_logs",
        "board_activities",
        "boards",
        "board_columns",
        "board_tasks",
        "board_members",
        "personal_columns",
        "personal_tasks",
        "candidate_attachments",
        "candidate_comments",
        "candidate_emails",
        "interviews",
        "notifications",
        "google_calendar_tokens",
        "security_alerts",
        "user_sessions",
        "weekly_reports",
        "weekly_report_rows",
        "sales_sheets",
        "sales_leads",
      ];

      const results: Record<string, string> = {};
      for (const t of tables) {
        try {
          // Fetch all rows (paginated)
          const allRows: any[] = [];
          let from = 0;
          const batchSize = 500;
          while (true) {
            const { data, error } = await localClient
              .from(t)
              .select("*")
              .range(from, from + batchSize - 1);
            if (error) {
              results[t] = `fetch_error: ${error.message}`;
              break;
            }
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < batchSize) break;
            from += batchSize;
          }

          if (allRows.length > 0 && !results[t]) {
            const onConflict = t === "google_calendar_tokens" ? "user_id" : "id";
            // Upsert in batches of 200
            for (let i = 0; i < allRows.length; i += 200) {
              const batch = allRows.slice(i, i + 200);
              const { error: upsertErr } = await extClient
                .from(t)
                .upsert(batch, { onConflict });
              if (upsertErr) {
                results[t] = `upsert_error at batch ${i}: ${upsertErr.message}`;
                break;
              }
            }
            if (!results[t]) {
              results[t] = `synced ${allRows.length} rows`;
            }
          } else if (!results[t]) {
            results[t] = "0 rows";
          }
        } catch (e) {
          results[t] = `error: ${e.message}`;
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result?.error) {
      console.error(`Sync error for ${table}:`, result.error);
      return new Response(
        JSON.stringify({
          error: result.error.message,
          table,
          operation,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ ok: true, table, operation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sync function error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
