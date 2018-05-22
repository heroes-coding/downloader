const zmq = require('zeromq')
let socket
const port = 5560
const path = require('path')
const { asleep } = require('../helpers/tiny_helpers')
const { STATS_PATH, DOWNLOADS_DB_CONFIG_PATH } = require('../config')
const mmrDic = require(path.join(STATS_PATH,'leagueDic.json'))
const mmrLetters = {1:'q',3:'h',4:'t',2:'u',5:'q'}
const { createDatabase } = require('../helpers/postgresql')
const database = createDatabase(DOWNLOADS_DB_CONFIG_PATH)

function binarySearch(array,value) {
  let max = array.length
  let min = 0
  let x = Math.floor(max/2)
  let i = 0
  while (true) {
    i += 1
    if (i===100) {
      return false
    }
    if (array[x] <= value) {
      if (value <= array[x+1]) {
        return x + 1
      }
      const tempMin = x
      x = Math.floor((max+x)/2)
      min = tempMin
    } else {
      const tempMax = x
      x = Math.floor((min+x)/2)
      max = tempMax
    }
  }
}
async function startup() {
  // kills previous python spawns and starts new process
  let promise = new Promise(async function(resolve, reject) {
    socket = zmq.socket('req')
    socket.connect(`tcp://localhost:${port}`)
    await asleep(50)
    resolve(true)
  })
  return promise
}
startup()

const addPlayersAndUpdateMMRs = (replay, mmrs) => {
  let promise = new Promise(async function(resolve, reject) {
    const region = replay.r[2]
    const msl = replay.r[0]
    const gamemode = replay.r[5]
    if (gamemode === 5) resolve(true)
    const league = mmrLetters[gamemode]
    try {
      for (let b=0;b<replay.bnetIDs.length;b++) {
        let bnetID = replay.bnetIDs[b]
        let playerName = replay.h[b][3]
        let handleNumber = replay.h[b][4]
        let repHandle = `${playerName}#${handleNumber}`
        const fullId = `${region}-${bnetID}`
        if (users[fullId] === repHandle) continue
        let bQuery = `SELECT id,rids[1],handle,oldhandle FROM newusers WHERE id=${bnetID} and region=${region};`
        let bResult = await database.simpleQuery(bQuery)
        if (bResult.rowCount===0 && !users.hasOwnProperty(fullId)) {
          let newUserQuery = `INSERT INTO newusers (id,handle,region) VALUES ($1, $2, $3);`
          let newUserValues = [bnetID,handleNumber ? repHandle : playerName,region]
          users[fullId] = repHandle
          await database.simpleQuery(newUserQuery,newUserValues)
        } else {
          const oldHandle = users.hasOwnProperty(fullId) ? repHandle : bResult.rows[0].handle
          if (!oldHandle.includes('#') && handleNumber) {
            let query = "UPDATE newusers SET handle = ($1) WHERE id = ($2) and region = ($3);"
            let values = [repHandle,bnetID,region]
            await database.simpleQuery(query,values)
          } else if (handleNumber && repHandle !== oldHandle && bResult.rows[0].oldhandle !== repHandle) {
            let query = `SELECT msl FROM replays WHERE id = ${bResult.rows[0].rids}`
            let oldReplayMSL = await database.simpleQuery(query)
            const oldMSL = oldReplayMSL.rowCount ? oldReplayMSL.rows[0].msl : null
            if (!oldMSL) continue
            if (msl > oldMSL) {
              let query = "UPDATE newusers SET handle = ($1), oldhandle = ($2) WHERE id = ($3) and region =($4);"
              let values = [repHandle,oldHandle,bnetID,region]
              await database.simpleQuery(query,values)
            } else {
              let query = "UPDATE newusers SET oldhandle = ($1) WHERE id = ($2) and region =($3);"
              let values = [oldHandle,bnetID,region]
              await database.simpleQuery(query,values)
            }
          }
        }
      }
    } catch (e) {
      console.log(e)
      reject(e)
    }
    for (let h=0;h<10;h++) await database.simpleQuery(`UPDATE newusers SET ${league}mmr = ($1), ${league}sigma = ($2) WHERE id = ($3) and region = ($4)`, [mmrs[h][0], mmrs[h][1], replay.bnetIDs[h], region])
    resolve(true)
  })
  return promise
}

socket.on("message", async function(reply) {
  reply = JSON.parse(reply)
  if (reply.hasOwnProperty('error')) {
    console.log(reply)
    process.exit(0)
  }
  let [ returnMMRs, prediction, gameMode, returnid ] = reply
  const [ resolve, reject ] = resolveHolder[returnid]
  const mmrPercentiles = returnMMRs.map(x => binarySearch(mmrDic[mmrLetters[gameMode]],x[0]))
  delete resolveHolder[returnid]
  delete dataHolder[returnid]
  let replay = replays[returnid]
  delete replays[returnid]
  if (!mmrPercentiles || !returnMMRs) console.log({reply})
  replay.mmrPs = mmrPercentiles
  replay.mmrs = returnMMRs
  replay.prediction = prediction
  addPlayersAndUpdateMMRs(replay, returnMMRs)
  replay = null
  pathOpen = true
  resolve(true)
})

let id = 0
let resolveHolder = {}
let pathOpen = true
let dataHolder = {}
let replays = {}
const users = {}

async function getMMR(bnetIDs,won,gameMode,region, replay) {
  let promise = new Promise(async function(resolve, reject) {
    while (!pathOpen || !socket) {
      await asleep(5)
    }
    pathOpen = false
    const gameModeChar = mmrLetters[gameMode]
    const mmrMode = `${gameModeChar}mmr`
    const mmrSigma = `${gameModeChar}sigma`
    let result = await database.simpleQuery(`SELECT id, ${mmrMode}, ${mmrSigma} FROM newusers WHERE region = ${region} and id in (${bnetIDs.join(", ")});`)
    const mmrs = {}
    for (let r=0;r<result.rowCount;r++) {
      mmrs[result.rows[r].id] = [ result.rows[r][mmrMode], result.rows[r][mmrSigma] ]
    }
    const players = []
    for (let p=0;p<10;p++) {
      const bnetID = bnetIDs[p]
      if (mmrs.hasOwnProperty(bnetID) && mmrs[bnetID][0]) {
        players.push(mmrs[bnetID])
      } else {
        players.push([4200,500])
      }
    }
    resolveHolder[id] = [ resolve, reject ]
    const data = JSON.stringify({players, won, gameMode, id})
    dataHolder[id] = data
    replays[id] = replay
    id += 1
    socket.send(data)
  })
  return promise
}

module.exports = {
  getMMR
}

/*
let players = [4116317,92990,1345231,834446,9183779,42070,9227826,92166,1319799,1129958]
getMMR(players,1,5,null,1).then(returnMMRs => {
  console.log(returnMMRs)
})
*/
