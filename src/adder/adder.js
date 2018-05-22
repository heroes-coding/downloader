const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')
const playerDataPath = '/playerzips'

const unpackPlayerDataZip = (zipPath, isTest) => {
  console.log(`unzipping ${zipPath}`)
  if (isTest) console.log({isTest})
  let zip = new AdmZip(zipPath)
  const zipEntries = zip.getEntries()
  for (let e=0;e<zipEntries.length;e++) {
    const player = zipEntries[e]
    const data = zip.getEntry(player).getData()
    if (isTest) console.log({player, data})
    else fs.appendFileSync(path.join(playerDataPath,`${player}`),data)
  }
}

if (process.argv[2]) unpackPlayerDataZip(process.argv[2], true)
else {
  const watcher = chokidar.watch(playerDataPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  })
  watcher.on('ready', () => watcher.on('add', file => {
    setTimeout(async() => { unpackPlayerDataZip(file) }, 250)
  }))
}
