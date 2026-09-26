# 网页版数轴实验

Experiment: `Number Line_exp` · DataPipe ID: `9g92tharOXFX`

## 本地运行

安装 Node.js 后，在本目录运行 `node server.cjs`，打开 http://127.0.0.1:8000 。不要直接双击 HTML；请使用 HTTP 或 HTTPS。

## 实验设计

参考桌面的 `数轴实验(1).py`，未修改原文件。3 个练习数字为 10、50、90；22 个正式数字为 2、4、9、11、14、17、23、26、31、38、44、45、52、59、61、66、73、78、84、86、92、99，每位被试独立 Fisher–Yates 随机排序。数轴宽度最大 600 CSS 像素，小屏幕自适应。

每题先显示数轴 1000ms，再显示目标数字并开始计时；首次左键/主指针点击锁定，确认 1000ms 后进入下一题。仅数轴附近 64px 高的点击区域有效。目标出现前及锁定期间的点击忽略。反应时使用单调时钟 performance.now()。浏览器帧调度和设备延迟仍可能影响时序；本实现不保证 PsychoPy 级的呈现精度。

按要求修正原程序的端点映射：click_ratio=(点击横坐标−数轴左端)/数轴宽度，范围 0–1；estimated_number=1+99×click_ratio，不取整。signed_error=estimated_number−target_number，absolute_error=abs(signed_error)。不沿用原程序每单位 6px 的不一致映射。正式阶段不提供准确性反馈。

## 数据

每次完成运行上传一个 CSV，含 25 行（practice 3 行、formal 22 行）。文件名 `numberline_<participant_id>_<本地YYYYMMDD_HHMMSS>_<随机会话ID前8位>.csv`，随机后缀避免同秒重名。participant_id 限 1–40 位字母、数字、下划线、短横线；不要使用姓名。

字段：participant_id、phase、trial_index（全程从0开始）、trial_order（各阶段从1开始）、target_number、click_ratio、estimated_number、signed_error、absolute_error、reaction_time_ms、timestamp（UTC ISO 8601）、screen_width、screen_height（screen CSS像素）、user_agent，另含 viewport_width、viewport_height、session_id、is_test。

## DataPipe

后台需开启 Accept new data。Data validation 保留 Allow CSV；Required fields 建议设置 participant_id、phase、target_number，或本项目列出的其他实际列名。新建 DataPipe 实验默认要求的 trial_type 不在本自定义 CSV 中，应替换为实际列名，否则会返回 INVALID_DATA。不要为解决该问题关闭全部校验。若开启 session limit，请设置合适的总样本数，并计入测试提交。

使用官方 `datapipe-client@0.2.0`，固定版本并将原版浏览器 bundle 保存在 vendor 目录，避免运行时 CDN 依赖。没有 API key 或 secret。通过 `DataPipe.saveData({experiment_id,filename,data})` 提交。必须检查返回对象的 ok、status 和 body，不能只依赖 try/catch，因为官方 saveData 用结果报告失败。

- HTTP 201：存储服务已接收，显示“实验已完成，感谢您的参与。”
- HTTP 202：DataPipe 已安全接收并排队，按官方要求视为提交成功，不重复上传；页面明确说明正在等待转存。这不能证明 Google Drive 中已经出现文件。
- 失败/异常：console.error 记录响应，显示“数据保存失败，请暂时不要关闭页面，并联系研究人员。”，提供 CSV 备份，不自动重传。

数据逐题备份到本标签页 sessionStorage，刷新可继续尚未完成的实验；上传中断或失败后刷新只提供备份，须由研究人员检查后台是否已接收。不要清除浏览器存储或关闭失败页面。sessionStorage 在关闭标签页后不保证保留。本版本仅在结束时向 DataPipe 上传，不启用云端逐题 staging。

研究人员确认后台未接收、且修复问题后，可勾选确认框手动重试。重试使用完全相同的文件名及数据，不生成新文件名绕过重复检测。后台已排队或已保存时不要重试。

官方参考：
- https://pipe.jspsych.org/docs/experiments/sending-data
- https://pipe.jspsych.org/docs/api
- https://github.com/jspsych/datapipe/tree/main/packages/client
- bundle 来源：https://unpkg.com/datapipe-client@0.2.0/dist/datapipe-client.browser.global.js

## 测试

访问 `http://127.0.0.1:8000/?test=1`，使用以 TEST 开头的编号。仍需完成全部 25 题，结束页显示行数、DataPipe 响应和捕获的浏览器异常。测试数据也会上传到真实 experiment，CSV 的 is_test=true；分析时应排除。普通地址 is_test=false。不要向真实实验重复提交已有文件名。

运行 `node --test tests.cjs` 执行不联网的状态/计算测试（7项），覆盖25题、数据字段、端点、反应时、点击锁定以及201/202/失败处理；这不能替代浏览器真实上传测试。

## GitHub Pages 部署准备

纯静态项目，无构建步骤、无后端、无密钥。所有资源使用相对路径，兼容 GitHub Pages 子路径；包含 .nojekyll。部署仅需发布 index.html、experiment.js、style.css、vendor/ 与 .nojekyll。

创建自己的 GitHub 仓库，关联 remote 并推送 main。在仓库 Settings → Pages 中选择 Deploy from a branch，main / (root)。仓库创建、推送和 Pages 发布尚需实际完成。公开仓库不得包含被试 CSV（已被 .gitignore 排除）。上线后应再在 Pages 的 HTTPS 地址完成一次测试，以核实真实被试网络下的上传。
