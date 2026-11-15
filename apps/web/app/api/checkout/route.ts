import {
  AppError,
  createCheckoutDetails,
  isGoogleMeasurementConfigured,
  parseGoogleContext,
  reportError,
} from '@easyrender/core';
import { db } from '@easyrender/db';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import {
  allowsServerAdvertisingMeasurement,
  allowsServerMeasurement,
} from '@/lib/analytics/measurement-consent';
import { handle } from '@/lib/http';

export const POST = (request: Request) =>
  handle(async () => {
    const { userId, anonId, geoCountry } = await resolveActor(request.headers);
    if (!userId) throw new AppError('Sign in to buy credits', 401, 'unauthorized');
    const body = (await request.json().catch(() => ({}))) as {
      plan?: unknown;
      credits?: unknown;
      googleAnalytics?: { measurementId?: unknown };
    };
    const details = await createCheckoutDetails(userId, body, {
      anonId,
      expectedVariant: request.headers.get('x-pricing-variant'),
      // The same country the pricing pages used, so the page and the charge agree.
      country: geoCountry,
    });
    const context = parseGoogleContext(
      body.googleAnalytics,
      allowsServerMeasurement(request.headers),
    );
    if (
      details.sessionId &&
      context &&
      isGoogleMeasurementConfigured() &&
      body.googleAnalytics?.measurementId === process.env.GA_MEASUREMENT_ID
    ) {
      try {
        await db().googleCheckout.create({
          data: {
            id: details.sessionId,
            userId,
            ...context,
            adMeasurementAllowed: allowsServerAdvertisingMeasurement(request.headers),
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          },
        });
      } catch {
        // Checkout already exists. Optional measurement must not prevent the user paying.
        reportError(new Error('Unable to persist optional checkout measurement'), {
          component: 'analytics',
        });
      }
    }
    return NextResponse.json({ url: details.url, analytics: details.analytics });
  });
