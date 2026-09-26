# 本地测试记录 · 2026-09-26

## 已完成

- 原始 Python 文件未修改：SHA256 `F6E4AADD11D81F6C017EB421BE78A9DC434DFAB6B368158E4A1DD87D67767758`，两次哈希检查一致。
- 创建 index.html、experiment.js、style.css、README.md、.gitignore，另含固定版 vendor、server.cjs、tests.cjs、.nojekyll。
- 本地 HTTP 服务地址：http://127.0.0.1:8000 。
- 浏览器真实走完 participant_id、指导语、3个练习、22个随机正式试次和上传结束页。测试URL包含 `?test=1`，CSV is_test=true。
- `node --test tests.cjs`：7/7通过。覆盖字段、目标数字集合、端点计算、阶段顺序、123ms模拟反应时、准备期间点击忽略、重复点击锁定、201/202/400/500/网络错误与异常。
- 390×844窄屏欢迎页检查：documentElement.scrollWidth=clientWidth=390，无水平溢出；已恢复默认浏览器视口。
- JavaScript语法检查通过；浏览器未捕获运行时错误或未处理Promise异常。Console包含两次真实拒收测试的预期错误日志，成功重试后仅新增成功info日志。

## 真实 DataPipe 上传

Experiment: Number Line_exp

ID: `9g92tharOXFX`

成功文件：`numberline_997_20260926_175848_4d2a71fa.csv`

行数：25（practice=3，formal=22）。被试编号为测试时在页面填写的997；is_test=true，正式分析应排除此文件。

最终请求返回：

```json
{"ok":true,"status":201,"body":{"message":"Success","metadataMessage":""}}
```

成功响应时间：2026-09-26T10:03:00.469Z（北京时间18:03）。Google Drive页面已实际显示该CSV，大小9KB。

文件夹：https://drive.google.com/drive/u/0/folders/1fSjjFr0XJVFNHTAI2I1I5q0TFoFig-NQ

首次测试返回DATA_COLLECTION_NOT_ACTIVE；用户开启收集后，第二次完整数据提交返回INVALID_DATA。已在后台核实默认trial_type必填项不匹配本项目，按用户授权将必填字段改为participant_id、phase、target_number，保留CSV支持和数据校验。随后在同一测试页，用相同文件名和完整数据手动重试成功。

早期被拒收文件 `numberline_TEST_S001_20260926_175014_3baa9d0a.csv` 未确认上传；其原标签页后来不可访问。成功文件为上方997文件，请勿将两者混淆。

## Git / GitHub Pages

本地已执行 `git init -b main`，.git目录存在。Git暂存操作被当前工具环境拒绝写入.git/index.lock，即使申请目录权限后仍未成功，因此文件尚未暂存/提交。未伪造Git作者身份。

项目为可直接部署的纯静态站点，资源均采用相对路径，无构建依赖；官方DataPipe客户端已固定在vendor中。部署包不含任何CSV或凭据。尚未绑定GitHub remote、推送或启用Pages，也没有声称已经上线。

后续：在用户Git环境配置真实作者身份并提交，关联用户指定仓库，推送main，再选择Settings → Pages → Deploy from a branch → main / (root)。上线后在HTTPS域名再做一次测试，正式招募前核实样本量限制与Accept new data。
