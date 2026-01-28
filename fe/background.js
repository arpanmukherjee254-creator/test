// =========================
// CONFIG
// =========================
const CLIENT_ID = "Ov23liHWWxJjyHS8SZzn";
const REDIRECT_URI = chrome.identity.getRedirectURL("github");
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
  if (!d) return "Easy";
  return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
}

function base64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode("0x" + p1)
    )
  );
}

function stripBase64Prefix(dataUrl) {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

// =========================
// STATE
// =========================
let pendingProblem = null;

// =========================
// AUTH FLOW
// =========================
function startGithubOAuth() {
  const authUrl =
    "https://github.com/login/oauth/authorize" +
    "?client_id=" + CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&scope=repo read:user";

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) return;

      const code = new URL(redirectUrl).searchParams.get("code");
      if (!code) return;

      const tokenRes = await fetch("http://localhost:4000/exchange-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      const data = await tokenRes.json();
      if (!data.access_token) return;

      const token = data.access_token;
      chrome.storage.local.set({ githubToken: token });

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const user = await userRes.json();

      chrome.storage.local.set({
        githubUser: {
          login: user.login,
          avatar: user.avatar_url
        }
      });

      console.log("✅ GitHub login successful:", user.login);
    }
  );
}

// =========================
// MESSAGE HANDLER
// =========================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📩 BG RECEIVED:", msg);

  if (msg.type === "LOGIN_GITHUB") {
    startGithubOAuth();
    return;
  }

  if (msg.type === "LEETCODE_ACCEPTED") {
    pendingProblem = msg.payload;
    chrome.action.openPopup();
    return;
  }

  if (msg.type === "GET_PENDING_PROBLEM") {
    sendResponse(pendingProblem);
    return true;
  }

  if (msg.type === "USER_CONFIRMED_PUSH") {
    handleConfirmedPush();
    return;
  }

  if (msg.type === "USER_DENIED_PUSH") {
    pendingProblem = null;
  }
});

// =========================
// CORE FLOW (FINAL)
// =========================
async function handleConfirmedPush() {
  try {
    if (!pendingProblem) return;

    const token = await getGithubToken();
    const username = await fetchAndStoreGithubUser(token);
    if (!token || !username) return;

    const diff = normalizeDifficulty(pendingProblem.difficulty);
    const basePath = `problems/${diff}/${pendingProblem.slug}`;

    await ensureRepo(token, username);

    // 1️⃣ META
    await uploadFile(
      token,
      username,
      `${basePath}/meta.json`,
      JSON.stringify(
        {
          title: pendingProblem.title,
          difficulty: diff,
          topics: pendingProblem.topics,
          url: pendingProblem.url,
          date: new Date().toISOString().split("T")[0]
        },
        null,
        2
      )
    );

    // 2️⃣ QUESTION (HTML)
    if (pendingProblem.questionHtml) {
      await uploadFile(
        token,
        username,
        `${basePath}/question.html`,
        pendingProblem.questionHtml
      );
    }

    // 3️⃣ SOLUTION
    if (pendingProblem.code) {
      const extMap = {
        java: "java",
        cpp: "cpp",
        c: "c",
        python: "py",
        javascript: "js",
        typescript: "ts"
      };

      const ext =
        extMap[pendingProblem.language?.toLowerCase()] || "txt";

      await uploadFile(
        token,
        username,
        `${basePath}/solution.${ext}`,
        pendingProblem.code
      );
    }

    // 4️⃣ SCREENSHOT (already base64)
    if (pendingProblem.screenshot) {
      await uploadFile(
        token,
        username,
        `${basePath}/screenshot.png`,
        stripBase64Prefix(pendingProblem.screenshot),
        true
      );
    }

    // 5️⃣ STATS + README
    await updateStats(token, username, diff);

    pendingProblem = null;
    console.log("✅ PUSH FLOW COMPLETE");
  } catch (e) {
    console.error("❌ PUSH FLOW FAILED:", e);
  }
}

// =========================
// STORAGE HELPERS
// =========================
function getGithubToken() {
  return new Promise(resolve => {
    chrome.storage.local.get("githubToken", res => {
      resolve(res.githubToken || null);
    });
  });
}

function getGithubUsername() {
  return new Promise(resolve => {
    chrome.storage.local.get("githubUser", res => {
      resolve(res.githubUser?.login || null);
    });
  });
}

async function fetchAndStoreGithubUser(token) {
  const existing = await getGithubUsername();
  if (existing) return existing;

  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const user = await res.json();

  chrome.storage.local.set({
    githubUser: {
      login: user.login,
      avatar: user.avatar_url
    }
  });

  return user.login;
}

// =========================
// REPO SETUP
// =========================
async function ensureRepo(token, username) {
  const repoUrl = `https://api.github.com/repos/${username}/${REPO_NAME}`;
  const check = await fetch(repoUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (check.status !== 404) return;

  const create = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: REPO_NAME,
      description: "📊 Automated LeetCode Tracker",
      private: false
    })
  });

  if (!create.ok) throw new Error("Repo creation failed");

  await uploadFile(
    token,
    username,
    "README.md",
    generateReadme({ ...DEFAULT_STATS })
  );

  await uploadFile(
    token,
    username,
    "stats/summary.json",
    JSON.stringify({ ...DEFAULT_STATS }, null, 2)
  );
}

// =========================
// STATS + README
// =========================
async function getFileJSON(token, username, path) {
  const res = await fetch(
    `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return JSON.parse(atob(json.content));
}

async function updateStats(token, username, diff) {
  const statsPath = "stats/summary.json";
  let stats = await getFileJSON(token, username, statsPath);
  if (!stats) stats = { ...DEFAULT_STATS };

  stats[diff]++;
  stats.Total++;

  await uploadFile(token, username, statsPath, JSON.stringify(stats, null, 2));
  await uploadFile(token, username, "README.md", generateReadme(stats));
}

// =========================
// GITHUB FILE UPLOAD
// =========================
async function uploadFile(token, username, path, content, isBinary = false) {
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
      content: isBinary ? content : base64EncodeUnicode(content),
      sha
    })
  });
}

// =========================
// README GENERATOR
// =========================
function generateReadme(stats) {
  return `
# 📊 LeetCode Tracker

Automatically updated via Chrome Extension.

## Stats

| Difficulty | Solved |
|----------|--------|
| Easy | ${stats.Easy} |
| Medium | ${stats.Medium} |
| Hard | ${stats.Hard} |
| **Total** | **${stats.Total}** |

_Last updated: ${new Date().toLocaleDateString()}_
`.trim();
}
