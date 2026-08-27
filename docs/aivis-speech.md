# AivisSpeech 本地日语语音生成

Japan IT / AI Daily 的词汇卡优先播放本地 AivisSpeech 生成的 MP3；如果当天没有生成音频，则自动回退到浏览器 `speechSynthesis`。

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

## 一次生成 / 覆盖网站全部历史音频

```bash
npm run audio:generate:all
```

这个命令等价于：

```bash
node scripts/generate-japanese-audio.mjs --all --force
```

它会遍历：

```text
src/content/japanese/YYYY-MM-DD.md
```

并强制重生成每一天的全部词汇和例句 MP3，确保所有历史页面统一使用：

```text
morioki / ノーマル / Style ID 497929760 / speed 1.00
```

输出结构：

```text
public/audio/japanese/
├── 2026-08-12/
│   ├── vocab-01.mp3
│   ├── example-01.mp3
│   ├── ...
│   └── manifest.json
├── 2026-08-13/
│   └── ...
└── 2026-08-26/
    └── ...
```

MP3 默认：24 kHz、mono、96 kbps。

## 生成指定日期

```bash
npm run audio:generate -- --date 2026-08-26
```

默认不会覆盖已经存在的 MP3；需要指定日期重新生成时：

```bash
npm run audio:generate -- --date 2026-08-26 --force
```

## 生成最新一天

```bash
npm run audio:generate:latest
```

也可以直接：

```bash
npm run audio:generate
```

没有 `--date` 时，脚本自动选择 `src/content/japanese/` 中最新日期。

## 调整语速

当前默认：

- 词汇：`1.00`
- 例句：`1.00`

如果以后需要临时调整：

```bash
AIVIS_WORD_SPEED=0.95 AIVIS_EXAMPLE_SPEED=1.05 npm run audio:generate:latest
```

## 发布全部 morioki 音频

全量生成完成并试听后：

```bash
git add public/audio/japanese
git commit -m "audio: replace Japanese lesson audio with morioki"
git push
```

GitHub Pages 构建后，学习详情页会自动读取每一天的 `manifest.json`，将现有词汇和例句播放按钮绑定到对应的 morioki MP3。

如果 `manifest.json` 或某个 MP3 不存在，页面仍会回退到浏览器日语 TTS，避免按钮失效。

## 模型授权

将生成音频公开发布到 GitHub Pages 前，请查看对应 AivisHub 模型的利用规约 / License，确认是否允许公开发布、二次利用以及商业利用。不同音声模型的许可条件可能不同。
