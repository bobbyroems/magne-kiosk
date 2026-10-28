const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('kiosk', {
  platform: process.platform,
  isKiosk: !process.argv.includes('--dev')
})
