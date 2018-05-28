const { STATS_PATH } = require('../config')
const fullStats = {}
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const fullStatsPath = path.join(STATS_PATH,'compressed')
const fullStatsUpdatesPath = path.join(STATS_PATH,'compressedUpdates')
const chokidar = require('chokidar')

// delete updates, as they are already loaded into full files
const updates = fs.readdirSync(fullStatsUpdatesPath)
const nUpdates = updates.length
for (let f=0;f<nUpdates;f++) {
  const update = updates[f]
  try {
    fs.unlinkSync(path.join(fullStatsUpdatesPath,update))
  } catch (e) {
    console.log(e)
  }
}

const files = fs.readdirSync(fullStatsPath)
const nFiles = files.length
for (let f=0;f<nFiles;f++) {
  const file = files[f]
  fullStats[file] = fs.readFileSync(path.join(fullStatsPath,file))
}

const addUpdates = (zipPath) => {
  console.log(`unzipping ${zipPath}`)
  let zip = new AdmZip(zipPath)
  const zipEntries = zip.getEntries()
  for (let e=0;e<zipEntries.length;e++) {
    const entry = zipEntries[e]
    const key = entry.entryName
    const data = zip.getEntry(entry).getData()
    fullStats[key] = Buffer.concat([fullStats[key],data])
  }
  zip = null
}

const watcher = chokidar.watch(fullStatsUpdatesPath, {
  ignored: /(^|[\/\\])\../,
  persistent: true
})
watcher.on('ready', () => watcher.on('add', file => {
  setTimeout(async() => { addUpdates(file) }, 3000)
}))

const getFile = (file,offset) => {
  if (fullStats.hasOwnProperty(file)) {
    const fileBytes = fullStats[file].slice(offset,)
    const nBytes = fileBytes.length
    if (!nBytes) return Buffer.from(new Uint8Array([0,0,0,0]))
    else {
      const lengthBuffer = Buffer.from(new Uint8Array([nBytes & 0xff,(nBytes >> 8) & 0xff,(nBytes >> 16) & 0xff,(nBytes >> 24) & 0xff]))
      return Buffer.concat([lengthBuffer,fileBytes])
    }
  } else return Buffer.from(new Uint8Array([0,0,0,0]))
}

module.exports = getFile
