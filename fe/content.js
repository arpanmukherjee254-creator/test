// =======================
// LeetCode Accepted Watcher (FINAL)
// =======================

let alreadyHandled = false;

/* -----------------------
   HELPERS
----------------------- */

function getSlug() {
  const match = location.href.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function getBaseUrl(slug) {
  return `https://leetcode.com/problems/${slug}/`;
}

/* -----------------------
   SCREENSHOT (SAFE)
----------------------- */
function captureScreenshotFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      (res) => resolve(res?.dataUrl || null)
    );
  });
}

/* -----------------------
   EXTRACT SUBMITTED CODE
----------------------- */
function extractSubmittedCode() {
  const codeEl = document.querySelector("pre code");
  return codeEl ? codeEl.innerText : null;
}

function extractLanguage() {
  const btn = document.querySelector(
    '[data-e2e-locator="submission-language"]'
  );
  return btn ? btn.innerText.trim() : "unknown";
}

/* -----------------------
   FETCH METADATA + QUESTION
----------------------- */
async function fetchProblemMeta(slug) {
  const res = await fetch(getBaseUrl(slug), {
    credentials: "omit",
    headers: { "accept-language": "en-US,en;q=0.9" }
  });

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nextData = doc.querySelector("#__NEXT_DATA__");
  if (!nextData) return null;

  const json = JSON.parse(nextData.textContent);

  const question =
    json?.props?.pageProps?.dehydratedState?.queries
      ?.find(q => q.state?.data?.question)
      ?.state?.data?.question;

  if (!question) return null;

  return {
    title: question.title,
    difficulty: question.difficulty,
    topics: question.topicTags.map(t => t.name),
    content: question.content, // FULL HTML problem statement
    url: getBaseUrl(slug)
  };
}

/* -----------------------
   OBSERVER
----------------------- */
const observer = new MutationObserver(async () => {
  if (alreadyHandled) return;

  const statusNode = document.querySelector(
    'span[data-e2e-locator="submission-result"]'
  );

  if (!statusNode) return;

  if (statusNode.innerText.trim() !== "Accepted") return;

  alreadyHandled = true;
  observer.disconnect();

  console.log("✅ LeetCode submission accepted");

  const slug = getSlug();
  if (!slug) {
    console.warn("❌ Failed to extract slug");
    return;
  }

  const meta = await fetchProblemMeta(slug);
  if (!meta) {
    console.warn("❌ Failed to extract metadata");
    return;
  }

  const code = extractSubmittedCode();
  const language = extractLanguage();
  const screenshot = await captureScreenshotFromBackground();

  const payload = {
    title: meta.title,
    slug,
    difficulty: meta.difficulty,
    topics: meta.topics,
    url: meta.url,

    // NEW
    questionHtml: meta.content,   // full question text
    code,                          // submitted solution
    language,                      // java / cpp / python etc
    screenshot                     // base64 png
  };

  console.log("🚀 Sending final payload:", payload);

  chrome.runtime.sendMessage({
    type: "LEETCODE_ACCEPTED",
    payload
  });
});

/* -----------------------
   START
----------------------- */
observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log("📡 LeetCode Accepted detector active");
