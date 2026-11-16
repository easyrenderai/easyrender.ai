import { auth } from '@/lib/auth';
import {
  mailingJson,
  mailingResponse,
  mailingToken,
  requireMailingOrigin,
} from '@/lib/mailing-http';

export async function POST(request: Request) {
  return mailingResponse(async () => {
    requireMailingOrigin(request);
    const token = mailingToken((await mailingJson(request)).token);
    try {
      await auth().api.verifyEmail({ query: { token }, headers: request.headers });
      return Response.json({ verified: true });
    } catch {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }
  });
}
