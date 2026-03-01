const { app, BrowserWindow, shell, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const isDev = !app.isPackaged;
let mainWindow = null;
let productionServer = null;

function resolveWindowIcon() {
  const iconCandidates = [
    path.join(__dirname, '..', 'build', 'icons', 'icon.png'),
    path.join(__dirname, '..', 'public', 'favicon.svg')
  ];

  return iconCandidates.find((iconPath) => fs.existsSync(iconPath));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.hdr': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function setCrossOriginHeaders(response, contentType) {
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

function sanitizePathname(urlPathname) {
  const cleaned = decodeURIComponent((urlPathname || '/').split('?')[0].split('#')[0]);
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

async function resolveFilePath(rootDir, pathname) {
  const normalizedRoot = path.normalize(rootDir);
  const requestedFile = path.normalize(path.join(rootDir, pathname));

  if (!requestedFile.startsWith(normalizedRoot)) {
    throw new Error('Path traversal detected');
  }

  const fileStats = await fsp.stat(requestedFile).catch(() => null);
  if (fileStats && fileStats.isFile()) {
    return requestedFile;
  }

  if (fileStats && fileStats.isDirectory()) {
    const indexFile = path.join(requestedFile, 'index.html');
    const indexStats = await fsp.stat(indexFile).catch(() => null);
    if (indexStats && indexStats.isFile()) {
      return indexFile;
    }
  }

  return path.join(rootDir, 'index.html');
}

function createProductionServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const pathname = sanitizePathname(request.url);
        const filePath = await resolveFilePath(rootDir, pathname);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        setCrossOriginHeaders(response, contentType);
        const stream = fs.createReadStream(filePath);

        stream.on('error', () => {
          response.statusCode = 500;
          response.end('Failed to read file.');
        });

        stream.pipe(response);
      } catch (error) {
        response.statusCode = 500;
        response.end('Internal server error.');
      }
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addressInfo = server.address();
      const url = `http://127.0.0.1:${addressInfo.port}`;
      resolve({ server, url });
    });
  });
}

async function createWindow() {
  const iconPath = resolveWindowIcon();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false);
  });

  if (isDev) {
    const devServerUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000';
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  const distPath = path.join(__dirname, '..', 'dist');
  const { server, url } = await createProductionServer(distPath);
  productionServer = server;
  await mainWindow.loadURL(url);
}

ipcMain.handle('window:minimize', () => {
  if (!mainWindow) return false;
  mainWindow.minimize();
  return true;
});

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }

  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', () => {
  if (!mainWindow) return false;
  mainWindow.close();
  return true;
});

ipcMain.handle('window:is-maximized', () => {
  if (!mainWindow) return false;
  return mainWindow.isMaximized();
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (productionServer) {
    productionServer.close();
    productionServer = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
