/** A stalled manifest must not leave a playback request busy indefinitely. */
export async function fetchAudioManifest<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, { cache: 'no-cache', signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<T> : null),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
      }),
    ]);
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

type PlaybackOptions = {
  rate?: (button: HTMLButtonElement) => number;
  onRecordingError?: (button: HTMLButtonElement) => void;
};

/** One owner per request, including delayed manifest/media/TTS callbacks. */
export function createSpeechPlayback(options: PlaybackOptions = {}) {
  const synth = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;
  let voices = synth?.getVoices() ?? [];
  const refreshVoices = () => { voices = synth?.getVoices() ?? []; };
  synth?.addEventListener?.('voiceschanged', refreshVoices);
  let activeButton: HTMLButtonElement | null = null;
  let activeAudio: HTMLAudioElement | null = null;
  let playbackRequest = 0;
  const isCurrent = (request: number, button: HTMLButtonElement) =>
    request === playbackRequest && activeButton === button && button.isConnected;

  const clearActive = () => {
    activeButton?.classList.remove('is-speaking', 'is-loading');
    activeButton?.setAttribute('aria-pressed', 'false');
    activeButton?.removeAttribute('aria-busy');
    activeButton?.querySelector('[data-audio-loading]')?.remove();
    activeButton = null;
  };
  const setActive = (button: HTMLButtonElement, loading = false) => {
    activeButton = button;
    button.classList.toggle('is-speaking', !loading);
    button.classList.toggle('is-loading', loading);
    button.setAttribute('aria-pressed', 'true');
    button.removeAttribute('data-speech-unavailable');
    button.querySelector('[data-audio-loading]')?.remove();
    if (loading) {
      button.setAttribute('aria-busy', 'true');
      const status = document.createElement('span');
      status.dataset.audioLoading = '';
      status.className = 'sr-only';
      status.setAttribute('aria-live', 'polite');
      status.textContent = document.documentElement.lang.startsWith('zh') ? ' · 加载中' : ' · 読み込み中';
      button.append(status);
    } else button.removeAttribute('aria-busy');
  };
  const stop = () => {
    playbackRequest += 1;
    const audio = activeAudio;
    activeAudio = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    synth?.cancel();
    clearActive();
  };

  const speakFallback = (button: HTMLButtonElement, text: string, request: number) => {
    if (!isCurrent(request, button)) return;
    if (!synth) {
      button.dataset.speechUnavailable = 'true';
      clearActive();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = options.rate?.(button) ?? 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = voices.find((v) => v.lang.toLowerCase() === 'ja-jp' && v.localService)
      || voices.find((v) => v.lang.toLowerCase() === 'ja-jp')
      || voices.find((v) => v.lang.toLowerCase().startsWith('ja'));
    if (voice) utterance.voice = voice;
    setActive(button);
    utterance.onend = utterance.onerror = () => { if (isCurrent(request, button)) clearActive(); };
    try { synth.speak(utterance); }
    catch {
      if (isCurrent(request, button)) { button.dataset.speechUnavailable = 'true'; clearActive(); }
    }
  };

  const playAudio = (button: HTMLButtonElement, text: string, url: string, request: number) => {
    if (!isCurrent(request, button)) return;
    const audio = new Audio(url);
    activeAudio = audio;
    setActive(button);
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted || !isCurrent(request, button) || activeAudio !== audio) return;
      fallbackStarted = true;
      activeAudio = null;
      audio.pause();
      options.onRecordingError?.(button);
      speakFallback(button, text, request);
    };
    audio.addEventListener('ended', () => {
      if (isCurrent(request, button) && activeAudio === audio) { activeAudio = null; clearActive(); }
    }, { once: true });
    audio.addEventListener('error', fallback, { once: true });
    try {
      const result = audio.play();
      if (result && typeof result.catch === 'function') void result.catch(fallback);
    } catch { fallback(); }
  };

  const toggle = async (button: HTMLButtonElement, text: string, recording: () => Promise<string | null>) => {
    if (activeButton === button) { stop(); return; }
    if (!text) return;
    stop();
    const request = playbackRequest;
    setActive(button, true);
    let url: string | null = null;
    try { url = await recording(); } catch { /* Use browser speech on invalid/unavailable manifests. */ }
    if (!isCurrent(request, button)) return;
    if (url) playAudio(button, text, url, request);
    else speakFallback(button, text, request);
  };
  // Remains registered after bfcache restores so every pagehide stops playback.
  window.addEventListener('pagehide', stop);
  return { toggle, stop };
}
