const app = document.getElementById("app");

/* =========================
   INITIAL LOAD
========================= */
chrome.storage.local.get(["githubUser"], (res) => {
  if (res.githubUser) {
    renderUser(res.githubUser);
  } else {
    renderLogin();
  }
});

/* =========================
   RENDER STATES
========================= */

function renderLogin() {
  app.innerHTML = `
    <button id="loginBtn">Login with GitHub</button>
  `;

  document.getElementById("loginBtn").onclick = () => {
    chrome.runtime.sendMessage({ type: "LOGIN_GITHUB" });
    window.close();
  };
}

function renderUser(user) {
  app.innerHTML = `
    <div style="text-align:center">
      <img src="${user.avatar}" width="64" style="border-radius:50%" />
      <div><b>${user.login}</b></div>
      <button id="logoutBtn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = logout;
}

function renderConfirm(problem) {
  app.innerHTML = `
    <h4>Push to GitHub?</h4>
    <p>${problem.title} (${problem.difficulty})</p>
    <button id="confirmBtn">Yes</button>
    <button id="cancelBtn">Cancel</button>
  `;

  document.getElementById("confirmBtn").onclick = () => {
    chrome.runtime.sendMessage({ type: "USER_CONFIRMED_PUSH" });
    window.close();
  };

  document.getElementById("cancelBtn").onclick = () => {
    chrome.runtime.sendMessage({ type: "USER_DENIED_PUSH" });
    window.close();
  };
}

/* =========================
   LOGOUT
========================= */
function logout() {
  chrome.storage.local.clear(() => {
    location.reload();
  });
}

/* =========================
   ASK BACKGROUND FOR PENDING PROBLEM
========================= */
chrome.runtime.sendMessage(
  { type: "GET_PENDING_PROBLEM" },
  (problem) => {
    if (problem) {
      renderConfirm(problem);
    }
  }
);