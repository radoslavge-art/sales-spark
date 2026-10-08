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

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  return { client, endpoint, bucketName };
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await verifyAuth(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const { client, endpoint, bucketName } = getR2Client();

    if (action === "upload") {
      const filePath = url.searchParams.get("path");
      const contentType = url.searchParams.get("contentType") || "application/octet-stream";
      if (!filePath) throw new Error("Missing path parameter");

      const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/');
      const body = await req.arrayBuffer();
      const r2Url = `${endpoint}/${bucketName}/${encodedPath}`;
      const r2Resp = await client.fetch(r2Url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });

      if (!r2Resp.ok) {
        const errText = await r2Resp.text();
        throw new Error(`R2 upload failed: ${r2Resp.status} ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, path: filePath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const filePath = url.searchParams.get("path");
      if (!filePath) throw new Error("Missing path parameter");

      const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/');
      const r2Url = `${endpoint}/${bucketName}/${encodedPath}`;
      const r2Resp = await client.fetch(r2Url, { method: "GET" });

      if (!r2Resp.ok) {
        throw new Error(`R2 download failed: ${r2Resp.status}`);
      }

      const blob = await r2Resp.arrayBuffer();
      const ct = r2Resp.headers.get("content-type") || "application/octet-stream";

      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": ct,
          "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"`,
        },
      });
    }

    if (action === "signed-url") {
      const filePath = url.searchParams.get("path");
      const expiresIn = parseInt(url.searchParams.get("expiresIn") || "60", 10);
      if (!filePath) throw new Error("Missing path parameter");

      const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/');
      // Generate a presigned GET URL
      const r2Url = `${endpoint}/${bucketName}/${encodedPath}`;
      const signed = await client.sign(r2Url, {
        method: "GET",
        aws: { signQuery: true, datetime: new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z" },
        headers: {},
      });

      return new Response(JSON.stringify({ signedUrl: signed.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const body = await req.json();
      const paths: string[] = body.paths || [];
      if (paths.length === 0) throw new Error("Missing paths");

      // Delete files one by one from R2
      const results = [];
      for (const filePath of paths) {
        const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/');
        const r2Url = `${endpoint}/${bucketName}/${encodedPath}`;
        const r2Resp = await client.fetch(r2Url, { method: "DELETE" });
        results.push({ path: filePath, ok: r2Resp.ok });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("r2-storage error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
