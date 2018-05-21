const { queryReplayData, TOO_MANY_REQUESTS, UNKNOWN_ERROR } = require('./api')
const getHOTS = require('./parser/HOTS/getHOTS')
const { parseFile } = require('./parser/parser')
const fs = require('fs')
const { getFile } = require('./s3')
const archiver = require('archiver')
const zlib = require('zlib')
const { asleep, starlog, addTiming } = require('./helpers/tiny_helpers')
const MPQArchive = require('empeeku/mpyq').MPQArchive
const restTime = 10000
const sleepTime = 60000
const format = require('pg-format')
const DOWNLOAD_ERROR = 'download error'
const { DOWNLOADS_DB_CONFIG_PATH } = require('./config')
const { createDatabase } = require('./helpers/postgresql')
const { user,host,database,password } = require(DOWNLOADS_DB_CONFIG_PATH)
const downloadsDB = createDatabase(user,host,database,password)

const HOTSPromise = getHOTS()
let HOTS
let openDownloads, arch

let parseFull = true
let startIndex = process.argv[2]
let testRun = startIndex === 'test'
if (testRun) startIndex = undefined

let downloadResults = []
const downloadAndAppendToArchive = async(fileInfo) => {
  if (!HOTS) HOTS = await HOTSPromise
  const { filename, id } = fileInfo
  try {
    fileInfo = await getFile(fileInfo)
    const { file } = fileInfo

    if (parseFull) {
      const replay = await parseFile(file, HOTS)
      if (isNaN(replay)) arch.append(zlib.gzipSync(replay, {level: 1}),{ name: filename })
    } else {
      const archive = new MPQArchive(file)
      const header = archive.header.userDataHeader.content
      const details = archive.readFile('replay.details')
      const atts = archive.readFile('replay.attributes.events')
      const init = archive.readFile('replay.initData')
      const messages = archive.readFile('replay.message.events')
      const lobby = archive.readFile('replay.server.battlelobby')
      const trackers = archive.readFile('replay.tracker.events')
      arch.append(zlib.gzipSync(header, {level: 1}),{ name: `header-${filename}` })
      arch.append(zlib.gzipSync(details, {level: 1}),{ name: `details-${filename}` })
      arch.append(zlib.gzipSync(atts, {level: 1}),{ name: `atts-${filename}` })
      arch.append(zlib.gzipSync(init, {level: 1}),{ name: `init-${filename}` })
      arch.append(zlib.gzipSync(messages, {level: 1}),{ name: `messages-${filename}` })
      arch.append(zlib.gzipSync(lobby, {level: 1}),{ name: `lobby-${filename}` })
      arch.append(zlib.gzipSync(trackers, {level: 1}),{ name: `trackers-${filename}` })
    }
    downloadResults.push([id,filename,true])
  } catch (e) {
    console.log(e)
    downloadResults.push([id,filename,false])
  } finally { openDownloads-- }
}

const downloadReplays = async(results) => {
  let promise = new Promise(async(resolve, reject) => {
    const nResults = results.length
    const lastID = results[nResults-1].id
    let toDownload = []
    const timings = {}
    const startTime = process.hrtime()
    for (let i=0;i<results.length;i++) {
      let file = results[i]
      const { id, filename } = file
      let result
      try {
        result = await downloadsDB.simpleQuery(`SELECT * FROM downloads WHERE id = ${id}`)
      } catch (e) {
        console.log(e)
      }
      if (result.rowCount && result.rows[0].downloaded) continue
      else toDownload.push({ id, filename })
    }
    const nDowns = toDownload.length
    if (nDowns === 0) {
      console.log(`Got ${nResults} results from hotsapi, but none to download...`)
      return resolve(lastID)
    } else console.log(`Got ${nResults} results from hotsapi, should be downloading ${nDowns} of them...`)
    arch = archiver('zip', { zlib: { level: zlib.Z_NO_COMPRESSION } })
    downloadResults = []
    openDownloads = 0
    for (let f=0;f<nDowns;f++) {
      while (openDownloads > 5) await asleep(50)
      openDownloads++
      downloadAndAppendToArchive(toDownload[f],f)
    }
    while (openDownloads > 0) await asleep(50)
    addTiming(timings,startTime,`${nDowns} took`)
    let saveName = `/tempDownloads/${toDownload[0].id}-${toDownload[nDowns-1].id}.zip`
    console.log('done downloading', timings, saveName)
    const output = fs.createWriteStream(saveName)
    arch.finalize()
    arch.pipe(output)
    if (testRun) process.exit(0)
    const query = format('INSERT INTO downloads (id,filename,downloaded) VALUES %L', downloadResults)
    setTimeout(() => { fs.renameSync(saveName, saveName.replace('tempDownloads','downloads')) }, 3000)
    try {
      await downloadsDB.simpleQuery(query)
    } catch (e) {
      return reject(e)
    }
    return resolve(lastID)
  })
  return promise
}

const start = async(startIndex) => {
  // starts process and loops through api requests endlessly
  if (!startIndex) {
    let result = await downloadsDB.simpleQuery('SELECT max(id) as id FROM downloads')
    startIndex = result.rows[0].id
  }
  if (isNaN(startIndex)) throw new Error(`Start index of ${startIndex} is not a number`)
  else startIndex = parseInt(startIndex)

  starlog(`Starting to query hotsapi with index ${startIndex}`)
  let results
  // infinite loop
  while (true) {
    // initial api query
    try {
      results = await queryReplayData(startIndex)
    } catch (e) {
      const message = e.message
      if (message.includes(TOO_MANY_REQUESTS)) {
        console.log(`${TOO_MANY_REQUESTS}, sleeping for ${restTime}ms`)
        await asleep(restTime)
        continue
      } else {
        console.log({e, message:e.message})
        console.log(`${UNKNOWN_ERROR}, sleeping for ${sleepTime}ms`)
        await asleep(sleepTime)
        continue
      }
    }
    results = results.slice(0,25) // need to cut down on memory usage significantly.  This should do the trick (250 MB to 75?)
    // extra checks for empty result or strange result
    if (results.length < 25) {
      console.log(`Too few results, sleeping for ${sleepTime}ms`)
      await asleep(sleepTime)
      continue
    }
    try {
      startIndex = await downloadReplays(results)
    } catch (e) {
      console.log(e)
    }
    arch = null // make sure this thing is released from memory first
  } // end of forever loop
}

start(startIndex)
