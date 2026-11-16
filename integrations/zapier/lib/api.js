const BASE_URL = 'https://easyrender.ai/api';

const request = async (z, bundle, path, options = {}) => {
  const response = await z.request({
    url: `${BASE_URL}${path}`,
    method: 'GET',
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${bundle.authData.apiKey}`,
      Accept: 'application/json',
    },
    skipThrowForStatus: true,
  });
  if (response.status === 401)
    throw new z.errors.ExpiredAuthError('Reconnect easyrender with a valid API key.');
  if (response.status === 429) {
    const retryAfter = response.getHeader('retry-after');
    const numeric = Number(retryAfter);
    const seconds =
      retryAfter && Number.isFinite(numeric)
        ? numeric
        : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
    throw new z.errors.ThrottledError(
      'easyrender rate limit reached; retry after the server delay.',
      Number.isFinite(seconds) && seconds > 0 ? seconds : 60,
    );
  }
  if (response.status >= 400) {
    const body = response.data || {};
    throw new z.errors.Error(
      `${body.error || 'easyrender request failed'} (request: ${body.request_id || response.getHeader('x-request-id') || 'unknown'})`,
      body.code || 'ApiError',
      response.status,
    );
  }
  response.throwForStatus();
  return response.data;
};

const renderPath = (id) => {
  if (!id || id === '.' || id === '..') throw new Error('Enter a render ID.');
  return `/renders/${encodeURIComponent(id)}`;
};
module.exports = { request, renderPath };
