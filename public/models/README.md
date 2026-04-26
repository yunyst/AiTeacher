# 3D 模型文件

## 文件说明

- `woman.glb` - 默认虚拟教师 3D 模型

## 来源信息

- **原始来源**: [r3f-lipsync-tutorial](https://github.com/wass08/r3f-lipsync-tutorial)
- **原始 URL**: N/A
- **文件大小**: ~1.3 MB
- **格式**: GLB (GLTF Binary)

## 本地化说明

此文件已从远程 CDN 下载到本地，以提供以下优势：

1. **更快的加载速度** - 无需从外部服务器下载
2. **离线支持** - 在无网络环境下也能正常使用
3. **稳定性** - 不受外部服务器状态影响
4. **版本一致性** - 确保所有用户使用相同版本的模型

## 使用方式

在 `constants.ts` 中配置为：
```typescript
export const DEFAULT_AVATAR_URL = `/models/woman.glb`;
```

## 注意事项

- 此模型用于唇形同步功能
- 确保在部署时包含此文件在构建产物中
- 如需更换模型，请更新 `constants.ts` 中的路径