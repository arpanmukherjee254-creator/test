// =======================
// LeetCode Accepted Watcher (PURE BLACK THEME)
// =======================

let injected = false;

// ---------- HELPERS ----------
function getSlugFromUrl() {
  const match = location.href.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function extractCode() {
  const codeEl = document.querySelector("pre code");
  return codeEl ? codeEl.innerText : null;
}

function extractLanguage() {
  const btn = document.querySelector('[data-e2e-locator="submission-language"]');
  return btn ? btn.innerText.trim() : "txt";
}

function extractQuestionMarkdown() {
  const desc = document.querySelector('[data-track-load="description_content"]');
  return desc ? desc.innerText.trim() : null;
}

// ---------- METADATA ----------
async function fetchProblemMeta(slug) {
  const res = await fetch(`https://leetcode.com/problems/${slug}/`);
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
    difficulty: question.difficulty,
    topics: question.topicTags.map(t => t.name),
    url: `https://leetcode.com/problems/${slug}/`
  };
}

// ---------- NATIVE LEETCODE-STYLED BUTTON ----------
function injectPushButton(payload) {
  if (injected) return;
  injected = true;

  // 1. Find the container
  const allButtons = document.querySelectorAll('button');
  const solutionBtn = Array.from(allButtons).find(btn => 
    btn.textContent.includes("Solution")
  );
  const container = solutionBtn ? solutionBtn.closest('.flex.flex-none.gap-2') : null;

  if (!container) return;

  if (!document.getElementById("github-btn-animations")) {
    const style = document.createElement("style");
    style.id = "github-btn-animations";
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // 2. UPDATED COLOR: Pure Black (#000000)
  // 'bg-black' sets it to #000000.
  // 'border-white/20' ensures it is visible against the dark gray background.
  const leetCodeStyle =
    "whitespace-nowrap focus:outline-none bg-black hover:bg-neutral-800 text-white border border-white/20 flex h-[32px] items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium";

  const btn = document.createElement("button");
  btn.className = leetCodeStyle;

  const githubIcon = `
    <div class="relative text-[14px] leading-[normal] p-[1px] before:block before:h-3.5 before:w-3.5">
      <svg aria-hidden="true" focusable="false" 
           class="absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]" 
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
          0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94
          -.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53
          .63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
          .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
          0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12
          0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
          .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82
          .44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
          0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
          0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38
          A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </div>
  `;

  btn.innerHTML = `${githubIcon}<span class="hidden sm:inline">Push to GitHub</span>`;

  btn.onclick = async () => {
    const originalHTML = btn.innerHTML;
    const originalClass = btn.className;

    btn.innerHTML = `
      <svg class="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"/>
      </svg>
      <span class="hidden sm:inline">Pushing...</span>
    `;
    btn.disabled = true;
    btn.style.opacity = "0.7";

    await new Promise(r => setTimeout(r, 200));

    chrome.runtime.sendMessage(
      { type: "PUSH_FROM_PAGE", payload },
      () => {
        if (chrome.runtime.lastError) {
          // Error State
          btn.className = leetCodeStyle
            .replace("bg-black", "bg-red-500")
            .replace("hover:bg-neutral-800", "")
            .replace("border-white/20", "border-transparent");
          
          btn.innerHTML = `
            <svg class="h-[14px] w-[14px]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0z"/>
            </svg>
            <span class="hidden sm:inline">Failed</span>
          `;
          btn.disabled = false;

          setTimeout(() => {
            btn.className = originalClass;
            btn.innerHTML = originalHTML;
            btn.style.opacity = "1";
          }, 2000);
        } else {
          // Success State
          btn.className = leetCodeStyle
            .replace("bg-black", "bg-green-500")
            .replace("hover:bg-neutral-800", "")
            .replace("border-white/20", "border-transparent");

          btn.innerHTML = `
            <svg class="h-[14px] w-[14px]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
            <span class="hidden sm:inline">Pushed!</span>
          `;

          setTimeout(() => {
            btn.style.opacity = "0";
            btn.style.transform = "scale(0.9)";
            setTimeout(() => btn.remove(), 300);
          }, 1500);
        }
      }
    );
  };

  container.prepend(btn);
}

// ---------- OBSERVER ----------
const observer = new MutationObserver(async () => {
  const status = document.querySelector(
    'span[data-e2e-locator="submission-result"]'
  );

  if (!status || status.innerText.trim() !== "Accepted") return;

  observer.disconnect();

  const slug = getSlugFromUrl();
  if (!slug) return;

  const meta = await fetchProblemMeta(slug);
  if (!meta) return;

  injectPushButton({
    title: document.title.split(" - ")[0],
    slug,
    difficulty: meta.difficulty,
    topics: meta.topics,
    url: meta.url,
    questionMd: extractQuestionMarkdown(),
    code: extractCode(),
    language: extractLanguage()
  });
});

observer.observe(document.body, { childList: true, subtree: true });

console.log("📡 Native LeetCode-styled GitHub push button ready");