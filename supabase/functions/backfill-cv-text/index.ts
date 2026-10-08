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
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  return { client, endpoint, bucketName };
}

// Minimal PDF text extraction using pdf-parse
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { default: pdfParse } = await import("npm:pdf-parse@1.1.1/lib/pdf-parse.js");
  const { Buffer } = await import("node:buffer");
  const data = await pdfParse(Buffer.from(bytes));
  return data.text || "";
}

// DOCX text extraction using mammoth
async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("npm:mammoth@1.8.0");
  const { Buffer } = await import("node:buffer");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get attachments with empty cv_text
    const { data: attachments, error: fetchErr } = await supabase
      .from("candidate_attachments")
      .select("id, file_path, file_name, mime_type")
      .is("deleted_at", null)
      .or("cv_text.is.null,cv_text.eq.")
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    const { client: r2, endpoint, bucketName } = getR2Client();
    const results: { id: string; file_name: string; status: string; chars?: number; error?: string }[] = [];

    for (const att of attachments || []) {
      try {
        // Download from R2
        const r2Url = `${endpoint}/${bucketName}/${att.file_path}`;
        const r2Resp = await r2.fetch(r2Url, { method: "GET" });

        if (!r2Resp.ok) {
          results.push({ id: att.id, file_name: att.file_name, status: "download_failed", error: `R2 ${r2Resp.status}` });
          continue;
        }

        const bytes = new Uint8Array(await r2Resp.arrayBuffer());
        let text = "";

        const isPdf = att.mime_type === "application/pdf" || att.file_name.endsWith(".pdf");
        const isDocx = att.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || att.file_name.endsWith(".docx");

        if (isPdf) {
          text = await extractPdfText(bytes);
        } else if (isDocx) {
          text = await extractDocxText(bytes);
        } else {
          results.push({ id: att.id, file_name: att.file_name, status: "skipped", error: "unsupported type" });
          continue;
        }

        if (text.trim().length === 0) {
          results.push({ id: att.id, file_name: att.file_name, status: "empty_text", chars: 0 });
          continue;
        }

        // Update cv_text
        const { error: updateErr } = await supabase
          .from("candidate_attachments")
          .update({ cv_text: text })
          .eq("id", att.id);

        if (updateErr) {
          results.push({ id: att.id, file_name: att.file_name, status: "update_failed", error: updateErr.message });
        } else {
          results.push({ id: att.id, file_name: att.file_name, status: "success", chars: text.length });
        }
      } catch (err: any) {
        results.push({ id: att.id, file_name: att.file_name, status: "error", error: err.message?.slice(0, 200) });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === "success").length,
      empty: results.filter(r => r.status === "empty_text").length,
      failed: results.filter(r => !["success", "empty_text", "skipped"].includes(r.status)).length,
      results,
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
