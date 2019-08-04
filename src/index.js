const { queryReplayData, TOO_MANY_REQUESTS, UNKNOWN_ERROR } = require('./api')
const getHOTS = require('./parser/HOTS/getHOTS')
const { parseFile } = require('./parser/parser')
const fs = require('fs')
const { getFile } = require('./s3')
const archiver = require('archiver')
const zlib = require('zlib')
const { asleep, starlog, addTiming } = require('./helpers/tinyHelpers')
const MPQArchive = require('empeeku/mpyq').MPQArchive
const restTime = 5000
const sleepTime = 5000
const format = require('pg-format')
const { addMMRs } = require('./mmr/addMMRs')
const { DOWNLOADS_DB_CONFIG_PATH, STATS_PATH } = require('./config')
const { createDatabase } = require('./helpers/postgresql')
const { transferReplays, transferPlayerData } = require('./ssh/functions')
const downloadsDB = createDatabase(DOWNLOADS_DB_CONFIG_PATH)
const { saveOpenFiles } = require('./binary/binaryConverter')
const { extractCompressedData } = require('./binary/binaryExtractor')
const path = require('path')

const HOTSPromise = getHOTS()
let HOTS

let parseFull = true
let savePlayerData = false
let startIndex = process.argv[2]
let stopIndex = process.argv[3]
if (stopIndex) stopIndex = parseInt(stopIndex)

const getDownloaded = ({ id, filename }) => new Promise(async (resolve, reject) => {
	try {
		const result = await downloadsDB.simpleQuery(`SELECT * FROM downloads WHERE id = ${id}`)
		if (result.rowCount && result.rows[0].downloaded) {
			resolve(null)
		} else {
			resolve({ id, filename })
		}
	} catch (e) {
		reject(e)
	}
})

const filterForAlreadyDownloadedReplays = results => new Promise(async (resolve, reject) => {
	try {
		const nResults = results.length
		let toDownload = await Promise.all(results.map(file => getDownloaded(file)))
		toDownload = toDownload.filter(file => file)
		const nDowns = toDownload.length
		if (nDowns === 0) {
			console.log(`Got ${nResults} results from hotsapi, but none to download...`)
			return resolve(lastID)
		} else {
			console.log(`Got ${nResults} results from hotsapi, should be downloading ${nDowns} of them...`)
		}
		resolve({ nDowns, toDownload })
	} catch (e) {
		reject(e)
	}
})



const decorateReplays = (replays, saveName, repKeys, toDownload, nDowns, downloadResults) => new Promise(async (resolve, reject) => {
	try {
		replays = await addMMRs(replays)
		const arch = archiver('zip', { zlib: { level: zlib.Z_NO_COMPRESSION } })
		let openEntries = 0
		arch.on("entry", (data) => {
			openEntries--
		})
		for (let r = 0; r < repKeys.length; r++) {
			const repKey = repKeys[r]
			arch.append(zlib.gzipSync(JSON.stringify(replays[repKey]), { level: 1 }), { name: repKey })
			openEntries++
		}
		extractCompressedData(replays, HOTS)
		while (openEntries > 0) {
			await asleep(50)
		}
		const output = fs.createWriteStream(saveName)
		arch.finalize()
		arch.pipe(output)
		setTimeout(() => {
			transferReplays(saveName).then(() => {
				fs.unlinkSync(saveName)
			})
		}, 3000)
		let playerDataZipPath = path.join(STATS_PATH, `${toDownload[0].id}-${toDownload[nDowns - 1].id}.zip`)
		await saveOpenFiles(playerDataZipPath, stopIndex, savePlayerData)
		if (savePlayerData)
			setTimeout(() => {
				transferPlayerData(playerDataZipPath).then(async () => {
					fs.unlinkSync(playerDataZipPath)
					if (!stopIndex) {
						const query = format('INSERT INTO downloads (id,filename,downloaded) VALUES %L', downloadResults)
						try {
							await downloadsDB.simpleQuery(query)
						} catch (e) {
							return reject(e)
						}
					}
				})
			}, 3000)
		resolve(true)
	} catch (e) {
		console.log(e)
		reject(e)
	}
})

const downloadAndParseReplay = async (fileInfo) => new Promise(async (resolve, reject) => {
	const { filename, id } = fileInfo
	try {
		const file = await getFile(filename)
		const replay = await parseFile(file, HOTS)
		if (isNaN(replay)) {
			resolve({ filename, id, replay })
		} else {
			resolve({ filename, id, parseFailure: true })
		}
	} catch (e) {
		console.log(e)
		resolve({ filename, id })
	}
})

const downloadReplays = async (nDowns, toDownload) => new Promise(async (resolve, reject) => {
	const timings = {}
	const startTime = process.hrtime()
	const downloadResults = []
	const replays = {}
	const results = await Promise.all(toDownload.map(fileInfo => downloadAndParseReplay(fileInfo)))
	results.forEach(result => {
		const { id, filename, replay, parseFailure } = result
		if (replay) {
			replays[filename] = replay
			downloadResults.push([id, filename, true])
		} else if (parseFailure) {
			downloadResults.push([id, filename, true])
		} else {
			downloadResults.push([id, filename, false])
		}
	})
	addTiming(timings, startTime, `${nDowns} took`)
	const repKeys = Object.keys(replays)
	let saveName = `/tempDownloads/${toDownload[0].id}-${toDownload[nDowns - 1].id}.zip`
	console.log('done downloading', timings, saveName, { repKeys: repKeys.length })
	await decorateReplays(replays, saveName, repKeys, toDownload, nDowns, downloadResults)
	return resolve(true)
})

const getStartIndex = startIndex => new Promise(async (resolve, reject) => {
	try {
		if (!startIndex) {
			let result = await downloadsDB.simpleQuery('SELECT max(id) as id FROM downloads')
			startIndex = result.rows[0].id + 1
		} else if (isNaN(startIndex)) {
			throw new Error(`Start index of ${startIndex} is not a number`)
		} else {
			startIndex = parseInt(startIndex)
		}
		resolve(startIndex)
	} catch (e) {
		console.log(e)
		process.exit(1)
	}

})

const start = async (startIndex) => {
	// starts process and loops through api requests endlessly
	startIndex = await getStartIndex(startIndex)
	starlog(`Starting to query hotsapi with index ${startIndex}`)
	HOTS = await HOTSPromise
	let results
	let checkSQS = true
	// infinite loop
	while (true) {
		// initial api query
		try {
			results = await queryReplayData(startIndex)
			if (results.length < 1) {
				// one for last index, too lazy to look into this further.  Jesus I was a messy coder when I wrote this stuff
				console.log(`Too few results, sleeping for ${sleepTime}ms`)
				await asleep(sleepTime)
				continue
			}
		} catch (e) {
			const message = e.message
			if (message.includes(TOO_MANY_REQUESTS)) {
				console.log(`${TOO_MANY_REQUESTS}, sleeping for ${restTime}ms`)
				await asleep(restTime)
				continue
			} else {
				console.log({ e, message: e.message })
				console.log(`${UNKNOWN_ERROR}, sleeping for ${sleepTime}ms`)
				await asleep(sleepTime)
				continue
			}
		}
		results = results.slice(0, 25) // need to cut down on memory usage significantly.  This should do the trick (250 MB to 75?)
		const { nDowns, toDownload } = await filterForAlreadyDownloadedReplays(results)
		if (nDowns === 0) {
			startIndex = results[results.length - 1].id + 1
			console.log("All replays already downloaded, checking again...")
			continue
		}

		try {
			await downloadReplays(nDowns, toDownload)
			if (stopIndex && startIndex >= stopIndex) {
				console.log('exiting because got to stop index')
				process.exit(0)
			}
			startIndex = results[results.length - 1].id + 1
		} catch (e) {
			console.log(e.message)
		}
	} // end of forever loop
}

start(startIndex)
