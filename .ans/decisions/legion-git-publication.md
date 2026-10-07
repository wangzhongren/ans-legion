# Legion Runtime Git 发布记录

日期：2026-10-07。当前上下文仍为 ANS Governance。

客户直接指示将代码提交到 `git@github.com:wangzhongren/ans-legion.git`。此指示授权本项目的 Git 初始化、提交及向该仓库正常推送；现有桌面工作台验收继续执行。没有授权覆盖远端历史、发布 npm registry 或改动其他工作区。

## 发布范围

提交当前项目的源码、入口、包配置与锁文件、测试、设计与角色文档，以及不含私有派发凭据的治理和调度记录。历史 Python 源码保留；当前运行入口与桌面程序使用 Node/Electron。

不提交依赖目录、Electron 构建输出、用户数据、密钥、临时文件、测试缓存、runtime 内的派发凭据或本地验收日志。项目中的同名嵌套临时目录也排除。保留其本地内容，不删除历史证据。

唯一精确纳入的 runtime 文件为桌面 package.json 直接引用的已核验核心依赖：`.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz`。它包含29个公开发行文件，SHA256 为 `f3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c`。这避免克隆仓库后缺少该 file 依赖；其余 runtime 内容排除。桌面 ZIP 不放入 Git 对象。

发布的源码及此依赖可用于安装产品；完整历史保护测试还读取本工作区保留的旧 ZIP、旧 tarball 与基线。它们不随 Git 发布，故本地验收通过不等于干净 clone 可直接复现完整历史保护套件。既不删除这些测试，也不放宽保护断言；实际工作区证据继续保留。

## 身份与执行约束

目标仓库只读检查成功，当时没有已有分支或标签。默认 SSH 22 连接关闭，官方 SSH 443 返回 publickey 拒绝；系统现有 Git HTTPS 凭据可以访问同一仓库。保留客户给出的 SSH 地址作为 origin，推送使用同仓库 HTTPS push URL，不显示或复制凭据。

Supervisor 已核对：精确 task candidate、源码名单、受保护文件与旧 runtime 枚举均不包含 `.git`。为避免活跃 npm/Forge 检查受到潜在新 Git 元数据影响，初始化、暂存、提交与推送等待全部正式验收结束后进行。

本次仅使用客户授权的 Git 元数据、`.git/info/exclude` 和精确暂存范围。不修改冻结的项目策略、角色边界、已核验源码与包锁；不新建无 owner 的业务配置文件 `.gitignore`。应用文件仍由各固定 owner 维护。

本机全局 core.autocrlf 为 true；本仓库将单独设为 false，提交保留原始源码字节。需要比对发行文件 SHA 的克隆也应使用 `git -c core.autocrlf=false clone`，避免客户端行尾转换影响字节身份。

## 验收与交接

正式 Node 回归182项、桌面公共入口73项均通过，零失败和跳过。公共入口重新打包后的当前 ZIP 194645336 bytes，SHA256 `11c16a8c308d05f81ae66831f0a661d47547fd8a1e1606b4dcc149164722b298`；独立 Reviewer 15项、Tester两个完整流程 runner 在此产物上再次通过，Supervisor 已核验并将两个节点签收为 verified/inactive（artifact-recheck revision11）。源码与核心依赖身份保持。

Git 凭据仅通过系统 helper 使用；存在性检查成功，不显示或提交值。发布操作等待 Supervisor 最终交付文档停止写入，然后提交精确范围并正常推送。本文记录授权、范围与实际产品验收，Git 提交身份以实际 Git 历史、远端 main 及本次客户交接为准，不预写提交 SHA 或将发布准备冒称远端成功。
