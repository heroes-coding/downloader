const { queryReplayData, TOO_MANY_REQUESTS, UNKNOWN_ERROR } = require('./api')
const { getCurrentIndex, checkForPreviouslyDownloaded } = require('./postgres')
const getHOTS = require('./parser/HOTS/getHOTS')
const { parseFile } = require('./parser/parser')
const fs = require('fs')
const { getFile } = require('./s3')
const archiver = require('archiver')
const zlib = require('zlib')
const { asleep, starlog } = require('./helpers/tiny_helpers')
const MPQArchive = require('empeeku/mpyq').MPQArchive
const restTime = 10000
const sleepTime = 60000
const DOWNLOAD_ERROR = 'download error'
const HOTSPromise = getHOTS()
let HOTS
let openDownloads, arch

let startIndex = process.argv[2] || getCurrentIndex() // can take a user supplied first index or the last one available

const downloadAndAppendToArchive = async(fileInfo) => {
  try {
    fileInfo = await getFile(fileInfo)
    const { file, filename } = fileInfo
    const archive = new MPQArchive(file)
    const header = archive.header.userDataHeader.content
    const details = archive.readFile('replay.details')
    const atts = archive.readFile('replay.attributes.events')
    const init = archive.readFile('replay.initData')
    const messages = archive.readFile('replay.message.events')
    const lobby = archive.readFile('replay.server.battlelobby')
    const trackers = archive.readFile('replay.tracker.events')
    arch.append(header,{ name: `header-${filename}`})
    arch.append(details,{ name: `details-${filename}`})
    arch.append(atts,{ name: `atts-${filename}`})
    arch.append(init,{ name: `init-${filename}`})
    arch.append(messages,{ name: `messages-${filename}`})
    arch.append(lobby,{ name: `lobby-${filename}`})
    arch.append(trackers,{ name: `trackers-${filename}`})
  } catch (e) {
    console.log(e)
  } finally {
    openDownloads--
  }
}

const downloadReplays = async(results) => {
  let promise = new Promise(async(resolve, reject) => {
    const nResults = results.length
    const lastID = results[nResults-1].id
    let toDownload
    try {
      toDownload = await checkForPreviouslyDownloaded(results)
    } catch (e) {
      throw e
    }
    const nDowns = toDownload.length
    if (nDowns === 0) {
      console.log(`Got ${nResults} results from hotsapi, but none to download...`)
      return resolve(lastID)
    } else console.log(`Got ${nResults} results from hotsapi, should be downloading ${nDowns} of them...`)
    arch = archiver('zip', { zlib: { level: zlib.Z_NO_COMPRESSION } })
    openDownloads = 0
    for (let f=0;f<nDowns;f++) {
      console.log('should be downloading')
      while (openDownloads > 5) await asleep(50)
      openDownloads++
      downloadAndAppendToArchive(toDownload[f],f)
    }
    while (openDownloads > 0) await asleep(50)
    console.log('done downloading')
    let savename = `/downloads/${toDownload[0].id}-${toDownload[nDowns-1].id}.zip`
    const output = fs.createWriteStream(savename)
    arch.finalize()
    arch.pipe(output)
    return resolve(lastID)
  })
  return promise
}

const start = async(startIndex) => {
  // starts process and loops through api requests endlessly
  if (isNaN(startIndex)) throw new Error(`Start index of ${startIndex} is not a number`)
  else startIndex = parseInt(startIndex)

  starlog(`Starting to query hotsapi with index ${startIndex}`)
  let results
  // infinite loop
  let count = 0
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
    // extra checks for empty result or strange result
    if (results.length < 50) {
      console.log(`Too few results, sleeping for ${sleepTime}ms`)
      await asleep(sleepTime)
      continue
    }

    startIndex = await downloadReplays(results)
    arch = null // make sure this thing is released from memory first
    count++
    if (count>1) {
      await asleep(60000)
      process.exit(0)
    }

  } // end of forever loop
}

start(startIndex)
