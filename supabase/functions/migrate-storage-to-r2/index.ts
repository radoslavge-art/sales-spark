import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

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

    const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
    const bucketName = Deno.env.get("R2_BUCKET_NAME")!;
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const { data: attachments, error } = await supabase
      .from("candidate_attachments")
      .select("id, file_path, mime_type")
      .is("deleted_at", null);

    if (error) throw error;
    if (!attachments || attachments.length === 0) {
      return new Response(JSON.stringify({ migrated: 0, skipped: 0, alreadyInR2: 0, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { migrated: 0, skipped: 0, alreadyInR2: 0, errors: [] as string[] };

    for (const att of attachments) {
      try {
        // First check if file already exists in R2
        const encodedPath = att.file_path.split('/').map((s: string) => encodeURIComponent(s)).join('/');
        const r2CheckUrl = `${r2Endpoint}/${bucketName}/${encodedPath}`;
        const headResp = await r2.fetch(r2CheckUrl, { method: "HEAD" });
        if (headResp.ok) {
          results.alreadyInR2++;
          continue;
        }

        // Download from Supabase storage
        let arrayBuffer: ArrayBuffer | null = null;

        // Try 1: SDK download
        const { data: fileData, error: dlError } = await supabase.storage
          .from("candidate-attachments")
          .download(att.file_path);

        if (!dlError && fileData) {
          arrayBuffer = await fileData.arrayBuffer();
        }

        // Try 2: REST API with encoded path segments
        if (!arrayBuffer) {
          const encodedStoragePath = att.file_path.split('/').map((s: string) => encodeURIComponent(s)).join('/');
          const storageUrl = `${supabaseUrl}/storage/v1/object/candidate-attachments/${encodedStoragePath}`;
          const dlResp = await fetch(storageUrl, {
            headers: { Authorization: `Bearer ${serviceRoleKey}` },
          });
          if (dlResp.ok) {
            arrayBuffer = await dlResp.arrayBuffer();
          }
        }

        // Try 3: REST API with raw path
        if (!arrayBuffer) {
          const storageUrl2 = `${supabaseUrl}/storage/v1/object/candidate-attachments/${att.file_path}`;
          const dlResp2 = await fetch(storageUrl2, {
            headers: { Authorization: `Bearer ${serviceRoleKey}` },
          });
          if (dlResp2.ok) {
            arrayBuffer = await dlResp2.arrayBuffer();
          }
        }

        if (!arrayBuffer) {
          results.errors.push(`${att.file_path}: download failed from all sources`);
          continue;
        }

        // Upload to R2
        const r2Url = `${r2Endpoint}/${bucketName}/${encodedPath}`;
        const r2Resp = await r2.fetch(r2Url, {
          method: "PUT",
          headers: { "Content-Type": att.mime_type || "application/octet-stream" },
          body: arrayBuffer,
        });

        if (!r2Resp.ok) {
          const errText = await r2Resp.text();
          results.errors.push(`${att.file_path}: R2 upload failed (${r2Resp.status}) ${errText}`);
          continue;
        }

        results.migrated++;
      } catch (e) {
        results.errors.push(`${att.file_path}: ${String(e)}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
