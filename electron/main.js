const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const http = require("http");
const net = require("net");
const { fork } = require("child_process");

let mainWindow = null;
let serverProcess = null;

// 사용 가능한 로컬 포트 찾기
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// 로컬 Next.js 서버가 뜰 때까지 대기
function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Local server timeout"));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

async function startServerAndGetUrl() {
  if (!app.isPackaged && process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  const port = await findAvailablePort(3456);
  const isDev = !app.isPackaged;

  let serverPath;
  if (isDev) {
    serverPath = path.join(__dirname, "../.next/standalone/server.js");
  } else {
    // 패키징 환경 (resources/app 또는 app.asar.unpacked 등)
    serverPath = path.join(process.resourcesPath, "standalone/server.js");
    if (!require("fs").existsSync(serverPath)) {
      serverPath = path.join(app.getAppPath(), ".next/standalone/server.js");
    }
  }

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: port.toString(),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    silent: true,
  });

  serverProcess.on("error", (err) => {
    console.error("[Electron] Next.js 서버 실행 실패:", err);
  });

  const url = `http://127.0.0.1:${port}?offline=true`;
  await waitForServer(`http://127.0.0.1:${port}`);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 440,
    minHeight: 640,
    title: "Packinbag Offline",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  // 외부 링크는 기본 브라우저로 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "파일",
      submenu: [isMac ? { role: "close" } : { role: "quit", label: "종료" }],
    },
    {
      label: "편집",
      submenu: [
        { role: "undo", label: "실행 취소" },
        { role: "redo", label: "다시 실행" },
        { type: "separator" },
        { role: "cut", label: "잘라내기" },
        { role: "copy", label: "복사" },
        { role: "paste", label: "붙여넣기" },
        { role: "selectAll", label: "전체 선택" },
      ],
    },
    {
      label: "보기",
      submenu: [
        { role: "reload", label: "새로고침" },
        { role: "forceReload", label: "강제 새로고침" },
        { type: "separator" },
        { role: "resetZoom", label: "실제 크기" },
        { role: "zoomIn", label: "확대" },
        { role: "zoomOut", label: "축소" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체 화면" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  createMenu();
  try {
    const url = await startServerAndGetUrl();
    createWindow(url);
  } catch (err) {
    console.error("[Electron] 시작 실패:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
