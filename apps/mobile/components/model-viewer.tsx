import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { authHeaders, modelUrl } from '@/lib/api';
import { radius, useTheme } from '@/lib/theme';

// Same viewer, and version, as the web app.
const MODEL_VIEWER =
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js';

const page = (background: string) => `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: ${background}; overflow: hidden; }
  model-viewer { width: 100%; height: 100%; --poster-color: transparent; background: transparent; }
</style>
<script type="module" src="${MODEL_VIEWER}"></script>
</head><body>
<model-viewer id="mv" camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="1500"
  shadow-intensity="1" shadow-softness="1" exposure="1" interaction-prompt="none"
  alt="3D model"></model-viewer>
<script>
  const post = (type, detail) =>
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, detail }));
  const mv = document.getElementById('mv');
  mv.addEventListener('load', () => post('loaded'));
  mv.addEventListener('error', (event) => post('error', String(event.detail && event.detail.sourceError || 'model')));
  window.setModel = (src) => customElements.whenDefined('model-viewer').then(() => { mv.src = src; });
  window.setTimeout(() => {
    if (!customElements.get('model-viewer')) post('error', 'viewer');
  }, 15000);
</script>
</body></html>`;

type Phase = 'downloading' | 'rendering' | 'ready' | 'error';

// Downloads the owner's GLB (the endpoint needs the session cookie, which a WebView cannot send for
// sub-resources) and hands it to <model-viewer> as a data URL. Drag to rotate, pinch to zoom.
export function ModelViewer({ id, version }: { id: string; version: string }) {
  const t = useTheme();
  const web = useRef<WebView>(null);
  const [phase, setPhase] = useState<Phase>('downloading');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPhase('downloading');
    (async () => {
      try {
        const file = new File(new Directory(Paths.cache), `render-${id}-${version}.glb`);
        const saved = await File.downloadFileAsync(modelUrl(id), file, {
          headers: await authHeaders(),
          idempotent: true,
        });
        const base64 = await saved.base64();
        if (!controller.signal.aborted) {
          setDataUrl(`data:model/gltf-binary;base64,${base64}`);
          setPhase('rendering');
        }
      } catch {
        if (!controller.signal.aborted) setPhase('error');
      }
    })();
    return () => controller.abort();
  }, [id, version]);

  useEffect(() => {
    if (dataUrl && viewerLoaded) {
      web.current?.injectJavaScript(`window.setModel(${JSON.stringify(dataUrl)}); true;`);
    }
  }, [dataUrl, viewerLoaded]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string };
      if (message.type === 'loaded') setPhase('ready');
      if (message.type === 'error') setPhase('error');
    } catch {
      // not ours
    }
  }, []);

  return (
    <View style={[styles.frame, { backgroundColor: t.muted }]}>
      <WebView
        // react-native-webview 14's class typings reject any ref under React 19's types; the runtime ref is fine.
        ref={web as never}
        originWhitelist={['*']}
        source={{ html: page(t.muted), baseUrl: 'https://easyrender.ai' }}
        onLoadEnd={() => setViewerLoaded(true)}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        style={styles.web}
        containerStyle={{ backgroundColor: t.muted }}
      />
      {phase !== 'ready' ? (
        <View style={styles.overlay} pointerEvents="none">
          {phase === 'error' ? (
            <Text style={{ color: t.mutedForeground }}>Could not load the 3D model.</Text>
          ) : (
            <>
              <ActivityIndicator color={t.mutedForeground} />
              <Text style={{ color: t.mutedForeground }}>
                {phase === 'downloading' ? 'Downloading model…' : 'Preparing viewer…'}
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1, borderRadius: radius + 2, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
