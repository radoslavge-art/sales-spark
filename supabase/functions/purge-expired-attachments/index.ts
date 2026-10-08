import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getR2Client() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
  const bucketName = Deno.env.get("R2_BUCKET_NAME")!;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    endpoint,
    bucketName,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find attachments older than 6 months
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffISO = cutoff.toISOString();

    const { data: expired, error: fetchError } = await supabase
      .from("candidate_attachments")
      .select("id, file_path")
      .is("deleted_at", null)
      .lt("created_at", cutoffISO)
      .limit(500);

    if (fetchError) throw fetchError;
    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ purged: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete files from R2
    const { client, endpoint, bucketName } = getR2Client();
    for (const a of expired) {
      const r2Url = `${endpoint}/${bucketName}/${a.file_path}`;
      await client.fetch(r2Url, { method: "DELETE" });
    }

    // Hard-delete metadata rows
    const ids = expired.map((a: any) => a.id);
    const { error: deleteError } = await supabase
      .from("candidate_attachments")
      .delete()
      .in("id", ids);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ purged: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});