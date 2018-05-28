const { STATS_PATH } = require('../config')
const fullStats = {}
const fs = require('fs')
const path = require('path')
const fullStatsPath = path.join(STATS_PATH,'compressed')
const files = fs.readdirSync(fullStatsPath)

const nFiles = files.length
for (let f=0;f<nFiles;f++) {
  const file = files[f]
  fullStats[file] = fs.readFileSync(path.join(fullStatsPath,file))
}

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
