const util = require('util')
const ProgressBar = require('progress')
const dataHolder = {totalBytes:0,playerData:{},playerBytes:{},replayData:{},replayBytes:0}
const maxBits = 2**32
const fs = require('fs')
const path = require('path')
const hasher = require('fnv-plus')
const archiver = require('archiver')
const zlib = require('zlib')
const { STATS_PATH } = require('../config')
const fPath = path.join(STATS_PATH,'replays')
const compressedReplaysPath = path.join(STATS_PATH, 'compressed')
const { asleep } = require('../helpers/tinyHelpers')

function hashString(input) {
  let ahash = hasher.hash(input, 64)
  return ahash.str()
}

let daysAndMinutesSinceLaunch = function(minSinceLaunch) {
  let time = minSinceLaunch - 240
  let days = Math.floor(time/(1440))
  let hours = time%24
  let mins = time%60
  return [days,mins,hours]
}

let averageLevelCalculator = function(levels) {
  let index1 = 1
  let index2 = 1
  let nLevs1 = levels[0].length
  let nLevs2 = levels[1].length
  let maxLevel = Math.max(nLevs1,nLevs2)
  let levDifferences = []
  for (let m = 1;m<30;m++) {
    if (m > maxLevel -1) {
      break
    }
    const secs = m*60
    while (true) {
      if (index1 < nLevs1 && levels[0][index1] < secs) {
        index1 += 1
      } else {
        break
      }
    }
    while (true) {
      if (index2 < nLevs2 && levels[1][index2] < secs) {
        index2 += 1
      } else {
        break
      }
    }
    levDifferences.push(index2-index1)
  }
  if (levDifferences.length===0) {
    return 0
  }
  return levDifferences.reduce((x,y) => x + y)/levDifferences.length
}

let hashFiles = []
function saveOpenFiles(playerDictionaryName, stopIndex, savePlayerData) {
  let promise = new Promise(async function(resolve, reject) {
    try {
      if (savePlayerData) {
        const arch = archiver('zip', { zlib: { level: zlib.Z_NO_COMPRESSION } })
        const playerKeys = Object.keys(dataHolder.playerData)
        const nPlayers = playerKeys.length
        for (let p=0;p<nPlayers;p++) {
          const player = playerKeys[p]
          arch.append(dataHolder.playerData[player],{ name: player })
        }
        // this immediate finalize might be buggy, bud
        const output = fs.createWriteStream(playerDictionaryName)
        arch.finalize()
        arch.pipe(output)
      }
      if (!stopIndex) {
        const replayKeys = Object.keys(dataHolder.replayData)
        const nReplays = replayKeys.length
        let barR = new ProgressBar('Replay bytes saved: :bar :percent (:rate/sec) (:current/:total)', {
          complete: '=',
          incomplete: ' ',
          width: 20,
          total: nReplays
        })
        for (let r=0;r<nReplays;r++) {
          const rep = replayKeys[r]
          const replayDat = dataHolder.replayData[rep]
          fs.appendFileSync(path.join(compressedReplaysPath,`${rep}`),replayDat)
          barR.tick()
          if (r%1000 === 0) {
            await asleep(1)
          }
        }
      }
      dataHolder.playerData = {}
      dataHolder.replayData = {}
      dataHolder.replayBytes = {}
      dataHolder.playerBytes = {}
      dataHolder.totalBytes = 0
      hashFiles = []
      return resolve()
    } catch (e) {
      console.log(e)
      process.exit(0)
    }
  })
  return promise
}

function getInt32Bytes(x) {
  if (x > maxBits) {
    console.log('too big!', x)
    throw new Error('Int bigger than 32 bits!')
  }
  const bytes = []
  let i = 4
  do {
    bytes[--i] = x & (255)
    x = Math.floor(x/256)
  } while (i)
  return bytes
}

// DICTIONARY DEFINITIONS.  NEED TO OFFLOAD THESE TO FILES WHEN ACTUALLY DOING IT!
const talentDic = require(path.join(STATS_PATH,'talentDic.json'))
const builds = require(path.join(STATS_PATH,'builds.json'))
let nBuilds = Object.keys(builds).length

const packData = function(total,increment, max, descaler) {
  increment = increment || 0
  increment = Math.round(increment/descaler)
  total *= max
  total += Math.min(max-1,increment) // If you add by max, the remainder becomes 0, buddy!
  return total
}

const statMaxes = {
  '0': 129,
  '1': 467,
  '2': 288,
  '3': 234915,
  '4': 20,
  '5': 189444,
  '6': 45,
  '7': 218940,
  '8': 97,
  '9': 386109,
  '10': 333,
  '11': 245,
  '12': 25,
  '13': 7,
  '14': 6,
  '15': 10,
  '16': 195704
}

function getStatMaxMultiplier(mapStatID) {
  if (mapStatID < 0 || mapStatID > 16) {
    return 1
  }
  const max = statMaxes[mapStatID]
  if (max < 500) {
    return 1
  }
  return max/500
}

function convertReplayAndSave(replay, HOTS, gzipReplay, ignorePlayers, ignoreFull=false) {
  // set gzipReplay to true if these are new replays to be converted to bytes.  False for rebuilds / re-run throughs
  const [minSinceLaunch, build, region, gameLength, mapName, gameMode, firstTo10, firstTo20, firstFort,winners] = replay.r
  const heroes = [0,1,2,3,4,5,6,7,8,9].map(h => replay.h[h][0])
  let choppedGameLength = Math.min(2520-1,gameLength)
  const choppedGameLengthMinutesMinusOne = Math.round(gameLength/60) - 1
  const hashInput = `${gameMode}${Math.round(choppedGameLength/60)}${heroes.join("")}${winners}${minSinceLaunch}${mapName}${build}`
  let hashResult = hashString(hashInput)
  replay.hash = hashResult
  const gzipPath = path.join(fPath,`${hashResult}.json.gz`)
  if (fs.existsSync(gzipPath) && gzipReplay) return false // don't repeat for already existing files
  const mmrPercentiles = replay.mmrPs
  const firstTo10Result = firstTo10 && (firstTo10[0]===0 || firstTo10[0]) ? firstTo10[0] : 2
  const firstTo20Result = firstTo20 && (firstTo20[0]===0 || firstTo20[0]) ? firstTo20[0] : 2
  const firstFortResult = firstFort && (firstFort[0]===0 || firstFort[0]) ? firstFort[0] : 2
  let saveTals = false
  const minusOneRegion = region - 1
  if (!builds.hasOwnProperty(build)) {
    builds[build] =nBuilds
    talentDic[build] = {}
    talentDic.builds = builds
    saveTals = true
    fs.writeFileSync(path.join(STATS_PATH,'builds.json'), JSON.stringify(builds), 'utf8')
    nBuilds += 1
  }
  const buildIndex = builds[build]
  const [ DSL, minSinceDay, hoursSinceDay ] = daysAndMinutesSinceLaunch(minSinceLaunch)
  // LONG GAMES WOULD HAVE DISAPPEARED BECAUSE OF THIS.  REDO  // Build / Map / Length / Hero 1

  let replayBytes
  if (!ignorePlayers) {
    var intVals = [
      [[buildIndex,321,1], [mapName,35,1], [choppedGameLength, 2520, 1], [heroes[0],147,1]],
      [[minSinceLaunch,4860000,1], [gameMode,6,1], [heroes[1],147,1]],
      [[heroes[2],147,1],[heroes[3],147,1],[heroes[4],147,1], [heroes[5],147,1], [firstTo10Result,3,1], [winners,2,1]],
      [[heroes[6],147,1],[heroes[7],147,1],[heroes[8],147,1], [heroes[9],147,1], [firstTo20Result,3,1], [firstFortResult,3,1]]
    ]
    // replayInts are the important condensed data from the entire replay
    const replayInts = []
    for (let v=0;v<intVals.length;v++) {
      const innerVals = intVals[v]
      let repInt = 0
      for (let i=0;i<innerVals.length;i++) {
        repInt = packData(repInt, ...innerVals[i])
      }
      try {
        const bytesArray = getInt32Bytes(repInt)
        replayInts.push(bytesArray)
      } catch (e) {
        console.log(e)
        console.log(`replay int ${v}`,innerVals.map(x => x[0]))
        process.exit(1)
      }
    }
    replayBytes = Buffer.from([].concat.apply([],replayInts))
  }
  // heroInts are the important condensed data for an individual player
  let endingLevels
  try {
    endingLevels = replay.e.l.map(x => [x.length,30,1])
  } catch (e) {
    endingLevels = [[0,30,1],[0,30,1]]
  }
  const heroTownKills = Array(10).fill(0)
  const teamMercCaptures = [0,0]
  const teamDeaths = [0,0]
  const teamDamage = [0,0]
  const teamTownKills = [0,0]
  const votesReceived = Array(10).fill(0)
  for (let h=0; h<10; h++) {
    const votee = replay.h[h][58]
    const mercs = replay.h[h][24]
    const damage = replay.h[h][14]
    const team = Math.floor(h/5)
    const deaths = replay.h[h][6]
    if (deaths) { teamDeaths[team] += deaths }
    if (damage) { teamDamage[team] += damage }
    if (mercs) { teamMercCaptures[team] += mercs }
    if (votee) { votesReceived[votee] += 1 }
  }

  try {
    for (let t=0;t<replay.e.t.length;t++) {
      const [ time, x, y, p ] = replay.e.t[t]
      teamTownKills[ x < 128 ? 1 : 0 ] += 1
      if (p < 10) { heroTownKills[p] += 1 }
    }
  } catch (e) { /* do nothing.  Missing team data is okay. */ }

  const pStructures = heroTownKills
  const pGlobes = Array(10).fill(0)
  const pMercs = Array(10).fill(0)
  const KDA = Array(10).fill(0)
  const pTalents = Array(10).fill(null)
  let avgLevelDifference = replay.e.l ? Math.round(averageLevelCalculator(replay.e.l)*10) + 35 : 35 // centers at "35", max 3.5 above or below

  for (let h=0;h<10;h++) {
    pTalents[h] = Array(7).fill(0)
    const team = Math.floor(h/5)
    const bnetID = replay.bnetIDs[h]
    const [ hero, slot, stat2, stat3, stat4, Award, Deaths, stat7, stat8, Kills, Assists, HighestKillStreak, HeroLevel, ExperienceContribution, HeroDamage, DamageTaken, StructureDamage, SiegeDamage, Healing, SelfHealing, SecondsSpentDead, SecondsofCrowdControl, CreepDamage, SummonDamage, MercenaryCampCaptures, WatchTowerCaptures, MinionDamage, RegenGlobesCollected, Silenced, statID1, statValue1, statID2, statValue2, statID3, statValue3, statID4, statValue4, statID5, statValue5, statID6, statValue6, statID7, statValue7, TeamfightDamageTaken, TeamfightEscapes, SecondsofSilence, ClutchHeals, OutnumberedDeaths, Escapes, SecondsofStuns, Vengeances, TeamfightHeroDamage, SecondsofRoots, ProtectionGiventoAllies, stat54, NumberofPings, NumberofChatCharactersTyped, stat57, Votedfor, SecondsonFire, mapStats ] = replay.h[h]

    pGlobes[h] = RegenGlobesCollected
    pMercs[h] = MercenaryCampCaptures
    KDA[h] = Deaths === 0 ? (Kills + Assists === 0 ? 0 : 20) : Math.round((Kills + Assists)/Deaths)

    const BigTalker = NumberofChatCharactersTyped ? 1 : 0
    const VotedFor = Votedfor ? (Math.floor(Votedfor/5) === team ? 0 : 1) : 2
    const Pinger = NumberofPings > 42 ? 1 : 0
    const Feeder = Deaths >= (teamDeaths[team] - Deaths)/2 ? 1 : 0
    const WetNoodle = HeroDamage < 0.1*(teamDamage[team] - HeroDamage) ? 1 : 0
    const DangerousNurse = (HOTS.roleN[hero] === 1 && HeroDamage > (teamDamage[team] - HeroDamage)/4) ? 1 : 0

    const mapStatIDs = [0, 0]
    const mapStatValues = [0, 0]
    if (mapStats) {
      const mapStatKeys = Object.keys(mapStats)
      for (let m=0;m<mapStatKeys.length;m++) {
        const id = parseInt(mapStatKeys[m])
        const value = mapStats[id]
        if (value && value < 2000000) {
          mapStatIDs[m] = id + 1 // Keep the compressed code clean and can use zeros above.  Don't forget to subtract this off on the way back
          mapStatValues[m] = value
          /* THIS IS NOW FROZEN - DON'T UNLOCK IT IF YOU DON'T WANT TO MESS UP THE VALUES!
          if (!statMaxes.hasOwnProperty(id)) {
            statMaxes[id] = value
          }
          statMaxes[id] = value > statMaxes[id] ? value : statMaxes[id]
          */
        }
      }
    }
    if (!talentDic[build].hasOwnProperty(hero)) {
      talentDic[build][hero] = Array(7)
      saveTals = true
      for (let t=0;t<7;t++) {
        talentDic[build][hero][t] = {0:null}
      }
    }
    let talentSlots
    try {
      talentSlots = []
      for (let t=0;t<7;t++) {
        const [talentSlot,talentNumber] = replay.h[h].slice(29+t*2,31+t*2)
        if (!talentDic[build][hero][t].hasOwnProperty(talentSlot) && talentSlot) {
          talentDic[build][hero][t][talentSlot] = talentNumber
          console.log(`Adding new talent for hero: ${hero}, level: ${t}, bracket: ${talentSlot}, talewntNumber`)
          saveTals = true
        }
        pTalents[h][t] = talentSlot
        talentSlots.push(talentSlot)
      }
    } catch (e) {
      talentSlots = Array(7).fill(0)
      console.log('missing talent slots')
    }
    if (!ignorePlayers) {
      const heroIntVals = [
        [[Vengeances,23,1], [Kills,57,1],[mapStatIDs[0],40,1], ...talentSlots.map((x,i) => [x, i===2 ? 4 : i===6 ? 6 : 5, 1])],
        [[SiegeDamage,307,1000], [MercenaryCampCaptures,34,1],[mapStatIDs[1],40,1], [ExperienceContribution,50,1000], [Assists,99,1]],
        [[SecondsofRoots, 91,1], [SecondsSpentDead,646,1], [SelfHealing,69,1000], ...endingLevels],
        [[HeroDamage,138,1000], [StructureDamage,92,1000], [Feeder,2,1], [TeamfightDamageTaken,123,1000], [SecondsonFire,679,1], [BigTalker,2,1]],
        [[RegenGlobesCollected,120,1],[Escapes,27,1], [Healing,156,1000], [SecondsofSilence, 94, 1], [TeamfightHeroDamage,82,1000]],
        [[Award,40,1], [Deaths,40,1], [mapStatValues[1],500,getStatMaxMultiplier(mapStatIDs[1]-1)], [mapStatValues[0],500,getStatMaxMultiplier(mapStatIDs[0]-1)], [slot, 10, 1]],
        [[SecondsofCrowdControl,4950,1],[SecondsofStuns,100,1], [ProtectionGiventoAllies,100,1000], [OutnumberedDeaths,38,1], [Pinger,2,1]],
        [[teamMercCaptures[team],85,1], [votesReceived[h],11,1],[MinionDamage,251,1000], [heroTownKills[h],6,1], [teamTownKills[team],12,1], [WetNoodle,2,1], [DangerousNurse,2,1], [VotedFor,3,1]]
      ]

      const HeroInts = []
      for (let v=0;v<heroIntVals.length;v++) {
        const innerVals = heroIntVals[v]
        let repInt = 0
        for (let i=0;i<innerVals.length;i++) {
          repInt = packData(repInt, ...innerVals[i])
        }
        try {
          const bytesArray = getInt32Bytes(repInt)
          HeroInts.push(bytesArray)
        } catch (e) {
          console.log(e)
          console.log(`hero int ${v}`,innerVals.map(x => x[0]))
          console.log(util.inspect(innerVals,false,null))
          process.exit(1)
        }
      }
      const fullID = `${region}-${bnetID}`
      const heroBytes = Buffer.from([].concat.apply([],HeroInts))
      if (!dataHolder.playerData.hasOwnProperty(fullID)) {
        dataHolder.playerData[fullID] = Buffer.concat([replayBytes,heroBytes])
        dataHolder.playerBytes[fullID] = 48
      } else {
        dataHolder.playerData[fullID] = Buffer.concat([dataHolder.playerData[fullID],replayBytes,heroBytes])
        dataHolder.playerBytes[fullID] += 48
      }
      dataHolder.totalBytes += 48
    }
  }

  if (saveTals) { fs.writeFileSync(path.join(STATS_PATH,'talentDic.json'), JSON.stringify(talentDic), 'utf8') }
  hashFiles.push([hashResult,replay])

  if (!ignoreFull) {
    const fullReplayIntVals = [
      [[pGlobes[0],60,1], [heroes[8],147,1], [heroes[0],147,1], [pTalents[0][0],5,1], [pTalents[5][6],6,1], [pTalents[0][2],4,1], [pTalents[0][3],5,1], [pTalents[0][4],5,1]],
      [[mapName,30,1], [mmrPercentiles[9],100,1], [heroes[1],147,1], [heroes[7],147,1], [pGlobes[6],60,1]],
      [[pStructures[0],6,1], [pStructures[1],6,1], [firstTo10Result,3,1], [pTalents[2][1],5,1], [pTalents[2][2],4,1], [pTalents[2][3],5,1], [pTalents[2][4],5,1], [pTalents[2][5],5,1], [pTalents[2][6],6,1], [mmrPercentiles[8],100,1], [pTalents[5][0],5,1], [pTalents[5][1],5,1]],
      [[pMercs[0],12,1], [pMercs[1],12,1], [pTalents[3][0],5,1], [pTalents[4][6],6,1], [pTalents[3][2],4,1], [pTalents[3][3],5,1], [pTalents[3][4],5,1], [pTalents[3][5],5,1], [pTalents[3][6],6,1], [firstFortResult,3,1], [pTalents[5][4],5,1], [pTalents[0][5],5,1], [pTalents[4][2],4,1]],
      [[pMercs[5],12,1], [pTalents[4][0],5,1], [pTalents[4][1],5,1], [pTalents[0][6],6,1], [pTalents[4][3],5,1], [pTalents[4][4],5,1], [pTalents[4][5],5,1], [pTalents[3][1],5,1], [pTalents[6][0],5,1], [pTalents[6][1],5,1], [pTalents[6][2],4,1], [pStructures[4],6,1], [pStructures[5],6,1]],
      [[pMercs[4],12,1], [heroes[2],147,1], [pTalents[6][3],5,1], [pTalents[6][4],5,1], [pTalents[6][5],5,1], [pTalents[6][6],6,1], [pTalents[5][2],4,1], [pTalents[5][3],5,1], [heroes[3],147,1]],
      [[pTalents[8][3],5,1], [pMercs[7],12,1], [mmrPercentiles[6],100,1], [mmrPercentiles[7],100,1], [mmrPercentiles[4],100,1], [avgLevelDifference,70,1]],
      [[pTalents[8][0],5,1], [pTalents[8][1],5,1], [pTalents[8][2],4,1], [pTalents[9][6],6,1], [pTalents[8][4],5,1], [pTalents[8][5],5,1], [heroes[5],147,1], [pMercs[6],12,1], [heroes[6],147,1]],
      [[heroes[9],147,1], [pTalents[9][0],5,1], [pTalents[9][1],5,1], [pTalents[9][2],4,1], [pTalents[9][3],5,1], [pTalents[9][4],5,1], [pTalents[9][5],5,1], [pTalents[8][6],6,1], [pGlobes[7],60,1], [pStructures[6],6,1]],
      [[heroes[4],147,1], [pTalents[5][5],5,1], [pTalents[0][1],5,1], [minusOneRegion,4,1], [winners,2,1], [minSinceDay,60,1], [hoursSinceDay,24,1], [mmrPercentiles[5],100,1]],
      [[pMercs[9],12,1], [pStructures[7],6,1], [pGlobes[8],60,1], [KDA[9],25,1], [KDA[0],25,1], [KDA[1],25,1], [pGlobes[9],60,1]],
      [[KDA[2],25,1], [KDA[3],25,1], [pMercs[8],12,1], [pStructures[9],6,1], [pTalents[1][0],5,1], [pTalents[1][1],5,1], [pTalents[1][2],4,1], [pTalents[1][6],6,1], [pTalents[1][4],5,1], [pTalents[1][5],5,1], [pStructures[2],6,1]],
      [[KDA[4],25,1], [KDA[5],25,1], [KDA[6],25,1], [KDA[7],25,1], [pGlobes[1],60,1], [pStructures[8],6,1], [pTalents[1][3],5,1], [pStructures[3],6,1]],
      [[pGlobes[2],60,1], [pGlobes[3],60,1], [pGlobes[4],60,1], [pGlobes[5],60,1], [buildIndex,321,1]],
      [[choppedGameLengthMinutesMinusOne,42,1], [mmrPercentiles[1],100,1], [mmrPercentiles[2],100,1], [mmrPercentiles[3],100,1], [mmrPercentiles[0],100,1]],
      [[firstTo20Result,3,1], [pMercs[2],12,1], [pMercs[3],12,1], [pTalents[2][0],5,1], [pTalents[7][0],5,1], [pTalents[7][1],5,1], [pTalents[7][2],4,1], [pTalents[7][3],5,1], [pTalents[7][4],5,1], [pTalents[7][5],5,1], [pTalents[7][6],6,1], [KDA[8],25,1]]
    ]
    const FullReplayInts = []
    for (let v=0;v<fullReplayIntVals.length;v++) {
      const innerVals = fullReplayIntVals[v]
      let repInt = 0
      for (let i=0;i<innerVals.length;i++) {
        try {
          repInt = packData(repInt, ...innerVals[i])
        } catch (e) {
          console.log(fullReplayIntVals)
          console.log(innerVals)
          console.log(e)
          console.log(innerVals,'undefined?',i,innerVals.length)
          process.exit(0)
        }
      }
      try {
        const bytesArray = getInt32Bytes(repInt)
        FullReplayInts.push(bytesArray)
      } catch (e) {
        console.log(e)
        console.log(`hero int ${v}`,innerVals.map(x => x[0]))
        console.log(util.inspect(innerVals,false,null))
        process.exit(1)
      }
    }
    let dateID = `${DSL}-${gameMode}`
    const FullReplayBytes = Buffer.from([].concat.apply([],FullReplayInts))
    if (!dataHolder.replayData.hasOwnProperty(dateID)) {
      dataHolder.replayData[dateID] = FullReplayBytes
      dataHolder.replayBytes[dateID] = 64
    } else {
      dataHolder.replayData[dateID] = Buffer.concat([dataHolder.replayData[dateID],FullReplayBytes])
      dataHolder.replayBytes[dateID] += 64
    }
    dataHolder.totalBytes += 64
  }
  return hashResult
}

function debugPackInt(innerVals) {
  let repInt = 0
  for (let i=0;i<innerVals.length;i++) {
    console.log(`Before: ${repInt}, ${innerVals[i]}`)
    repInt = packData(repInt, ...innerVals[i])
  }
  console.log(`Final output: ${repInt}`)
  const bytesArray = getInt32Bytes(repInt)
  console.log(bytesArray)
}

module.exports = {
  statMaxes,
  talentDic,
  builds,
  convertReplayAndSave,
  debugPackInt,
  dataHolder,
  saveOpenFiles
}
