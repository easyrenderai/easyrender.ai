import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ModelViewer } from '@/components/model-viewer';
import { RenderImage } from '@/components/render-image';
import { isInFlight, owed, STATUS_LABEL } from '@/components/status';
import { Badge, Button, Card, Notice } from '@/components/ui';
import {
  ApiError,
  getRender,
  modelUrl,
  type RenderView,
  setPublic,
  shareUrl,
  startBuild,
  startSheet,
} from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useLibrary } from '@/lib/library-context';
import { useTheme } from '@/lib/theme';

const POLL_MS = 3000;

// Google Scene Viewer takes a public glb URL; Android falls back to the web page if it is missing.
const sceneViewer = (id: string) =>
  `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(modelUrl(id))}&mode=ar_preferred` +
  `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
  `S.browser_fallback_url=${encodeURIComponent(shareUrl(id))};end;`;

export default function RenderScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { renders, balance, upsert, refresh } = useLibrary();
  const render = renders.find((item) => item.id === id);
  const [view, setView] = useState<'3d' | 'photo'>('3d');
  const [busy, setBusy] = useState<null | 'build' | 'sheet' | 'share'>(null);
  const [error, setError] = useState<{ message: string; credits: boolean } | null>(null);
  const status = render?.status;

  const load = useCallback(async () => {
    try {
      upsert(await getRender(id));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setError({ message: 'This product no longer exists.', credits: false });
      }
    }
  }, [id, upsert]);

  // use-effect-audit: ignore loads the render on mount; the mobile app has no query library (own lockfile)
  useEffect(() => {
    void load();
  }, [load]);

  // A finished build or preview changes the credit balance.
  // use-effect-audit: ignore refreshes the shared credit balance when the render status changes, outside React state
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh only when the status changes
  useEffect(() => {
    if (status) void refresh();
  }, [status]);

  const inFlight = render ? isInFlight(render) : false;
  // use-effect-audit: ignore timer that polls the render while it is in flight
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, load]);

  async function run(kind: 'build' | 'sheet', action: (id: string) => Promise<RenderView>) {
    setBusy(kind);
    setError(null);
    try {
      upsert(await action(id));
      void refresh();
    } catch (cause) {
      const credits = cause instanceof ApiError && cause.code === 'insufficient_credits';
      setError({
        message: credits
          ? 'Not enough credits for this.'
          : cause instanceof Error
            ? cause.message
            : 'Something went wrong',
        credits,
      });
    } finally {
      setBusy(null);
    }
  }

  // Sharing and AR go through a link anyone can open, so the model has to be public first.
  function withPublicLink(then: () => void) {
    if (!render) return;
    if (render.isPublic) return then();
    Alert.alert(
      'Make this model public?',
      'AR and sharing use a link to your model, so it will also appear in the public gallery. You can turn that off any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make public',
          onPress: async () => {
            setBusy('share');
            try {
              upsert(await setPublic(id, true));
              then();
            } catch (cause) {
              setError({
                message: cause instanceof Error ? cause.message : 'Could not update',
                credits: false,
              });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const openAr = () =>
    withPublicLink(
      () =>
        void Linking.openURL(Platform.OS === 'android' ? sceneViewer(id) : shareUrl(id)).catch(() =>
          setError({ message: 'AR is not available on this device.', credits: false }),
        ),
    );
  const shareLink = () =>
    withPublicLink(() => void Share.share({ url: shareUrl(id), message: shareUrl(id) }));

  if (!render) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '' }} />
        {error ? (
          <Notice text={error.message} />
        ) : (
          <Text style={{ color: t.mutedForeground }}>Loading…</Text>
        )}
      </View>
    );
  }

  const tone =
    render.status === 'ready' ? 'success' : render.status === 'failed' ? 'destructive' : 'muted';
  const due = owed(render);
  const showModel = render.hasModel && view === '3d';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: render.name ?? 'Product' }} />

      {showModel ? (
        <ModelViewer id={render.id} version={`${render.createdAt}`} />
      ) : (
        <RenderImage render={render} contentFit="contain" style={styles.hero} />
      )}

      {render.hasModel ? (
        <View style={styles.row}>
          <Button
            style={styles.flex}
            variant={view === '3d' ? 'primary' : 'outline'}
            label="3D"
            onPress={() => setView('3d')}
          />
          <Button
            style={styles.flex}
            variant={view === 'photo' ? 'primary' : 'outline'}
            label={render.hasSheet ? 'Angles' : 'Photo'}
            onPress={() => setView('photo')}
          />
        </View>
      ) : null}

      <View style={styles.row}>
        <Badge label={STATUS_LABEL[render.status]} tone={tone} />
        {inFlight ? (
          <Text style={{ color: t.mutedForeground }}>This can take a few minutes.</Text>
        ) : null}
      </View>

      {render.status === 'drafting' || render.status === 'rendering' ? (
        <Text style={{ color: t.mutedForeground, lineHeight: 20 }}>
          {render.status === 'drafting'
            ? 'Generating your free preview. You can leave this screen; it keeps working.'
            : 'Building your 3D model. You can leave this screen; it keeps working.'}
        </Text>
      ) : null}

      {render.status === 'preview_ready' ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Build the 3D model</Text>
          <Text style={{ color: t.mutedForeground, lineHeight: 20 }}>
            {render.hasSheet
              ? 'Your angle sheet is ready. Build the textured 3D model from it.'
              : 'Build a textured 3D model from your photo, or generate an angle sheet first for a fuller result.'}
          </Text>
          <Button
            label={due > 0 ? `Build 3D model · ${due} credits` : 'Build 3D model'}
            onPress={() => void run('build', startBuild)}
            loading={busy === 'build'}
            disabled={busy !== null}
          />
          {!render.hasSheet ? (
            <Button
              variant="outline"
              label={`Generate angle sheet · ${render.sheetCredits} credits`}
              onPress={() => void run('sheet', startSheet)}
              loading={busy === 'sheet'}
              disabled={busy !== null}
            />
          ) : null}
          <Text style={{ color: t.mutedForeground, fontSize: 13 }}>
            You have {balance.toLocaleString()} credits. The angle sheet counts toward the 3D price.
          </Text>
        </Card>
      ) : null}

      {render.status === 'ready' ? (
        <Card>
          <Button
            label="View in your space (AR)"
            icon={<Ionicons name="scan-outline" size={18} color={t.primaryForeground} />}
            onPress={openAr}
            loading={busy === 'share'}
            disabled={busy !== null}
          />
          <Button
            variant="outline"
            label="Share link"
            icon={<Ionicons name="share-outline" size={18} color={t.foreground} />}
            onPress={shareLink}
            disabled={busy !== null}
          />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[styles.switchTitle, { color: t.foreground }]}>Public gallery</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 13 }}>
                Anyone with the link can view this model.
              </Text>
            </View>
            <Switch
              value={render.isPublic}
              onValueChange={(value) =>
                void setPublic(id, value)
                  .then(upsert)
                  .catch(() => undefined)
              }
            />
          </View>
        </Card>
      ) : null}

      {render.status === 'failed' ? (
        <Card>
          <Notice text={render.error ?? 'Generation failed. Credits, if any, were refunded.'} />
        </Card>
      ) : null}

      {error ? (
        <View style={styles.error}>
          <Notice text={error.message} />
          {error.credits ? (
            <Button
              variant="outline"
              label="Buy credits"
              onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/credits`)}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  hero: { width: '100%', aspectRatio: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600' },
  error: { gap: 8 },
});
