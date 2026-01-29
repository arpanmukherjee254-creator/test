// =========================
// CONFIG
// =========================
const REPO_NAME = "leetcode-tracker";

const DEFAULT_STATS = {
  Easy: 0,
  Medium: 0,
  Hard: 0,
  Total: 0
};

// =========================
// UTILS
// =========================
function normalizeDifficulty(d) {
  return d ? d[0].toUpperCase() + d.slice(1).toLowerCase() : "Easy";
}

function base64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function stripBase64Prefix(dataUrl) {
  if (!dataUrl) return null;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

// =========================
// SCREENSHOT CAPTURE (NEW APPROACH)
// =========================
async function captureScreenshot(tabId, windowId) {
  console.log("🎯 Starting screenshot capture...");
  console.log("Tab ID:", tabId, "Window ID:", windowId);
  
  try {
    // Step 1: Get current window state
    const currentWindow = await chrome.windows.getCurrent();
    console.log("Current window ID:", currentWindow.id);
    
    // Step 2: Ensure tab is active in its window
    await chrome.tabs.update(tabId, { active: true });
    console.log("✓ Tab activated");
    
    // Step 3: Get tab details to verify
    const tab = await chrome.tabs.get(tabId);
    console.log("Tab state:", { active: tab.active, status: tab.status, url: tab.url });
    
    if (!tab.active) {
      console.warn("⚠️ Tab is not active after update");
    }
    
    // Step 4: Focus the window
    await chrome.windows.update(windowId, { focused: true });
    console.log("✓ Window focused");
    
    // Step 5: Wait for everything to settle
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log("✓ Waited 800ms");
    
    // Step 6: Capture
    console.log("📸 Attempting capture...");
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    
    if (!dataUrl) {
      console.error("❌ Capture returned null/undefined");
      return null;
    }
    
    console.log("✅ Screenshot captured! Size:", dataUrl.length, "bytes");
    return dataUrl;
    
  } catch (error) {
    console.error("❌ Screenshot capture failed:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

// =========================
// MESSAGE HANDLER
// =========================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "PUSH_FROM_PAGE") return;

  console.log("📨 Received PUSH_FROM_PAGE message");
  console.log("Sender tab:", sender.tab.id, "window:", sender.tab.windowId);

  const payload = msg.payload;
  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId;

  // Handle async
  (async () => {
    try {
      // Capture screenshot
      const screenshot = await captureScreenshot(tabId, windowId);
      payload.screenshot = screenshot;
      
      if (!screenshot) {
        console.warn("⚠️ No screenshot captured, continuing without it");
      }
      
      // Push to GitHub
      await handlePush(payload);
      
      sendResponse({ success: true });
    } catch (error) {
      console.error("❌ Error in message handler:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate async response
  return true;
});

// =========================
// CORE PUSH
// =========================
async function handlePush(problem) {
  try {
    console.log("🚀 Starting GitHub push...");
    
    const token = await getGithubToken();
    const username = await getGithubUsername();
    
    if (!token || !username) {
      console.error("❌ Missing GitHub credentials");
      return;
    }

    console.log("✓ Got credentials for:", username);

    const diff = normalizeDifficulty(problem.difficulty);
    const basePath = `problems/${diff}/${problem.slug}`;

    await ensureRepo(token, username);
    console.log("✓ Repo ensured");

    // META
    await uploadFile(
      token,
      username,
      `${basePath}/meta.json`,
      JSON.stringify({
        title: problem.title,
        difficulty: diff,
        topics: problem.topics,
        url: problem.url,
        date: new Date().toISOString().split("T")[0]
      }, null, 2)
    );
    console.log("✓ Uploaded meta.json");

    // QUESTION
    if (problem.questionMd) {
      await uploadFile(
        token,
        username,
        `${basePath}/question.md`,
        `# ${problem.title}\n\n${problem.questionMd}`
      );
      console.log("✓ Uploaded question.md");
    }

    // SOLUTION
    if (problem.code) {
      const extMap = {
        java: "java",
        cpp: "cpp",
        python: "py",
        javascript: "js",
        typescript: "ts"
      };
      const ext = extMap[problem.language?.toLowerCase()] || "txt";

      await uploadFile(
        token,
        username,
        `${basePath}/solution.${ext}`,
        problem.code
      );
      console.log(`✓ Uploaded solution.${ext}`);
    }

    // SCREENSHOT
    const ss = stripBase64Prefix(problem.screenshot);
    if (ss) {
      console.log("📸 Uploading screenshot...");
      await uploadFile(
        token,
        username,
        `${basePath}/screenshot.png`,
        ss,
        true
      );
      console.log("✓ Uploaded screenshot.png");
    } else {
      console.warn("⚠️ No screenshot to upload");
    }

    // STATS
    const stats = await updateStats(token, username, diff);
    console.log("✓ Updated stats:", stats);

    // README
    await uploadFile(
      token,
      username,
      "README.md",
      `# LeetCode Solutions

Automatically tracked via browser extension.

## 📊 Stats
- Easy: ${stats.Easy}
- Medium: ${stats.Medium}
- Hard: ${stats.Hard}
- Total: ${stats.Total}
`
    );
    console.log("✓ Updated README.md");

    console.log("✅ GitHub push complete!");

  } catch (e) {
    console.error("❌ Push failed:", e);
    console.error("Error stack:", e.stack);
  }
}

// =========================
// GITHUB HELPERS
// =========================
function getGithubToken() {
  return new Promise(r =>
    chrome.storage.local.get("githubToken", x => r(x.githubToken))
  );
}

function getGithubUsername() {
  return new Promise(r =>
    chrome.storage.local.get("githubUser", x => r(x.githubUser?.login))
  );
}

async function ensureRepo(token, username) {
  const res = await fetch(
    `https://api.github.com/repos/${username}/${REPO_NAME}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status !== 404) return;

  await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: REPO_NAME, private: false })
  });
}

async function uploadFile(token, username, path, content, binary = false) {
  const url = `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${path}`;

  let sha;
  const existing = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (existing.ok) sha = (await existing.json()).sha;

  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Update ${path}`,
      content: binary ? content : base64EncodeUnicode(content),
      sha
    })
  });
}

async function updateStats(token, username, diff) {
  const path = "stats/summary.json";
  let stats = { ...DEFAULT_STATS };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${path}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const json = await res.json();
      stats = JSON.parse(atob(json.content));
    }
  } catch {}

  stats[diff]++;
  stats.Total++;

  await uploadFile(
    token,
    username,
    path,
    JSON.stringify(stats, null, 2)
  );

  return stats;
}