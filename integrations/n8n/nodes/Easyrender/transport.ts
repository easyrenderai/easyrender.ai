import type { IDataObject, IExecuteFunctions, IPollFunctions } from 'n8n-workflow';

export function renderIdPath(id: string): string {
  if (!id || id === '.' || id === '..') throw new Error('Enter a render ID');
  return `/renders/${encodeURIComponent(id)}`;
}

// Use n8n's credential-aware transport for the fixed easyrender API origin.
export async function apiRequest(
  this: IExecuteFunctions | IPollFunctions,
  method: 'GET' | 'POST',
  path: string,
  body?: IDataObject,
  qs: IDataObject = {},
  headers: IDataObject = {},
): Promise<IDataObject> {
  return (await this.helpers.httpRequestWithAuthentication.call(this, 'easyrenderApi', {
    method,
    url: `https://easyrender.ai/api${path}`,
    json: true,
    body,
    qs,
    headers,
    timeout: 25000,
  })) as IDataObject;
}
