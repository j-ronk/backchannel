// Static landing page for room links. No DynamoDB, no auth, no secrets.
// The room key lives only in the URL #fragment and is assembled into the join
// command client-side — it is never sent to this server.

const REPO = "j-ronk/backchannel"; // GitHub owner/repo, shown in the marketplace install command

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(fromRaw: string | undefined): string {
  const from = (fromRaw ?? "").slice(0, 60).trim();
  const named = from.length > 0;
  const safeFrom = esc(from);
  const title = named
    ? `${safeFrom} wants to share their Claude Code session with you`
    : `You're invited to collaborate in a Claude Code session`;
  const safeTitle = named ? title : esc(title); // safeFrom already escaped; escape the generic literal's apostrophe
  const desc = esc(
    "Separate sessions, shared context. Your agent sees their progress but never runs their commands. It's end-to-end encrypted, so the server never sees your messages or the room key.",
  );
  const headline = named ? `${safeFrom} invited you to collaborate` : "You're invited to collaborate";
  const safeHeadline = named ? headline : esc(headline);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, system-ui, sans-serif; max-width: 640px; margin: 6vh auto; padding: 0 20px; }
  .brand { font-weight: 600; opacity: .7; letter-spacing: .02em; }
  h1 { font-size: 1.5rem; margin: .3em 0 .5em; }
  .step { margin: 1.4em 0; }
  .step h2 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; opacity: .55; margin: 0 0 .4em; }
  pre { background: rgba(127,127,127,.12); padding: .8em 2.6em .8em 1em; border-radius: 8px; overflow-x: auto; position: relative; font-family: ui-monospace, Menlo, monospace; }
  button { font: inherit; cursor: pointer; border: 1px solid rgba(127,127,127,.4); background: transparent; border-radius: 6px; padding: .1em .55em; position: absolute; top: .55em; right: .55em; }
  .muted { opacity: .6; font-size: .9rem; }
</style>
</head>
<body>
  <div class="brand">&#9671; Claude Code &middot; backchannel</div>
  <h1>${safeHeadline} in their Claude Code session.</h1>
  <p>Separate sessions, shared context. Your agent sees their progress but never runs their commands. It's end-to-end encrypted, so this server never sees your messages or the room key.</p>

  <div class="step">
    <h2>1 &middot; Install backchannel (once), in Claude Code</h2>
    <pre><code id="install">/plugin marketplace add ${esc(REPO)}
/plugin install backchannel@backchannel</code><button onclick="copy('install')">copy</button></pre>
  </div>

  <div class="step">
    <h2>2 &middot; In Claude Code, run</h2>
    <pre><code id="join">&hellip;</code><button onclick="copy('join')">copy</button></pre>
    <p class="muted" id="note"></p>
  </div>

<script>
  function copy(id){ navigator.clipboard && navigator.clipboard.writeText(document.getElementById(id).textContent); }
  (function(){
    var key = new URLSearchParams(location.hash.replace(/^#/, '')).get('k');
    var joinEl = document.getElementById('join');
    var noteEl = document.getElementById('note');
    if (key) {
      var cleanLink = location.origin + location.pathname + location.hash; // drop ?from; keep #k
      joinEl.textContent = '/backchannel:join ' + cleanLink + ' <your name>';
      noteEl.textContent = 'Replace <your name> with how you want to appear. The room key stays in your browser and is never sent to the server.';
    } else {
      joinEl.textContent = '(this link is missing its key)';
      noteEl.textContent = 'Ask the sender for the complete link. It should end with #k=…';
    }
  })();
</script>
</body>
</html>`;
}

export const handler = async (evt: any) => ({
  statusCode: 200,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-ancestors 'none'",
  },
  body: page(evt.queryStringParameters?.from),
});
