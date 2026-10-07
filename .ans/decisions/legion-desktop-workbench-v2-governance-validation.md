# 工作台 v2 精确治理核验

记录角色：ANS Governance。日期：2026-10-07，Asia/Shanghai。

客户已直接确认已展示及同版评审的 canonical，SHA256 `715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3`，并选择专注对话布局。固定 Supervisor 已收束所有实际 owner 意见，返回 OWNER_SCOPES_ACCEPTED，无 canonical blocker；其机器可读最终 delta 确认 stage 数量和 Tester 的明确 cache/Node环境清理要求。文档确认与角色意见不是测试成绩。

Root实际执行的是治理文件检查：

- 活动配置/manifest 唯一归属121个 authored 文件、7个角色，每个配置路径实际存在于所属 Section 1；角色YAML均19个独立有效字段行。
- 8个执行 stage 共114个不重复路径，分组18/14/11/30/12/10/9/10；其余7个协调文件属 Supervisor。
- 33条角色生成 scope 无相互前缀重叠；旧runtime只读，实际新 Node/desktop 消费者、cache/TEMP/userData/fixtures 在各自本阶段范围。
- 固定产品 checks 全部 Node argv、timeout不超过300秒；Tester公开回归使用明确角色、缓存和TEMP并清除NODE_OPTIONS/NODE_COMPILE_CACHE。
- 现组织与v004 bytes一致，保留v001–v003；canonical实际hash符合已确认版本。
- 7个历史保护项实际hash全未变，包括旧0.3.0 tarball、0.1.0 ZIP、历史组织和两个 canonical。

当前pin：

| 产物 | SHA256 |
| --- | --- |
| 活动policy | `2546ebd0b8756eccb83bced6808c10d1c25c3bc175ca8f676a9f1d5172cb706b` |
| manifest | `3a4e87e01d6bab7cfff0e9f06f97c925aeb9cfabc71fb96ba74fe3923525e39b` |
| stages | `97cc48bb844c9a9f37594870e0e43e2dc3d2852c51a10538d32df015f5db60aa` |
| source primary ownership | `87808cec2739fdbbc9520631637b4ddcb2adc2f8680a6e849ec8885d01a35187` |
| desktop-workbench contract | `22e3b93ec4ad525320b0139716c17d116ae8a472ab5eb5d98a454e28a3f7a2fb` |
| freeze | `94594762d6a47b7333b94eef260bc4ae4348bbcbb48b680b123ce20f32513f8e` |

角色卡、边界、组织和策略已是本阶段权限，旧GUI-v1策略与33份旧治理文件已在 decisions 中保留快照。有限公开Model具名30项，真实本地tarball安装、context品牌读与写前重验均写入当前契约。

结论：**治理核验通过，实施已授权，产品未验证**。Root无产品源码/测试/打包修改，无产品检查代跑，也没有创建调度或取得scheduler凭据。正式handoff交原固定 Supervisor；应用、依赖、验证和新版ZIP待其按角色阶段实际交付。
