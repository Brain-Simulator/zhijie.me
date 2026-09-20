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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json({ error: "Server is not configured" }, 500);

  try {
    const form = await req.formData();
    const file = form.get("photo");
    const location = String(form.get("location") || "").trim();
    const caption = String(form.get("caption") || "").trim().slice(0, 160);
    const takenAt = String(form.get("taken_at") || "").trim();
    const latRaw = String(form.get("latitude") || "").trim();
    const lngRaw = String(form.get("longitude") || "").trim();

    if (!(file instanceof File)) return json({ error: "请选择照片" }, 400);
    if (!location || location.length > 120) return json({ error: "请填写有效拍摄地点" }, 400);
    if (!file.type.startsWith("image/")) return json({ error: "只允许上传图片" }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: "单张照片不能超过 20MB" }, 413);

    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    };
    const ext = extByMime[file.type] || "jpg";
    const now = new Date();
    const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

    const client = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: uploadError } = await client.storage
      .from("trip-photos")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) return json({ error: "照片上传失败" }, 500);

    const latitude = latRaw ? Number(latRaw) : null;
    const longitude = lngRaw ? Number(lngRaw) : null;
    const safeTakenAt = takenAt && !Number.isNaN(Date.parse(takenAt)) ? new Date(takenAt).toISOString() : null;

    const { error: insertError } = await client.from("trip_photos").insert({
      storage_path: path,
      location,
      caption: caption || null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      taken_at: safeTakenAt,
    });

    if (insertError) {
      await client.storage.from("trip-photos").remove([path]);
      return json({ error: "照片信息保存失败" }, 500);
    }

    return json({ ok: true });
  } catch {
    return json({ error: "上传请求无效" }, 400);
  }
});
