// Where "start another render" goes. Signed-in people begin in the app (the dashboard composer);
// sending them to `/` drops them on the marketing home. Visitors have no app, so they get the
// upload box on the home page.
export function newRenderHref(isSignedIn: boolean): string {
  return isSignedIn ? '/dashboard' : '/#try';
}
