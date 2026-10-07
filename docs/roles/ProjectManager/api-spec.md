# 公共发行接口：runtime0.4.0 / desktop0.2.0

runtime根入口仍显式导出createRuntime、AgentSession、ActionProposal、RoleBoundary、Outcome、AgentScope、PiConnection、TaskDispatchContext。新增五个有限subpath：
- legion-runtime/workbench-models：30具名共享Model，完整名单见[Kernel API](../KernelEngineer/api-spec.md)与[发行功能](docs/feature/distribution.md)。
- legion-runtime/services/policy：PolicyService、createPolicyService。
- legion-runtime/services/mutation：MutationService、MutationError、createMutationService。
- legion-runtime/services/proposal：ProposalService、createProposalService、createCodexAdapter、createClaudeAdapter。
- legion-runtime/services/pi-agent：PiAgentService、createPiAgentService。

入口透明具名reexport，无export*、private helper、SDK Session或lower Provider导出。workbench authority仅可信Workbench宿主创建，renderer与模型不能获取controller；Model构造数据不等于授权。连接/多轮公开契约见[Adapter API](../AgentAdapterEngineer/api-spec.md)。根CLI只调用Kernel Interface demo，六场景23事件保留。

## Windows入口

apps/desktop/main.mjs 显式导出 bootstrap(plainOptions)，只转发 startDesktop；import不自动启动。Electron ESM entry使用Promise.then/catch，禁止顶层等待app.whenReady。plainOptions仅userDataDir、initialWorkspace、show，路径绝对且仅可信主进程传入；返回Promise<{readiness:{ready:true,windowId},close:()=>Promise<{closed,error}>}>。进程quit/窗口关闭/SIGINT/SIGTERM共用关闭Promise，等待Interface撤销/取消/资源结束后退出，失败退出1。

LEGION_DESKTOP_USER_DATA_DIR、LEGION_DESKTOP_INITIAL_WORKSPACE、LEGION_DESKTOP_SHOW=true/false是可信启动环境，不是renderer任意路径接口。客户项目与userData互不包含；真实目录选择由系统对话框产生。Interface14固定IPC、字段/窗口/主frame校验与安全DTO见[Desktop API](../DesktopEngineer/api-spec.md)；生产main不得进入Pipeline/Service/Provider或Core Interface。

固定Electron44.6.0/Forge8.0.1/PW1.63.0/PiSDK两个1.0.4。Desktop锁定实际file tarball runtime0.4.0并安装真实29文件模块；Windows ZIP含Electron和全部生产依赖，排除dev依赖/tests/scripts/out/.ans/Forge配置/lock。Forge从当前PMdesktop electron-cache的已核验archive make；无额外Chromium或全局Pi配置。

```powershell
npm --prefix apps/desktop start
npm --prefix apps/desktop run make --ignore-scripts
node --test apps/desktop/tests/package/desktop-package.test.mjs
npm --prefix apps/desktop test --ignore-scripts
```

公开test13模块串行，须业务/独立验收全部完成后才运行最终入口补充证据；当前stage approved check仅desktop-package，300秒。缺SDK/binary/cache失败，不skip、不借devtree。package test2项保留inert入口、plain options、精确源码/生产包/SDK/完整性断言；实际ZIP解压exe操作两页面、真实三协议与PM计划/确认/stop、DPAPI重启、浅深色/最小窗和close。软件测试执行状态仍not_executed，不把写测试文件算运行软件测试。

稳定ZIP与descriptor在.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging；desktop-package.json记录当前SHA/bytes、生产依赖、源码身份、实际窗口readiness/exits/截图/requests与限制。重复make可能改变ZIP字节；不硬编码旧SHA。source候选与生成产物分别记录。before/after逐file保护当前core11、27mjs与旧0.3tgz/0.1ZIP/缓存；consumer守卫清理且为零。

发行fixture运行仅localhost合成推理，不fakeSession，无付费调用；真实服务请求由用户明确点击测试、发送消息或确认执行触发。密钥主进程DPAPI加密保存，初输后清空，仅hasSavedKey返回。未知metadata/费用保持unknown。完整业务说明见[README](../../../apps/desktop/README.md)、[发行流程](docs/feature/desktop-distribution.md)。管理检查不代独立验收，旧原型保留为历史。
