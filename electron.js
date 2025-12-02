
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Verifica se está em modo de desenvolvimento
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'SGP - Hospitalar',
    // Caminho robusto para o ícone
    icon: isDev 
      ? path.join(__dirname, 'public', 'icon.ico') 
      : path.join(__dirname, 'dist', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    show: false
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
    win.maximize();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
