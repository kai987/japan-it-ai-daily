# AivisSpeech 本地日语语音生成

Japan IT / AI Daily 的词汇卡支持优先播放本地 AivisSpeech 生成的 MP3；如果当天没有生成音频，则自动回退到浏览器 `speechSynthesis`。

## 当前默认声音

- Speaker: `morioki`
- Style: `ノーマル`
- Style ID: `497929760`
- Engine: `http://127.0.0.1:10101`

可以通过环境变量覆盖：

```bash
AIVIS_STYLE_ID=123456789 npm run audio:generate -- --date 2026-08-26
```

也可以切换 Engine 地址：

```bash
AIVIS_ENGINE_URL=http://127.0.0.1:10101 npm run audio:generate:latest
```

## 前置条件

1. 打开 AivisSpeech，并确认目标模型已经加载。
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

## 生成指定日期

```bash
npm run audio:generate -- --date 2026-08-26
```

脚本读取：

```text
src/content/japanese/2026-08-26.md
```

并为 vocabulary 中的每个词汇与 `exampleJa` 生成：

```text
public/audio/japanese/2026-08-26/
├── vocab-01.mp3
├── example-01.mp3
├── vocab-02.mp3
├── example-02.mp3
├── ...
└── manifest.json
```

MP3 默认：24 kHz、mono、96 kbps。

## 生成最新一天

```bash
npm run audio:generate:latest
```

也可以直接：

```bash
npm run audio:generate
```

没有 `--date` 时，脚本自动选择 `src/content/japanese/` 中最新日期。

## 已存在的文件

默认不会重复生成已经存在的 MP3。

需要全部重新生成时：

```bash
npm run audio:generate -- --date 2026-08-26 --force
```

## 调整语速

默认：

- 词汇：`0.90`
- 例句：`0.96`

临时调整：

```bash
AIVIS_WORD_SPEED=0.88 AIVIS_EXAMPLE_SPEED=0.94 npm run audio:generate:latest
```

## 发布

试听确认后：

```bash
git add public/audio/japanese
git commit -m "audio: add AivisSpeech Japanese lesson audio"
git push
```

GitHub Pages 构建后，学习详情页会自动读取当天的 `manifest.json`，将现有的词汇和例句播放按钮绑定到 AivisSpeech MP3。

如果 `manifest.json` 或对应 MP3 不存在，页面继续使用浏览器日语 TTS，不影响旧内容。

## 模型授权

将生成音频公开发布到 GitHub Pages 前，请查看对应 AivisHub 模型的利用规约 / License，确认是否允许公开发布、二次利用以及商业利用。不同音声模型的许可条件可能不同。
