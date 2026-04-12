// File: main.js
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('allow-file-access-from-files');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Sổ Kỹ Thuật Điện Tử",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true
  });

  // FIX: Load thẳng từ Firebase Hosting thật
  // Domain này đã được Firebase Auth whitelist sẵn
  win.loadURL('https://motorcycle-management-sy-f6090.web.app/Sign_Up/index.html');

  // Bỏ comment nếu cần debug
  // win.webContents.openDevTools();
}

ipcMain.on('exit-app', () => {``
  app.quit();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});