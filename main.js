const { app, BrowserWindow, screen, powerSaveBlocker } = require('electron')
const fs = require('fs')
const path = require('path')

const isDev = process.argv.includes('--dev')
const isTest = false // BUILD_MODE: set to true for test builds
const enableHotReload = false

function setupDevHotReload(win) {
  const reloadDebounceMs = 150
  let pendingReloadTimer = null

  const requestRendererReload = () => {
    if (pendingReloadTimer) clearTimeout(pendingReloadTimer)
    pendingReloadTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      win.webContents.reloadIgnoringCache()
    }, reloadDebounceMs)
  }

  const requestAppRelaunch = () => {
    if (pendingReloadTimer) clearTimeout(pendingReloadTimer)
    pendingReloadTimer = setTimeout(() => {
      app.relaunch({ args: process.argv })
      app.exit(0)
    }, reloadDebounceMs)
  }

  const watchRecursive = (watchPath, onChange) => {
    try {
      fs.watch(watchPath, { recursive: true }, (_event, filename) => {
        if (!filename) return
        if (filename.includes('node_modules')) return
        onChange(filename)
      })
      return true
    } catch {
      return false
    }
  }

  // Reload the renderer when UI files change.
  const srcDir = path.join(__dirname, 'src')
  if (!watchRecursive(srcDir, requestRendererReload)) {
    console.warn('[dev] Hot reload: fs.watch recursive not supported on this platform.')
  }

  // Relaunch the whole app if main/preload changes.
  const mainPath = path.join(__dirname, 'main.js')
  const preloadPath = path.join(__dirname, 'preload.js')
  fs.watchFile(mainPath, { interval: 200 }, requestAppRelaunch)
  fs.watchFile(preloadPath, { interval: 200 }, requestAppRelaunch)
}

function pickDisplay() {
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  const labelHint = (process.env.KIOSK_DISPLAY_LABEL || 'elo').toLowerCase()
  const idHint = process.env.KIOSK_DISPLAY_ID
  const indexHint = process.env.KIOSK_DISPLAY_INDEX

  const displaySummary = displays.map((display, index) => {
    const label = display.label || 'unknown'
    const bounds = `${display.bounds.width}x${display.bounds.height}`
    const primaryMark = display.id === primaryDisplay.id ? 'primary' : 'secondary'
    return `[${index}] id=${display.id} label=${label} bounds=${bounds} ${primaryMark}`
  })

  console.log(`Available displays: ${displays.length}`)
  displaySummary.forEach(line => console.log(line))

  if (idHint) {
    const idMatch = displays.find(display => String(display.id) === String(idHint))
    if (idMatch) {
      return { display: idMatch, reason: `id=${idHint}` }
    }
  }

  if (indexHint !== undefined) {
    const index = Number(indexHint)
    if (!Number.isNaN(index) && displays[index]) {
      return { display: displays[index], reason: `index=${index}` }
    }
  }

  if (labelHint) {
    const labelMatch = displays.find(display => (display.label || '').toLowerCase().includes(labelHint))
    if (labelMatch) {
      return { display: labelMatch, reason: `label~${labelHint}` }
    }
  }

  const externalDisplays = displays.filter(display => display.id !== primaryDisplay.id)
  const fallbackDisplay = externalDisplays.reduce((best, display) => {
    if (!best) return display
    const bestArea = best.bounds.width * best.bounds.height
    const displayArea = display.bounds.width * display.bounds.height
    return displayArea > bestArea ? display : best
  }, null)

  return { display: fallbackDisplay || primaryDisplay, reason: fallbackDisplay ? 'largest-external' : 'primary' }
}

function createWindow() {
  const { display, reason } = pickDisplay()
  console.log(`Using display: ${display.id} (${display.bounds.width}x${display.bounds.height}) via ${reason}`)

  // Dev/test window: 9:16 ratio to match 4K portrait kiosk (2160 × 3840)
  // Dynamically size to fit the user's screen with padding
  const useDevWindow = isDev || isTest

  let winWidth, winHeight, winX, winY

  if (useDevWindow) {
    // Calculate window size to fit screen while maintaining 9:16 aspect ratio
    const workArea = display.workArea // Available space (excludes taskbar/dock)
    const padding = 40
    const availableWidth = workArea.width - padding * 2
    const availableHeight = workArea.height - padding * 2
    const aspectRatio = 9 / 16

    // Calculate dimensions constrained by available space
    let width = availableHeight * aspectRatio
    let height = availableHeight

    // If too wide, constrain by width instead
    if (width > availableWidth) {
      width = availableWidth
      height = width / aspectRatio
    }

    winWidth = Math.round(width)
    winHeight = Math.round(height)
    // Center on the work area
    winX = workArea.x + Math.round((workArea.width - winWidth) / 2)
    winY = workArea.y + Math.round((workArea.height - winHeight) / 2)
  } else {
    winWidth = 2160
    winHeight = 3840
    winX = display.bounds.x
    winY = display.bounds.y
  }

  const win = new BrowserWindow({
    x: winX,
    y: winY,
    width: winWidth,
    height: winHeight,
    useContentSize: useDevWindow, // Make width/height refer to content area, not including frame
    fullscreen: !useDevWindow,
    kiosk: !useDevWindow,
    frame: useDevWindow,
    autoHideMenuBar: true,
    backgroundColor: '#E0E0E0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Lock aspect ratio in dev mode so resizing doesn't break proportions
  if (useDevWindow) {
    win.setAspectRatio(9 / 16)
  }

  if (isDev) {
    // In dev mode, load from Vite dev server for hot reload
    win.loadURL('http://localhost:5173?dev=1')
  } else if (isTest) {
    // Test mode: load from dist with cursor visible
    win.loadFile('dist/index.html', { query: { dev: '1' } })
  } else {
    // Production kiosk mode
    win.loadFile('dist/index.html')
  }

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' })
    if (enableHotReload) {
      setupDevHotReload(win)
    }
  }

  if (!useDevWindow) {
    win.on('close', (e) => {
      e.preventDefault()
    })
  }
}

app.whenReady().then(() => {
  const blockId = powerSaveBlocker.start('prevent-display-sleep')
  console.log(`PowerSaveBlocker active: ${blockId} (prevent-display-sleep)`)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.on('before-quit', () => {
    if (powerSaveBlocker.isStarted(blockId)) {
      powerSaveBlocker.stop(blockId)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
