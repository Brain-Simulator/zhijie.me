import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash));
}

async function equalSecret(a: string, b: string) {
  const [ha, hb] = await Promise.all([digest(a), digest(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const galleryPassword = Deno.env.get("GALLERY_PASSWORD");

  if (!supabaseUrl || !serviceRole || !galleryPassword) {
    return json({ error: "Server is not configured" }, 500);
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password || "");
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (!(await equalSecret(password, galleryPassword))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const client = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client
    .from("trip_photos")
    .select("id, storage_path, location, caption, latitude, longitude, taken_at, uploaded_at")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false });

  if (error) return json({ error: "读取照片失败" }, 500);

  const photos = [];
  for (const row of data || []) {
    const { data: signed, error: signError } = await client.storage
      .from("trip-photos")
      .createSignedUrl(row.storage_path, 3600);

    if (!signError && signed?.signedUrl) {
      photos.push({
        id: row.id,
        url: signed.signedUrl,
        location: row.location,
        caption: row.caption,
        latitude: row.latitude,
        longitude: row.longitude,
        taken_at: row.taken_at,
        uploaded_at: row.uploaded_at,
      });
    }
  }

  return json({ photos });
});
