import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  IPollFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { renderIdPath } from './transport';

function renderSummary(render: IDataObject): string {
  if (render.status === 'ready' && render.hasModel === true) return 'Ready - 3D model available';
  if (render.status === 'preview_ready')
    return render.hasSheet === true
      ? 'Preview ready - review the angle sheet, then build 3D in easyrender'
      : 'Preview ready - open easyrender to create an angle sheet or build 3D';
  if (render.status === 'drafting') return 'Creating preview - check again shortly';
  if (render.status === 'rendering') return 'Building 3D model - check again shortly';
  if (render.status === 'failed') return 'Failed - open easyrender to inspect this render';
  return 'Model not available - check this render in easyrender';
}

export async function renderOutput(
  this: IExecuteFunctions | IPollFunctions,
  render: IDataObject,
  isDownloadEnabled: boolean,
): Promise<INodeExecutionData> {
  const id = typeof render.id === 'string' ? render.id : '';
  const base = id ? `https://easyrender.ai/api${renderIdPath(id)}` : null;
  const item: INodeExecutionData = {
    json: {
      ...render,
      viewerUrl: id ? `https://easyrender.ai/r/${encodeURIComponent(id)}` : null,
      glbUrl:
        base && render.status === 'ready' && render.hasModel === true
          ? `${base}/model?download=1`
          : null,
      // The app exports USDZ in the browser; there is no server download endpoint.
      usdzUrl: null,
      summary: renderSummary(render),
    },
  };
  if (!isDownloadEnabled || !base || (render.hasPreview !== true && render.hasSheet !== true))
    return item;

  // The API serves the photo until a sheet exists, then serves the sheet at /preview.
  // Only contact our fixed origin, with the same credential used for the render read.
  const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'easyrenderApi', {
    method: 'GET',
    url: `${base}/preview`,
    encoding: 'arraybuffer',
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    disableFollowRedirect: true,
    timeout: 25000,
  })) as { body: Buffer; headers: Record<string, string | string[]>; statusCode: number };
  if (response.statusCode === 404 || response.statusCode === 410) return item;
  if (response.statusCode !== 200)
    throw new NodeOperationError(
      this.getNode(),
      `Could not download preview image (HTTP ${response.statusCode}). Check the API key and render access, or disable Download Images.`,
    );

  const contentType = response.headers['content-type'];
  const mimeType =
    typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };
  const extension = extensions[mimeType];
  if (!extension || !Buffer.isBuffer(response.body) || response.body.length === 0)
    throw new NodeOperationError(
      this.getNode(),
      'The preview response did not contain a supported image',
    );

  const fileBase = `easyrender-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const preview = await this.helpers.prepareBinaryData(
    response.body,
    `${fileBase}-preview.${extension}`,
    mimeType,
  );
  item.binary = { preview };
  if (render.hasSheet === true)
    item.binary.sheet = { ...preview, fileName: `${fileBase}-sheet.${extension}` };
  return item;
}
