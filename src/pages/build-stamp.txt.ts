/**
 * When this build was made, as plain text.
 *
 * Pre-rendered, so the value is frozen at build time — which is the point.
 * The publish button reads it to answer "has the site been rebuilt recently?"
 * without needing anywhere to store state, and refuses to start another build
 * if one has just run. Five volunteers pressing the button five times costs
 * one build, not five.
 */
export const prerender = true;

export function GET() {
  return new Response(new Date().toISOString(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Must not be cached, or the cooldown check reads a stale timestamp and
      // blocks a publish that should be allowed.
      "cache-control": "no-store",
    },
  });
}
