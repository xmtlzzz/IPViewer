# IPViewer — 离线 IP 地址池登记工具

一个**纯前端单文件**的 IP 地址管理（IPAM）小工具：双击 `index.html` 即可用，无需安装、无需联网、无任何外部依赖。

## 快速开始

1. 双击 `index.html`（推荐 Microsoft Edge 或 Chrome，需 2022 年 6 月后的版本）
2. 左侧「＋ 新增」创建网段（如 `192.168.10.0/24`）
3. 点击格子图中的格子，登记设备信息

## 功能

### 格子图可视化
- 每个地址一格，格子显示 IP 末字节，颜色区分状态
- 四态：**已分配**（绿）/ **空闲**（灰）/ **预留**（蓝）/ **冲突**（红）
- 网络/广播地址以灰底斜纹显示，不可标记为已分配
- 密度（16/32/64 列）与字号（小/中/大）可调
- 支持任意掩码：/24、/25、/30、/31、/32 等
- 超过 4096 地址（/20 以下）的网段自动停用格子图，防止浏览器卡顿

### IP 详情登记
点击格子打开右侧面板，可编辑：
- 状态（点击即保存）
- 设备名称、主机名/域名、管理 IP、使用接口（如 Vlanif4）、MAC 地址、用途、设备类型、备注
- 管理 IP / MAC 做格式软校验（提示但不阻断保存）
- 键盘 ←/→/↑/↓ 可在相邻格子间切换，Esc 关闭

### 数据持久化
- 数据保存在**本机浏览器 localStorage**（实测单源约 9.9MB，通常可存约 1.5~2 万条记录，取决于字段长度）
- 底部状态栏实时显示记录数与占用体积，超过 3MB 变黄提醒
- ⚠️ **清除浏览器数据 = 数据丢失**。请定期「导出备份」！

### 导入 / 导出

| 操作 | 格式 | 说明 |
|---|---|---|
| 导出备份 / 导入备份 | JSON | 全量数据备份/迁移（换机器、恢复用） |
| 导入表格 | .xlsx / .csv | 首次导入进入列映射向导，映射关系自动记住；旧浏览器仅开放 CSV |
| 导出表格 | .xlsx / .csv | 导出全部登记记录，Excel 直接打开无乱码 |

**列映射向导**：导入 Excel/CSV 时，将文件列（IP、设备名称、主机名、MAC…）映射到工具字段。IP 为必选；文件含「所属网段」列时可自动分组建网段，否则需指定目标网段。相同表头的文件下次导入免映射。

顶部「状态规则」可独立编辑导入状态关键词（正则 → 四种状态），不必重新打开导入向导。

**失误保护**：导入/恢复操作前自动备份当前数据，底部状态栏提供「恢复上次导入前备份」。

### NetBox 同步（第一、二阶段）

顶部「导入 NetBox」支持将本地网段和已登记 IPv4 地址预览并同步到 NetBox：

- 网段 → `ipam/prefixes`；已分配地址 → `ipam/ip-addresses` 的 `active`；预留地址 → `reserved`
- 主机名映射到 `dns_name`，用途映射到 `description`，备注映射到 `comments`
- 空闲地址不创建；冲突地址默认跳过，也可在配置中明确映射为 `deprecated`
- 同步前先读取远端并展示新增/更新/跳过差异；默认不删除远端对象
- 第二阶段可选同步 Device、Interface 和接口 MAC：本地设备名称按站点匹配，接口按设备和接口名称匹配
- 设备策略默认为「仅关联已有」；选择「缺失时创建」时必须指定 Site、Device Role、Device Type，并使用所选 Interface Type 和设备状态
- 管理 IP 可作为额外 `IPAddress` 创建，并在接口和 IP 成功后设置为设备 `primary_ip4`；选择忽略时不会写入 NetBox
- 写入顺序固定为 Prefix → Device → Interface → IPAddress → Device 主 IPv4；创建返回的远端 ID 会自动注入后续请求
- 已有不同的 MAC、重复设备/接口、MAC 占用冲突或 IP 已关联其他对象时不会自动覆盖/改绑，风险会出现在预览和失败报告中

直接浏览器同步需要通过 HTTP 服务打开页面，并在 NetBox 中将页面来源加入精确的 CORS 白名单。例如：

```text
python -m http.server 8000
浏览器打开 http://localhost:8000/index.html
```

NetBox 配置需允许 `http://localhost:8000`，再在页面输入 NetBox 地址和 API Token。Token 只保存在当前页面内存，不会写入 `localStorage` 或 JSON 备份；不要将 `CORS_ORIGIN_ALLOW_ALL` 用作生产配置。双击 `file://` 打开时，浏览器通常会因来源和 CORS 限制无法访问 NetBox API。

### Cloudflare Worker 代理（推荐用于官方 Demo）

如果 `demo.netbox.dev` 没有允许你的 Pages 域名跨源访问，使用仓库内的 `worker/` 代理：

1. 安装 Node.js 18+，进入 `worker/` 后执行 `npm install`。
2. 编辑 `worker/wrangler.jsonc`：
   - `ALLOWED_ORIGINS` 填 Pages 的精确来源，例如 `https://your-project.pages.dev`；本地调试时可保留 `http://localhost:8000`。
   - `ALLOWED_NETBOX_ORIGINS` 填允许的 NetBox 来源，例如 `https://demo.netbox.dev`。多个来源用英文逗号分隔。
3. 登录 Cloudflare 后部署：

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

4. 复制部署得到的 `https://ipviewer-netbox-proxy.<account>.workers.dev` 地址。
5. 在页面「导入 NetBox」中填写：
   - NetBox 地址：`https://demo.netbox.dev`
   - Worker 代理地址：上一步得到的 Worker 地址
   - 官方 Demo 账号创建的 API Token；可填写裸 Token，也可直接粘贴完整的 `Bearer <token>` 或 `Token <token>` Authorization 值，认证方式会自动跟随完整值

代理只允许配置的来源、HTTPS NetBox 域名和 `/api/` 路径，并且只转发 `GET`、`POST`、`PATCH`。Token 从浏览器内存经 `Authorization` 头转发，不会写入 Worker 配置、日志、URL、`localStorage` 或 JSON 备份。Worker 不是 Token 保管服务；不要把 Token 固定写进 Worker。

更完整的本地调试、绑定自定义域名和更新白名单说明见 [`worker/README.md`](worker/README.md)。

## 数据安全须知

| 场景 | 数据是否安全 |
|---|---|
| 正常使用、刷新、重启浏览器 | ✅ 安全 |
| 清除浏览器缓存/站点数据 | ❌ 丢失 → 靠 JSON 导出恢复 |
| 换电脑/换浏览器 | ❌ 不跟随 → 靠 JSON 导出迁移 |

**建议**：每次大批量登记后点一次「导出备份」，把 JSON 文件存到网盘或 U 盘。

## 自测

在地址栏后加 `?selftest` 打开自检页面（`index.html?selftest`），自动运行 42 条断言覆盖 CIDR 计算、CSV 解析、列映射、zip/xlsx 编解码、NetBox IPAM/DCIM 映射与 Worker 请求配置等核心逻辑。

## 技术说明

- 单 HTML 文件（约 110KB），全部 CSS/JS 内联，零外链
- Excel 读写为自研 Mini-XLSX 实现（zip 解压用浏览器原生 `DecompressionStream`，导出用 STORE zip + CRC32），无第三方库
- CSV 自动识别 GBK/UTF-8 编码，导出带 BOM（Excel 双击不乱码）
- 数据 schema 带版本号，未来升级自动迁移
