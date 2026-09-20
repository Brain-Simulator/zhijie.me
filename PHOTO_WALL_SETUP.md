# 照片墙一次性配置

当前仓库已经包含照片墙前端与 Supabase 后端代码。GitHub Pages 仍负责静态网页；Supabase 只负责私有照片存储、元数据和两个 Edge Functions。

## 1. 创建 Supabase 项目

在 Supabase 新建一个项目，记下 Project Reference（项目 URL 中 `https://<PROJECT_REF>.supabase.co` 的那段）。

## 2. 初始化数据库与私有照片桶

打开 Supabase Dashboard → SQL Editor，执行仓库中的：

`supabase/schema.sql`

它会创建：
- `trip_photos` 照片元数据表
- 私有 Storage bucket：`trip-photos`
- RLS；没有匿名读取策略，因此浏览器不能绕过照片墙直接列出照片

## 3. 设置照片墙查看密码

安装并登录 Supabase CLI 后，在仓库目录执行：

```bash
supabase link --project-ref <PROJECT_REF>
supabase secrets set GALLERY_PASSWORD='你要使用的查看密码'
```

查看密码只保存在 Supabase Secret 中，不要写进 `index.html`、README 或 GitHub Secrets 的日志输出。

## 4. 部署两个 Edge Functions

```bash
supabase functions deploy photo-upload --no-verify-jwt
supabase functions deploy photo-gallery --no-verify-jwt
```

功能：
- `photo-upload`：无需密码，允许上传图片，单张最大 20MB
- `photo-gallery`：必须提供正确查看密码，才会返回私有图片的临时签名 URL

## 5. 把 Project Reference 填进网页

编辑 `index.html`，找到：

```js
const PHOTO_API_BASE='https://YOUR_PROJECT.supabase.co/functions/v1';
```

改成：

```js
const PHOTO_API_BASE='https://<PROJECT_REF>.supabase.co/functions/v1';
```

提交到 `main` 后，GitHub Pages 会自动更新。

## 6. 照片地点规则

上传时：
1. 浏览器优先读取照片 EXIF GPS；
2. 如果 GPS 靠近本次行程中的乌鲁木齐、福海、阿勒泰、阿禾公路、禾木、贾登峪、喀纳斯、布尔津、乌尔禾、独山子，会自动填“某地附近”；
3. 没有 GPS 时必须手动填写地点；
4. 每张照片在照片墙上都会显示 📍拍摄地点。

## 安全说明

“查看带密码”不能仅用 JavaScript 在 GitHub Pages 前端判断，否则懂浏览器开发者工具的人可以绕过。当前方案将照片保持为私有对象，并在 Edge Function 服务端校验密码。

“上传不带密码”意味着互联网上知道接口地址的人理论上都能向照片桶上传内容。当前函数已限制为图片且单张不超过 20MB。如果网站公开传播，建议后续再加 Cloudflare Turnstile、速率限制或上传总量告警，仍然可以保持用户侧“无需密码上传”。
