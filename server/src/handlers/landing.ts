// Static landing page for room links. No DynamoDB, no auth, no secrets.
// The room key lives only in the URL #fragment and is assembled into the join
// command client-side, so it is never sent to this server. Everything is inline
// (no external fonts/scripts/images) to keep the CSP tight and leak nothing.

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
    "Two sessions, shared context. Neither side runs the other's commands. End-to-end encrypted, so the relay only ever sees ciphertext.",
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
<meta name="theme-color" content="#080b0c">
<style>
  :root{
    color-scheme: dark light;
    --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    --bg:#080b0c; --panel:#0d1113; --inset:#06090a;
    --ink:#eaf0ee; --muted:#93a29c;
    --line:rgba(255,255,255,.09);
    --amber:#f5b544; --ink-on-amber:#0a0705;
    --glow:rgba(245,181,68,.16); --err:rgba(240,120,90,.55);
  }
  @media (prefers-color-scheme: light){
    :root{
      --bg:#efe9dd; --panel:#fbf7ef; --inset:#f2ecdf;
      --ink:#231f1a; --muted:#6b6357;
      --line:rgba(40,30,10,.13);
      --amber:#a5650a; --ink-on-amber:#fff7ea;
      --glow:rgba(165,101,10,.12); --err:rgba(180,60,30,.5);
    }
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    font:15px/1.65 var(--sans); color:var(--ink);
    background:
      radial-gradient(1100px 520px at 50% -8%, var(--glow), transparent 62%),
      var(--bg);
    min-height:100vh; padding:24px;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  .win{
    max-width:600px; margin:min(8vh,72px) auto 40px;
    background:var(--panel); border:1px solid var(--line);
    border-radius:14px; overflow:hidden;
    box-shadow:0 40px 90px -50px rgba(0,0,0,.75);
  }
  .bar{
    display:flex; align-items:center; gap:.6rem;
    padding:.72rem .95rem; border-bottom:1px solid var(--line);
    font:600 .68rem/1 var(--mono); letter-spacing:.16em;
    text-transform:uppercase; color:var(--muted);
  }
  .sig{
    width:.5rem; height:.5rem; border-radius:50%; flex:none;
    background:var(--amber); box-shadow:0 0 0 0 var(--glow);
    animation:pulse 2.4s ease-out infinite;
  }
  .bar .rule{flex:1; height:1px; background:var(--line)}
  .scr{ padding:clamp(1.35rem,4.5vw,2.4rem); }
  h1{
    margin:0 0 .7rem; font:600 clamp(1.4rem,4.6vw,1.95rem)/1.2 var(--mono);
    letter-spacing:-.012em; color:var(--ink); text-wrap:balance;
  }
  h1 .caret{ color:var(--amber); margin-right:.45rem }
  .lede{ margin:0 0 2rem; max-width:48ch; color:var(--muted) }
  .steps{ list-style:none; margin:0; padding:0 }
  .step{ margin:0 0 1.5rem }
  .stephead{
    display:flex; align-items:center; gap:.6rem;
    font:600 .82rem/1.3 var(--mono); color:var(--ink);
  }
  .num{
    flex:none; font:600 .68rem/1 var(--mono); color:var(--amber);
    border:1px solid var(--line); border-radius:6px; padding:.34rem .44rem;
  }
  .code{ position:relative; margin-top:.7rem }
  .code pre{
    margin:0; overflow-x:auto; background:var(--inset);
    border:1px solid var(--line); border-radius:10px;
    padding:.9rem 4.6rem .9rem 1rem;
  }
  .code code{ font:.82rem/1.6 var(--mono); color:var(--ink); white-space:pre }
  .code.err pre{ border-color:var(--err) }
  .copy{
    position:absolute; top:.55rem; right:.55rem;
    font:600 .66rem/1 var(--mono); letter-spacing:.06em;
    color:var(--muted); background:var(--panel);
    border:1px solid var(--line); border-radius:7px;
    padding:.42rem .6rem; cursor:pointer;
    transition:color .15s, border-color .15s, background .15s;
  }
  .copy:hover{ color:var(--amber); border-color:var(--amber) }
  .copy:focus-visible{ outline:2px solid var(--amber); outline-offset:2px }
  .copy.ok{ color:var(--ink-on-amber); background:var(--amber); border-color:var(--amber) }
  .note{ margin:.65rem 0 0; font-size:.82rem; color:var(--muted) }
  .foot{
    display:flex; align-items:flex-start; gap:.6rem;
    margin-top:2rem; padding-top:1.2rem; border-top:1px solid var(--line);
    font-size:.8rem; color:var(--muted);
  }
  .foot svg{ flex:none; margin-top:.12rem; stroke:var(--amber) }
  .src{
    display:inline-block; margin-top:1rem;
    font:.74rem/1 var(--mono); letter-spacing:.04em;
    color:var(--muted); text-decoration:none;
  }
  .src:hover{ color:var(--amber) }
  [data-anim]{ opacity:0; animation:rise .6s cubic-bezier(.2,.7,.2,1) forwards }
  @keyframes rise{ from{ transform:translateY(9px) } to{ opacity:1; transform:none } }
  @keyframes pulse{
    0%{ box-shadow:0 0 0 0 var(--glow) }
    70%{ box-shadow:0 0 0 .55rem transparent }
    100%{ box-shadow:0 0 0 0 transparent }
  }
  @media (prefers-reduced-motion: reduce){
    [data-anim]{ animation:none; opacity:1 } .sig{ animation:none }
  }
</style>
</head>
<body>
  <div class="win">
    <div class="bar">
      <span class="sig"></span>
      <span>backchannel · secure channel</span>
      <span class="rule"></span>
    </div>
    <div class="scr">
      <h1 data-anim style="animation-delay:.05s"><span class="caret">▸</span>${safeHeadline} in Claude Code.</h1>
      <p class="lede" data-anim style="animation-delay:.11s">Two sessions, shared context. Neither side runs the other's commands.</p>

      <ol class="steps">
        <li class="step" data-anim style="animation-delay:.17s">
          <div class="stephead"><span class="num">01</span> Install once</div>
          <div class="code">
            <pre><code id="install">/plugin marketplace add ${esc(REPO)}
/plugin install backchannel@backchannel</code></pre>
            <button class="copy" type="button" data-target="install" aria-label="Copy install commands">Copy</button>
          </div>
        </li>
        <li class="step" data-anim style="animation-delay:.23s">
          <div class="stephead"><span class="num">02</span> Join the room</div>
          <div class="code" id="joinwrap">
            <pre><code id="join">&hellip;</code></pre>
            <button class="copy" type="button" data-target="join" aria-label="Copy join command">Copy</button>
          </div>
          <p class="note" id="note"></p>
        </li>
      </ol>

      <div class="foot" data-anim style="animation-delay:.29s">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>
        <span>End-to-end encrypted. The relay only ever sees ciphertext.</span>
      </div>
      <a class="src" data-anim style="animation-delay:.33s" href="https://github.com/${esc(REPO)}">github.com/${esc(REPO)} &#8599;</a>
    </div>
  </div>

<script>
  (function(){
    var key = new URLSearchParams(location.hash.replace(/^#/, '')).get('k');
    var joinEl = document.getElementById('join');
    var joinWrap = document.getElementById('joinwrap');
    var noteEl = document.getElementById('note');
    if (key) {
      var cleanLink = location.origin + location.pathname + location.hash; // drop ?from, keep #k
      joinEl.textContent = '/backchannel:join ' + cleanLink + ' <your name>';
      noteEl.textContent = 'Replace <your name> with how you want to appear.';
    } else {
      joinEl.textContent = '(this link is missing its key)';
      joinWrap.className = 'code err';
      var hidden = joinWrap.querySelector('.copy'); if (hidden) hidden.style.display = 'none';
      noteEl.textContent = 'Ask the sender for the complete link. It should end with #k=…';
    }
    function fallbackCopy(text){
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
    document.querySelectorAll('.copy').forEach(function(btn){
      btn.addEventListener('click', function(){
        var el = document.getElementById(btn.getAttribute('data-target'));
        if (!el) return;
        var text = el.textContent;
        var flash = function(){
          btn.textContent = 'Copied';
          btn.classList.add('ok');
          setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(flash).catch(function(){ fallbackCopy(text); flash(); });
        } else {
          fallbackCopy(text); flash();
        }
      });
    });
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
