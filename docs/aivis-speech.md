# AivisSpeech 本地日语语音生成

Japan IT / AI Daily 的新学词汇、复习词汇、词汇例句、新学语法例句、复习语法例句和面试素材优先播放 AivisSpeech 生成的 MP3；如果对应音频不存在或加载失败，则自动回退到浏览器 `speechSynthesis`。

## 当前统一声音

- Speaker: `morioki`
- Style: `ノーマル`
- Style ID: `497929760`
- Engine: `http://127.0.0.1:10101`
- 词汇语速: `1.00`
- 例句语速: `1.00`

可以通过环境变量临时覆盖：

```bash
AIVIS_STYLE_ID=123456789 npm run audio:generate -- --date 2026-08-26
```

也可以切换 Engine 地址：

```bash
AIVIS_ENGINE_URL=http://127.0.0.1:10101 npm run audio:generate:latest
```

## 前置条件

1. 打开 AivisSpeech，并确认 `morioki（ノーマル）` 已加载。
2. 确认 Engine 可访问：

```bash
curl http://127.0.0.1:10101/version
```

3. 确认 ffmpeg 已安装：

```bash
ffmpeg -version
```

没有 ffmpeg 时：

```bash
brew install ffmpeg
```

## Hash 增量生成

音频生成器现在使用 SHA-256 cache。Hash 会覆盖会影响音频结果的主要输入，例如：

- 文本
- Speaker / Style ID
- 模型版本
- 语速和语调参数
- 前后停顿
- 输出采样率 / MP3 编码参数

因此普通情况下不需要再频繁使用 `--force`：

```bash
npm run audio:generate:all
```

该命令现在会同时读取原始 `vocabulary / grammar` 与 `learning-review.mjs` 派生的 `reviewVocabulary / reviewGrammar`。未变化的 MP3 会直接跳过；只有文字、声音、复习选择或合成参数发生变化且对应文件 hash 不匹配的条目才会重新生成。

确实需要全部重做时才使用：

```bash
npm run audio:generate:all:force
```

输出结构：

```text
public/audio/japanese/
├── 2026-08-12/
│   ├── vocab-01.mp3
│   ├── example-01.mp3
│   ├── grammar-example-01.mp3
│   ├── review-vocab-01.mp3
│   ├── review-example-01.mp3
│   ├── review-grammar-example-01.mp3
│   ├── interview-answer-01.mp3
│   ├── manifest.json
│   └── interview-manifest.json
└── ...
```

MP3 默认：24 kHz、mono、96 kbps。

## 复习卡音频

复习词汇与复习语法不写回原始 Markdown 的 `vocabulary / grammar` 数组，而是由 `scripts/learning-review.mjs` 根据历史首次学习日期与当天实际用例动态派生。音频生成器会读取同一份派生结果：

- `reviewVocabulary`：生成 `review-vocab-XX.mp3` 与 `review-example-XX.mp3`
- `reviewGrammar`：生成 `review-grammar-example-XX.mp3`
- manifest 记录 `studyKind: "review"`、`identity` 与 `firstIntroducedDate`
- 页面仍按词条＋读音或完整例句精确匹配，不按卡片显示位置猜测录音

因此历史日报新增复习语法后，推荐执行：

```bash
npm run audio:generate:all
```

这会扫描全部日期并利用 hash 缓存，只补齐缺少或已变化的复习录音，不重做所有未变化的原始录音。

## 生成指定日期

```bash
npm run audio:generate -- --date 2026-08-26
```

指定日期并强制重生成：

```bash
npm run audio:generate -- --date 2026-08-26 --force
```

## 生成最新一天

```bash
npm run audio:generate:latest
```

没有 `--date` 时，脚本自动选择 `src/content/japanese/` 中最新日期。

## 调整语速

当前默认：

- 词汇：`1.00`
- 例句：`1.00`

临时调整示例：

```bash
AIVIS_WORD_SPEED=0.95 AIVIS_EXAMPLE_SPEED=1.05 npm run audio:generate:latest
```

## 默认发布方式：GitHub Pages 本地音频

没有配置外部 Audio CDN 时，页面继续读取：

```text
/japan-it-ai-daily/audio/japanese/YYYY-MM-DD/*.mp3
```

此时 GitHub Pages artifact 中会保留全部 MP3，行为与之前一致。

发布新生成音频：

```bash
git add public/audio/japanese
git commit -m "audio: update Japanese learning audio"
git push
```

## 可选：把 MP3 迁移到 R2 / S3 / CDN

项目支持：

```text
PUBLIC_AUDIO_BASE_URL
```

这个地址代表远程 `audio/` 根目录。例如配置：

```text
PUBLIC_AUDIO_BASE_URL=https://audio.example.com/
```

那么：

```text
public/audio/japanese/2026-08-31/vocab-01.mp3
```

应上传为：

```text
https://audio.example.com/japanese/2026-08-31/vocab-01.mp3
```

如果 CDN 使用路径前缀，也可以：

```text
PUBLIC_AUDIO_BASE_URL=https://cdn.example.com/japan-it-ai-audio/
```

对应：

```text
https://cdn.example.com/japan-it-ai-audio/japanese/2026-08-31/vocab-01.mp3
```

### Manifest 保持在 GitHub Pages

迁移后只有 MP3 走 CDN。以下小型 JSON 仍留在 GitHub Pages：

```text
manifest.json
interview-manifest.json
```

这样词汇 / 例句 / 面试文本到音频文件的映射仍由站点版本控制管理。

### GitHub Actions 配置

在 GitHub 仓库中建立 Repository Variable：

```text
Settings
→ Secrets and variables
→ Actions
→ Variables
→ New repository variable
```

变量名：

```text
PUBLIC_AUDIO_BASE_URL
```

变量值例如：

```text
https://audio.example.com/
```

它不是秘密信息，因此使用 Repository Variable 即可，不需要 Secret。

配置后，CI 会自动：

1. 把 CDN origin 加入 CSP `media-src`。
2. 验证 CSP 确实允许该音频 origin。
3. Build 后从 `dist/` 删除 `.mp3`，但保留 manifest。
4. GitHub Pages 只发布页面、CSS/JS、JSON 等较小文件。
5. 浏览器从 CDN 播放 MP3；CDN 音频失败时仍回退浏览器日语 TTS。

`PUBLIC_AUDIO_BASE_URL` 必须使用 HTTPS。无效 URL、`http:`、`javascript:` 等不会作为浏览器音频地址使用；生产 Build 配置了非 HTTPS 地址时会直接失败。

### 本地模拟 CDN Build

不修改仓库变量也可以临时测试：

```bash
PUBLIC_AUDIO_BASE_URL=https://audio.example.com/ npm run build
PUBLIC_AUDIO_BASE_URL=https://audio.example.com/ npm run audio:strip-dist
PUBLIC_AUDIO_BASE_URL=https://audio.example.com/ npm run security:check
```

注意：只有确认远程 CDN 已经存在完整 MP3 后，才应在正式 GitHub Pages Build 中设置该变量。

## 模型授权

将生成音频公开发布到 GitHub Pages、R2、S3 或 CDN 前，请查看对应 AivisHub 模型的利用规约 / License，确认是否允许公开发布、二次利用以及商业利用。不同音声模型的许可条件可能不同。
