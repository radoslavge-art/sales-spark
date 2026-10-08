import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let totalDeleted = 0;

    // Delete in FK-safe order: children first, then parents

    // 1. Candidate-related children
    const childTables = [
      "candidate_comments",
      "candidate_attachments",
    ];
    for (const table of childTables) {
      // Find candidates being purged and delete their children
      const { data: expiredCandidates } = await supabase
        .from("candidates")
        .select("id")
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoff);

      if (expiredCandidates && expiredCandidates.length > 0) {
        const ids = expiredCandidates.map((c: any) => c.id);
        const { count, error } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .in("candidate_id", ids);
        if (error) console.error(`Error purging ${table}:`, error.message);
        else totalDeleted += count || 0;
      }
    }

    // 2. Leaf tables (no FK dependents)
    const leafTables = [
      "board_tasks",
      "personal_tasks",
      "candidates",
    ];
    for (const table of leafTables) {
      const { count, error } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoff);
      if (error) console.error(`Error purging ${table}:`, error.message);
      else totalDeleted += count || 0;
    }

    // 3. Column tables (after tasks are gone)
    const columnTables = ["board_columns", "personal_columns"];
    for (const table of columnTables) {
      const { count, error } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoff);
      if (error) console.error(`Error purging ${table}:`, error.message);
      else totalDeleted += count || 0;
    }

    // 4. Parent tables
    const parentTables = [
      "stages",
      "positions",
      "boards",
      "companies",
      "owners",
    ];
    for (const table of parentTables) {
      const { count, error } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoff);
      if (error) console.error(`Error purging ${table}:`, error.message);
      else totalDeleted += count || 0;
    }

    console.log(`Purged ${totalDeleted} rows older than 30 days`);

    return new Response(JSON.stringify({ purged: totalDeleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Purge error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
