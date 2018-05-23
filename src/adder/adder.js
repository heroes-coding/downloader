const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')
const playerZipsPath = '/playerzips'
const playerDataPath = '/players'

const unpackPlayerDataZip = (zipPath, isTest) => {
  console.log(`unzipping ${zipPath}`)
  if (isTest) console.log({isTest})
  let zip = new AdmZip(zipPath)
  const zipEntries = zip.getEntries()
  for (let e=0;e<zipEntries.length;e++) {
    const entry = zipEntries[e]
    const player = entry.entryName
    const data = zip.getEntry(entry).getData()
    if (isTest) console.log({player, data})
    else fs.appendFileSync(path.join(playerDataPath,`${player}`),data)
  }
  zip = null
  if (!isTest) fs.unlinkSync(zipPath)
}
// /playerzips/9158146-9158169.zip

if (process.argv[2]) unpackPlayerDataZip(process.argv[2], true)
else {
  const curFiles = fs.readdirSync(playerZipsPath)
  for (let f=0;f<curFiles.length;f++) unpackPlayerDataZip(path.join(playerZipsPath,curFiles[f]))
  const watcher = chokidar.watch(playerZipsPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  })
  watcher.on('ready', () => watcher.on('add', file => {
    setTimeout(async() => { unpackPlayerDataZip(file) }, 250)
  }))
}
