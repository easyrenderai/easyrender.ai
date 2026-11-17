import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { authHeaders, previewUrl, type RenderView } from '@/lib/api';
import { radius, useTheme } from '@/lib/theme';

// The render's preview (the photo or its angle sheet). The endpoint needs the session cookie, and
// the same URL changes once the render is paid, so the cache key carries what changes it.
export function RenderImage({
  render,
  style,
  contentFit = 'cover',
}: {
  render: RenderView;
  style?: ViewStyle;
  contentFit?: 'cover' | 'contain';
}) {
  const t = useTheme();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    authHeaders().then((next) => {
      if (!controller.signal.aborted) setHeaders(next);
    });
    return () => controller.abort();
  }, []);
  const version = `${render.credits > 0 ? 'paid' : 'free'}-${render.hasSheet ? 'sheet' : 'photo'}`;
  return (
    <View style={[styles.frame, { backgroundColor: t.muted }, style]}>
      {render.hasPreview && headers ? (
        <Image
          source={{ uri: `${previewUrl(render.id)}?v=${version}`, headers }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={150}
          accessibilityLabel={render.name ?? 'Product photo'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radius + 2 },
});
