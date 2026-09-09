# IPViewer NetBox Worker Proxy

这个 Worker 解决浏览器直接请求 NetBox 时的 CORS 限制。它不保存 Token，也不保存同步数据，只在当前请求中把 IPViewer 的 API 请求转发给允许的 NetBox 来源。

## 部署

### 1. 配置允许来源

编辑 `wrangler.jsonc`：

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://your-project.pages.dev",
  "ALLOWED_NETBOX_ORIGINS": "https://demo.netbox.dev"
}
```

`ALLOWED_ORIGINS` 必须是 IPViewer 页面实际的完整来源，包含协议，不要填写路径。Worker 会自动忽略配置值末尾多余的 `/`。本地 HTTP 服务可以配置为：

```jsonc
"ALLOWED_ORIGINS": "http://localhost:8000,http://127.0.0.1:8000"
```

`ALLOWED_NETBOX_ORIGINS` 是目标白名单。代理只接受 HTTPS NetBox 来源；多个值用英文逗号分隔。不要使用 `*`。

### 2. 安装并部署

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

部署结果会显示 Worker 地址，例如：

```text
https://ipviewer-netbox-proxy.<account>.workers.dev
```

如果修改了允许来源或目标白名单，重新执行 `npx wrangler deploy`。这些配置不是 Token，不需要使用 `wrangler secret`。

### 3. 在 IPViewer 中使用

打开 Pages 上的 IPViewer，点击「导入 NetBox」并填写：

- NetBox 地址：`https://demo.netbox.dev`
- Worker 代理地址：部署得到的 Worker URL
- API Token：NetBox 账号中创建的 Token

Worker 地址留空时，IPViewer 会继续使用浏览器直连模式。

## 本地运行

先在 `wrangler.jsonc` 中保留本地来源，然后执行：

```bash
cd worker
npm run dev
```

本地 Worker 通常是 `http://localhost:8787`。如果页面通过 `http://localhost:8000` 打开，在 IPViewer 的「Worker 代理地址」中填写这个地址即可。

## 安全边界

- 请求必须带有 `ALLOWED_ORIGINS` 中的精确 `Origin`。
- 目标必须是 `ALLOWED_NETBOX_ORIGINS` 中的 HTTPS 来源。
- 目标路径必须位于 NetBox `/api/` 路径下。
- 只允许 `GET`、`POST`、`PATCH`，不提供删除代理。
- 只转发 `Accept`、`Authorization`、`Content-Type`，不记录请求头或请求体。
- 上游响应按流转发，不在 Worker 中读取或持久化响应内容。
- Worker 拒绝超过 5 MiB 的请求体；IPViewer 客户端会在资源依赖顺序不变的前提下按每批最多 100 项、约 3.5 MiB 分块发送，并在临时错误时重试。

CORS 不是身份认证。任何能使用允许来源页面的人仍可以使用自己输入的 NetBox Token，所以应在 NetBox 中使用最小权限 Token，并在不使用时撤销。不要把 Token 设置成 Worker 的变量、Secret 或硬编码常量。

## 自定义域名

可以在 Cloudflare Workers 控制台为 Worker 添加 Custom Domain，然后把该 HTTPS 地址填入 IPViewer。仍需把 IPViewer Pages 域名保留在 `ALLOWED_ORIGINS`，并重新部署 Worker。
