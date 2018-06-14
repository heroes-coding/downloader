"use strict"
const protocolJS = require('./protocol.js')
const { Protocol } = protocolJS
const MPQArchive = require('empeeku/mpyq').MPQArchive
const getProto = require('./getProto')
const md5 = require('md5')
const { Alterac, Tomb, Temple, Shrines, Hanamura, Hollow, Holdout, Battlefield, Garden, Doom, Shire, Bay, Mines, Warhead, Cavern, City, Outpost, Industrial, Checkpoint, Foundry } = require('./mapParsers')

const loopsToS = function(time) {
  return parseInt((time-608)/16)
}
const HS = (hash,index) => hash.slice(index*2,(index+1)*2)
const md5HashConverter = (h) => `${HS(h,3)}${HS(h,2)}${HS(h,1)}${HS(h,0)}-${HS(h,5)}${HS(h,4)}-${HS(h,7)}${HS(h,6)}-${HS(h,8)}${HS(h,9)}-${HS(h,10)}${HS(h,11)}${HS(h,12)}${HS(h,13)}${HS(h,14)}${HS(h,15)}`

const nickMaps = {'AlteracPass': 19, 'BraxisOutpost': 15, 'ControlPoints': 1, 'Shrines': 2, 'Crypts': 0, 'BattlefieldOfEternity': 5, 'Warhead Junction': 6, 'BlackheartsBay': 10, 'CursedHollow': 3, 'LostCavern': 11, 'HanamuraPayloadPush': 16, 'TowersOfDoom': 8, 'HauntedWoods': 7, 'Hanamura': 14, 'BraxisHoldout': 4, 'DragonShire': 9, 'HauntedMines': 12, 'SilverCity': 13, 'Volskaya': 17, 'IndustrialDistrict':18}
const protoProto = require('./protos/61952.json')

let getTalentN = function(talentName,heroN,talentN,HOTS) {
  if (HOTS.talentN.hasOwnProperty(talentName)) return HOTS.talentN[talentName]
  return talentName
}

function parseFile(file, HOTS) {
  let promise = new Promise(async function(resolve, reject) {
    try {
      const archive = new MPQArchive(file)
      let thisReplay = {}
      let proto = protoProto
      let header = Protocol.decodeReplayHeader(archive.header.userDataHeader.content,proto.typeInfos,proto.hID)
      let build = header['m_version']['m_build']
      let details = Protocol.decodeReplayDetails(archive.readFile('replay.details'),proto.typeInfos,proto.dID)

      let UTCTime = details['m_timeUTC'] === 0 ? details['m_timeLocalOffset'] : details['m_timeUTC']
      let minSinceLaunch = parseInt((UTCTime - 130776768000000000)/600000000)
      let mapName = details['m_title'].toString()
      let winners = details['m_playerList'][0]['m_result']-1
      if (winners===-1) return resolve(3)
      let gameLength = loopsToS(header.m_elapsedGameLoops)
      let bnetIDs = []
      let heroNames = []
      let heroes = []
      proto = await getProto(build)

      if (proto===undefined) return resolve(4)
      for (let i=0; i<10; i++) bnetIDs.push(details['m_playerList'][i]['m_toon']['m_id'])
      let atts = Protocol.decodeReplayAttributesEvents(archive.readFile('replay.attributes.events'))
      let initData

      let apiHash, gameMode
      if (build >= 43905) {
        try { // For some builds initData doesn't work in javascript.  This is a problem.
          initData = Protocol.decodeReplayInitdata(archive.readFile('replay.initData'),proto.typeInfos,proto.iID)
          const randomValue = initData.m_syncLobbyState.m_gameDescription.m_randomValue
          apiHash = md5(`${bnetIDs.slice(0,10).sort((x,y) => x > y).join("")}${randomValue}`)
          apiHash = md5HashConverter(apiHash)
          gameMode = HOTS.modesDic[initData['m_syncLobbyState']['m_gameDescription']['m_gameOptions']['m_ammId']]
        } catch (err) {
          console.log('Problem with initData for game of build ' + build)
          return resolve(0)
        }
      } else {
        try {
          gameMode = HOTS.modesDic[atts.scopes[16][4010][0].value.toString()]
        } catch (err) {
          gameMode = 'Quick Match'
        }
      }
      thisReplay.apiHash = apiHash
      gameMode = HOTS.modesN[gameMode]
      let region = details['m_playerList'][0]['m_toon']['m_region']
      if (region===98 || region===0) return resolve(98)

      if (HOTS.mapDic.hasOwnProperty(mapName)) mapName = HOTS.mapDic[mapName]
      else if (HOTS.mapDic.hasOwnProperty(mapName.toLowerCase())) mapName = HOTS.mapDic[mapName.toLowerCase()]
      for (let i=0; i<10; i++) {
        let hero = details['m_playerList'][i]['m_hero'].toString()
        if (HOTS.heroDic.hasOwnProperty(hero)) heroes.push(HOTS.heroDic[hero])
        else heroes.push(hero)
        heroNames.push(details['m_playerList'][i]['m_name'].toString())
      }

      thisReplay.bnetIDs = bnetIDs
      let hashCode
      let messages = Protocol.decodeReplayMessageEvents(archive.readFile('replay.message.events'),proto.typeInfos,1,proto.mTypes)
      let pings = [[],[],[],[],[],[],[],[],[],[]]
      let chats = []
      while (true) {
        let m = messages.next().value
        if (m) {
          if (m._eventid===1) {
            let pinger = m['_userid']['m_userId']
            let pingTime = loopsToS(m['_gameloop'])
            if (pinger<10) pings[pinger].push(pingTime)
          } else if (m._eventid===0) {
            let message = m['m_string'].toString()
            let messenger = m['_userid']['m_userId']
            chats.push([loopsToS(m['_gameloop']),messenger,message])
          }
        } else break
      }
      const teamNumbers = [0,0,0,0,0,0,0,0,0,0]
      let numberPattern = /\d+/g
      let battleTags = []
      const lobbyFile = archive.readFile('replay.server.battlelobby')
      const uniqueTeams = []
      if (!lobbyFile) {
        battleTags = Array(10).fill(null)
      } else {
        let lobby = lobbyFile.toString()
        let fIndex=0
        const teams = []
        for (let b=0;b<10;b++) {
          while (true) {
            let bnetIDIndex = lobby.slice(fIndex).indexOf(heroNames[b])
            if (bnetIDIndex === -1) {
              battleTags.push(null)
              console.log('Could not find Battle Tag for ' + heroNames[b])
              if (heroNames[b] === `Player ${b+1}`) return resolve(98)
              break // breaks out of inner while loop
            }
            const team = lobby.slice(fIndex+bnetIDIndex-9,fIndex+bnetIDIndex-1)
            teams.push(team)
            if (!uniqueTeams.includes(team)) uniqueTeams.push(team)
            fIndex = bnetIDIndex + fIndex + heroNames[b].length+1
            let place = fIndex
            try {
              battleTags.push(parseInt(lobby.slice(place,place+10).match(numberPattern)[0]))
              break
            } catch (err) {
              continue // This doesn't happen very much, but when it does, just keep looping through looking for numbers
            }
          }
        }
        const teamCounts = {}
        for (let t=0;t<10;t++) {
          const team = teams[t]
          if (!teamCounts.hasOwnProperty(team)) teamCounts[team] = 0
          teamCounts[team]++
        }
        for (let t=0;t<2;t++) {
          const usedTeams = []
          for (let p=0;p<5;p++) {
            const team = teams[t*5+p]
            const usedIndex = usedTeams.indexOf(team)
            const count = teamCounts[team]
            if (usedIndex === -1 && count > 1) {
              usedTeams.push(team)
              const teamNumber = usedTeams.length
              teamNumbers[t*5+p] = teamNumber
            } else if (count > 1) {
              teamNumbers[t*5+p] = usedIndex+1
            } else teamNumbers[t*5+p] = 0
          }
        }
      }
      if (build<40336) {
        console.log(build)
        thisReplay['h'] = {}
        for (let p=0;p<10;p++) thisReplay['h'][p] = [heroes[p],p,Math.floor(p/5)===winners,heroNames[p],battleTags[p]]
        thisReplay['r'] = [minSinceLaunch, build, region, gameLength, mapName, gameMode, null, null,null,winners]
        thisReplay['e'] = {'c':chats,'tn':teamNumbers}
        thisReplay.hash = hashCode
        return resolve(thisReplay)
      }

      let trackers = Protocol.decodeReplayTrackerEvents(archive.readFile('replay.tracker.events'),proto.typeInfos,proto.tID,proto.tTypes)

      let uniqueDic = {}
      let scoreResultValues
      let deadTowns = []
      let deadCannons = []
      let cannonIDs = {}
      let townIDs = {}
      let deadCannonIDs = []
      let bornZerg = []
      let bossFights = []
      let spawnedNukes = []
      let targetedNukes = []
      let droppedNukes = []
      let deathLoops = []
      let payLoadSpawns = []
      let pathDic = {}
      let paths = []
      let pathDeaths = {}
      let deadPaths = []
      let payload = 1
      let mechCaptures = []
      let pickOrder = []
      while (true) {
        let event = trackers.next().value
        if (event) {
          let id = event._eventid
          if (id===1) {
            let unitName = event.m_unitTypeName
            if (unitName==='VolskayaVehicle') mechCaptures.push([event['m_controlPlayerId']-11,loopsToS(event['_gameloop']),event['m_x'],event['m_y']])
            if (unitName[0] === 84 && unitName[1] === 111) {
              if (unitName[4] === 67 && unitName[5] === 97 && unitName.length === 17) cannonIDs[event['m_unitTagIndex']] = [event['m_x'],event['m_y']]
              else if (unitName[4] === 84 && unitName[5] === 111) townIDs[event['m_unitTagIndex']] = event['_gameloop']
            } else if (mapName===4 && HOTS.zerg.hasOwnProperty(unitName)) bornZerg.push([event.m_controlPlayerId-11,loopsToS(event._gameloop),HOTS.zerg[unitName],event.m_x,event.m_y])
            else if (mapName===5) { // team / time / x / y / is relocation
              unitName = unitName.toString()
              if (unitName==='BossDuelBossHeaven') bossFights.push([0,loopsToS(event['_gameloop']),event['m_x'],event['m_y'],0])
              else if (unitName==='BossDuelBossHell') bossFights.push([1,loopsToS(event['_gameloop']),event['m_x'],event['m_y'],0])
              else if (unitName==='ImmortalPingUnit') bossFights.push([event['m_upkeepPlayerId'],loopsToS(event['_gameloop']),event['m_x'],event['m_y'],1])
            } else if (mapName===6) {
              unitName = unitName.toString()
              if (unitName==='WarheadSingle') spawnedNukes.push([loopsToS(event['_gameloop']),event['m_x'],event['m_y']])
              else if (unitName==='NukeTargetMinimapIconUnit') targetedNukes.push([event['m_controlPlayerId']-1,loopsToS(event['_gameloop']),event['m_x'],event['m_y']])
              else if (unitName==='WarheadDropped') {
                let deathLoop = event['_gameloop']
                deathLoops.push(deathLoop)
                droppedNukes.push([null,loopsToS(deathLoop),event['m_x'],event['m_y']])
              }
            } else if (mapName===14) {
              unitName = unitName.toString()
              if (unitName==="PayloadDestinationMinimapIcon") payLoadSpawns.push([event.m_controlPlayerId-13,loopsToS(event._gameloop),event.m_x,event.m_y]) // team / time / x / y
              else if (unitName==="PayloadOrderPath1" || unitName==="PayloadOrderPath2") {
                pathDic[event.m_unitTagIndex] = [event._gameloop,0,payload]
                paths.push([0,payload,loopsToS(event._gameloop),event.m_x,event.m_y])
                payload += 1
              } else if (unitName==="PayloadChaosPath1" || unitName==="PayloadChaosPath1") {
                pathDic[event.m_unitTagIndex] = [event._gameloop,1,payload]
                paths.push([1,payload,loopsToS(event._gameloop),event.m_x,event.m_y])
                payload += 1
              }
            }
          } else if (id===2) {
            let tag = event['m_unitTagIndex']
            if (townIDs.hasOwnProperty(tag) && event._gameloop > townIDs[tag]) {
              deadTowns.push([loopsToS(event['_gameloop']),event['m_x'],event['m_y'],event['m_killerPlayerId']-1])
              delete townIDs[tag]
            } else if (cannonIDs.hasOwnProperty(tag) && !deadCannonIDs.includes(tag)) {
              deadCannons.push([event._gameloop,cannonIDs[tag][0],cannonIDs[tag][1]]) // time, x, y
              deadCannonIDs.push(tag)
            } else if (mapName===14) {
              if (pathDic.hasOwnProperty(tag)) {
                if (pathDic[tag][0] < event._gameloop && !deadPaths.includes(tag)) {
                  pathDeaths[pathDic[tag][2]] = [loopsToS(event._gameloop),event.m_x,event.m_y]
                  deadPaths.push(tag)
                }
              }
            }
          } else if (id===10) {
            let eventName = event.m_eventName
            if (!uniqueDic.hasOwnProperty(eventName)) uniqueDic[eventName] = []
            uniqueDic[eventName].push(event)
          } else if (id===11) scoreResultValues = event
          else if (id===14) pickOrder.push(event['m_controllingPlayer'])
        } else break
      }
      let nDeaths = uniqueDic.hasOwnProperty('PlayerDeath') ? uniqueDic['PlayerDeath'].length : 0
      let deaths = []
      for (let p=0;p<10;p++) deaths.push([])
      for (let d=0;d<nDeaths;d++) {
        let death = uniqueDic['PlayerDeath'][d]
        let deadGuy = death['m_intData'][0]['m_value'] - 1
        let deathLoop = death['_gameloop']
        let TOD = loopsToS(deathLoop)
        let dX = death['m_fixedData'][0]['m_value']/4096
        let dY = death['m_fixedData'][1]['m_value']/4096
        let killers = []
        for (let k=1;k<death['m_intData'].length;k++) killers.push(death['m_intData'][k]['m_value'] - 1)
        deaths[deadGuy].push([TOD,dX,dY,killers])
        if (mapName===6) {
          for (let p=0;p<deathLoops.length;p++) {
            let DL = deathLoops[p]
            let pX = droppedNukes[p][2]
            let pY = droppedNukes[p][3]
            if (Math.abs(DL-deathLoop) < 20 && Math.abs(dX-pX) < 2 && Math.abs(dY-pY) < 2) {
              droppedNukes[p][0] = deadGuy
              break
            }
          }
        }
      }

      let awards = [null,null,null,null,null,null,null,null,null,null]
      let scoreResults = {}
      if (scoreResultValues === undefined) {
        console.log("missing score results - replay incomplete")
        return resolve(3) // incomplete
      }
      for (let s=0;s<scoreResultValues.m_instanceList.length;s++) {
        let result = scoreResultValues.m_instanceList[s]
        let sNameArray = result.m_name
        let sName = sNameArray.toString()
        if (sNameArray[0] === 69 && sNameArray[1] === 110) {
          if (sName.includes('GivenToNonwinner')) continue // can't use this
          sName = sName.replace('Boolean','')
          for (let v=0;v<result.m_values.length;v++) {
            let value = result.m_values[v]
            if (value.length > 0 && value[0].m_value === 1) awards[v] = HOTS.awardN.hasOwnProperty(sName.slice(15)) ? HOTS.awardN[sName.slice(15)] : sName.slice(15)
          }
        } else scoreResults[sName] = result.m_values
      }
      let full = []
      if (build>=43571 && !uniqueDic.hasOwnProperty('EndOfGameTalentChoices')) return resolve(3)
      else if (build >=43571 && isNaN(mapName)) {
        let nickMap
        try {
          nickMap = uniqueDic['EndOfGameTalentChoices'][0]['m_stringData'][2]['m_value'].toString()
        } catch (e) {
          // console.log('Problem with nick map from map: ' + mapName + ' and game mode: ' + gameMode)
          return resolve(99)
        }
        if (nickMaps.hasOwnProperty(nickMap)) {
          mapName = nickMaps[nickMap]
          console.log('Found the map: ',mapName)
        }
      }
      if (build>=43571) {
        for (let p=0;p<10;p++) {
          if (isNaN(heroes[p])) {
            let nickHero = uniqueDic['EndOfGameTalentChoices'][p]['m_stringData'][0]['m_value'].toString()
            if (HOTS.nickDic.hasOwnProperty(nickHero)) {
              console.log(`heroDic missing {$heroes[p]}, but able to add it anyway (${HOTS.nickDic[nickHero]})`)
              heroes[p] = HOTS.nickDic[nickHero]
            } else {
              console.log("Missing a hero: ",heroes[p], ", and their nickname: ", nickHero, ", and the slug: ",atts.scopes[p+1][4002][0]['value'].toString())
              console.log("Region is", region)
            }
          }
        }
      }

      for (let p =0;p<10;p++) {
        full.push({})
        const level = parseInt(atts.scopes[p+1][4008][0]['value'].toString())
        full[p].Level = level
        full[p].Takedowns = scoreResults["Takedowns"][p][0]["m_value"]
        full[p].Deaths = scoreResults["Deaths"][p][0]["m_value"]
        full[p].TownKills = scoreResults["TownKills"][p][0]["m_value"]
        full[p].SoloKill = scoreResults["SoloKill"][p][0]["m_value"]
        full[p].Assists = scoreResults["Assists"][p][0]["m_value"]
        full[p].MetaExperience = scoreResults["MetaExperience"][p][0]["m_value"]
        full[p].TeamTakedowns = scoreResults["TeamTakedowns"][p][0]["m_value"]
        full[p].ExperienceContribution = scoreResults["ExperienceContribution"][p][0]["m_value"]
        full[p].Healing = scoreResults["Healing"][p][0]["m_value"]
        full[p].SiegeDamage = scoreResults["SiegeDamage"][p][0]["m_value"]
        full[p].StructureDamage = scoreResults["StructureDamage"][p][0]["m_value"]
        full[p].MinionDamage = scoreResults["MinionDamage"][p][0]["m_value"]
        full[p].HeroDamage = scoreResults["HeroDamage"][p][0]["m_value"]
        full[p].MercCampCaptures = scoreResults["MercCampCaptures"][p][0]["m_value"]
        full[p].WatchTowerCaptures = scoreResults["WatchTowerCaptures"][p][0]["m_value"]
        full[p].SelfHealing = scoreResults["SelfHealing"][p][0]["m_value"]
        full[p].TimeSpentDead = scoreResults["TimeSpentDead"][p][0]["m_value"]
        let ccTime = scoreResults["TimeCCdEnemyHeroes"][p][0]["m_value"]
        ccTime = ccTime > 10000 ? 0 : ccTime // there is a bug with this
        full[p].TimeCCdEnemyHeroes = ccTime
        full[p].CreepDamage = scoreResults["CreepDamage"][p][0]["m_value"]
        full[p].SummonDamage = scoreResults["SummonDamage"][p][0]["m_value"]
        full[p].DamageTaken = scoreResults["DamageTaken"][p][0]["m_value"]
        full[p].TierIDs = [null,null,null,null,null,null,null]
        full[p].TierTalents = [null,null,null,null,null,null,null]
        full[p].nPings = pings[p].length
        full[p].nChat = 0
        full[p].voteN = null
        full[p].votee = null
        full[p].nGlobes = 0
        for (let t=1;t<8;t++) full[p].TierIDs[t-1] = scoreResults["Tier" + t + "Talent"][p][0]["m_value"]
        full[p].silenced = initData ? initData['m_syncLobbyState']['m_lobbyState']['m_slots'][p]['m_hasSilencePenalty'] : false
        let tierTalents = [null,null,null,null,null,null,null]
        if (build>=43571) {
          if (!uniqueDic['EndOfGameTalentChoices']) return resolve(3)
          for (let t=3;t<uniqueDic['EndOfGameTalentChoices'][p]['m_stringData'].length;t++) tierTalents[t-3] = uniqueDic['EndOfGameTalentChoices'][p]['m_stringData'][t]['m_value']
        }
        for (let t=0;t<7;t++) full[p].TierTalents[t] = tierTalents[t] === null ? null : getTalentN(tierTalents[t].toString().toLowerCase(),p,t,HOTS)

        full[p].HighestKillStreak = null
        full[p].TeamfightDamageTaken = null
        full[p].TeamfightEscapesPerformed = null
        full[p].TimeSilencingEnemyHeroes = null
        full[p].ClutchHealsPerformed = null
        full[p].OutnumberedDeaths = null
        full[p].EscapesPerformed = null
        full[p].TimeStunningEnemyHeroes = null
        full[p].VengeancesPerformed = null
        full[p].TeamfightHeroDamage = null
        full[p].TimeRootingEnemyHeroes = null
        full[p].ProtectionGivenToAllies = null
        full[p].TimeOnFire = null

        if (build>=45228) {
          full[p].HighestKillStreak = scoreResults["HighestKillStreak"][p][0]["m_value"]
          if (build>=46158) {
            if (build >= 48760) {
              full[p].TeamfightDamageTaken = scoreResults["TeamfightDamageTaken"][p][0]["m_value"]
              full[p].TeamfightEscapesPerformed = scoreResults["TeamfightEscapesPerformed"][p][0]["m_value"]
              full[p].TimeSilencingEnemyHeroes = scoreResults["TimeSilencingEnemyHeroes"][p][0]["m_value"]
              full[p].ClutchHealsPerformed = scoreResults["ClutchHealsPerformed"][p][0]["m_value"]
              full[p].OutnumberedDeaths = scoreResults["OutnumberedDeaths"][p][0]["m_value"]
              full[p].EscapesPerformed = scoreResults["EscapesPerformed"][p][0]["m_value"]
              full[p].TimeStunningEnemyHeroes = scoreResults["TimeStunningEnemyHeroes"][p][0]["m_value"]
              full[p].VengeancesPerformed = scoreResults["VengeancesPerformed"][p][0]["m_value"]
              full[p].TeamfightHeroDamage = scoreResults["TeamfightHeroDamage"][p][0]["m_value"]
              full[p].TimeRootingEnemyHeroes = scoreResults["TimeRootingEnemyHeroes"][p][0]["m_value"]
              full[p].ProtectionGivenToAllies = scoreResults["ProtectionGivenToAllies"][p][0]["m_value"]
              if (build >=52860) full[p].TimeOnFire = scoreResults['OnFireTimeOnFire'][p][0]["m_value"]
            }
          }
        }
      }

      let campsN = [0,0]
      let camps = [[],[]]// Need to add back in camp dic from maps for this
      if (uniqueDic.hasOwnProperty('JungleCampCapture')) {
        for (let c=0;c<uniqueDic['JungleCampCapture'].length;c++) {
          let camp = uniqueDic['JungleCampCapture'][c]
          let team = camp['m_fixedData'][0]['m_value']/4096 - 1
          let seconds = loopsToS(camp['_gameloop'])
          let campID = camp['m_intData'][0]['m_value']
          campsN[team] += 1
          camps[team].push([seconds,campID])
        }
      }

      let voteNumber = 1
      if (uniqueDic.hasOwnProperty('EndOfGameUpVotesCollected')) {
        for (let v=0;v<uniqueDic['EndOfGameUpVotesCollected'].length;v++) {
          let vote = uniqueDic['EndOfGameUpVotesCollected'][v]['m_intData']
          let votee = vote[0]['m_value'] - 1
          let voter = vote[1]['m_value'] - 1
          full[votee].voteN = voteNumber
          voteNumber += 1
          full[voter].votee = votee
        }
      }

      let firstTo10 = [null,null]
      let fTo10Time
      let firstTo20 = [null,null]
      let fTo20Time
      let levels = [[],[]]
      let teamLevels = [0,0]
      for (let l=0;l<uniqueDic['LevelUp'].length;l++) {
        let lev = uniqueDic['LevelUp'][l]
        let curLev = lev['m_intData'][1]['m_value']
        let team = Math.floor(lev['m_intData'][0]['m_value']/6)
        let levTime = loopsToS(lev['_gameloop'])
        if (curLev===9) {
          if (firstTo10[0] === null) {
            firstTo10[0] = team
            fTo10Time = levTime
          } else firstTo10[1] = levTime-fTo10Time
        }
        if (curLev===19) {
          if (firstTo20[0] === null) {
            firstTo20[0] = team
            fTo20Time = levTime
          } else firstTo20[1] = levTime-fTo20Time
        }
        if (teamLevels[team]<curLev) {
          teamLevels[team] += 1
          levels[Math.floor(lev['m_intData'][0]['m_value']/6)].push(levTime)
        }
      }

      let regenGlobes = []
      for (let p=0;p<10;p++) regenGlobes.push([])
      if (uniqueDic.hasOwnProperty('RegenGlobePickedUp')) {
        for (let g=0;g<uniqueDic['RegenGlobePickedUp'].length;g++) {
          let globe = uniqueDic['RegenGlobePickedUp'][g]
          let trotter = globe['m_intData'][0]['m_value'] - 1
          let globeTime = loopsToS(globe['_gameloop'])
          regenGlobes[trotter].push(globeTime)
          full[trotter].nGlobes+=1
        }
      }

      let EXP = [[],[]]
      for (let x=0;x<uniqueDic['PeriodicXPBreakdown'].length;x++) {
        let specialEvent = uniqueDic['PeriodicXPBreakdown'][x]
        let team = specialEvent['m_intData'][0]['m_value']-1
        let seconds = loopsToS(specialEvent['_gameloop'])
        let minionXP = specialEvent['m_fixedData'][2]['m_value']/4096
        let creepXP = specialEvent['m_fixedData'][3]['m_value']/4096
        let structureXP = specialEvent['m_fixedData'][4]['m_value']/4096
        let heroXP = specialEvent['m_fixedData'][5]['m_value']/4096
        let trickleXP = specialEvent['m_fixedData'][6]['m_value']/4096
        EXP.push([seconds,team,minionXP,creepXP,structureXP,heroXP,trickleXP])
      }

      let mapStats = {}
      let mapObjectives = {}
      switch (mapName) {
        case 0: Tomb(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 1: Temple(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 2: Shrines(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 3: Hollow(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 4: Holdout(scoreResults,uniqueDic,mapStats,mapObjectives,bornZerg);break
        case 5: Battlefield(scoreResults,uniqueDic,mapStats,mapObjectives, bossFights);break
        case 6: Warhead(scoreResults,uniqueDic,mapStats,mapObjectives, spawnedNukes, targetedNukes, droppedNukes);break
        case 7: Garden(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 8: Doom(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 9: Shire(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 10: Bay(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 11: Cavern(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 12: Mines(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 13: City(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 14: Hanamura(scoreResults,uniqueDic,mapStats,mapObjectives,payLoadSpawns,paths,pathDeaths);break
        case 15: Outpost(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 16: Checkpoint(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 17: Foundry(scoreResults,uniqueDic,mapStats,mapObjectives, mechCaptures);break
        case 18: Industrial(scoreResults,uniqueDic,mapStats,mapObjectives);break
        case 19: Alterac(scoreResults,uniqueDic,mapStats,mapObjectives);break
        default: break
      }

      let heroMapStats = []
      for (let p=0;p<10;p++) heroMapStats.push({})
      let mapStatKeys = Object.keys(mapStats)
      for (let p=0;p<10;p++) for (let s=0;s<mapStatKeys.length;s++) heroMapStats[p][mapStatKeys[s]] = mapStats[mapStatKeys[s]][p]

      thisReplay['h'] = {}
      for (let p=0;p<10;p++) thisReplay['h'][p] = [heroes[p],p,Math.floor(p/5)===winners,heroNames[p],battleTags[p],awards[p],full[p].Deaths, full[p].TownKills,full[p].Takedowns, full[p].SoloKill,full[p].Assists,full[p].HighestKillStreak, full[p].Level, full[p].ExperienceContribution, full[p].HeroDamage, full[p].DamageTaken, full[p].StructureDamage, full[p].SiegeDamage, full[p].Healing, full[p].SelfHealing, full[p].TimeSpentDead, full[p].TimeCCdEnemyHeroes, full[p].CreepDamage, full[p].SummonDamage, full[p].MercCampCaptures, full[p].WatchTowerCaptures, full[p].MinionDamage, full[p].nGlobes, full[p].silenced, full[p].TierIDs[0], full[p].TierTalents[0], full[p].TierIDs[1], full[p].TierTalents[1], full[p].TierIDs[2], full[p].TierTalents[2], full[p].TierIDs[3], full[p].TierTalents[3], full[p].TierIDs[4], full[p].TierTalents[4], full[p].TierIDs[5], full[p].TierTalents[5], full[p].TierIDs[6], full[p].TierTalents[6], full[p].TeamfightDamageTaken, full[p].TeamfightEscapesPerformed, full[p].TimeSilencingEnemyHeroes, full[p].ClutchHealsPerformed, full[p].OutnumberedDeaths, full[p].EscapesPerformed, full[p].TimeStunningEnemyHeroes, full[p].VengeancesPerformed, full[p].TeamfightHeroDamage, full[p].TimeRootingEnemyHeroes, full[p].ProtectionGivenToAllies, full[p].TeamTakedowns, full[p].nPings, full[p].nChat,full[p].voteN, full[p].votee, full[p].TimeOnFire,heroMapStats[p]]

      let bans = [['null','null'],['null','null']]
      if ([2,3,4].includes(gameMode)) {
        if (!atts) atts = Protocol.decodeReplayAttributesEvents(archive.readFile('replay.attributes.events'))
        let ban00 = atts.scopes[16][4023][0]['value'].toString()
        if (HOTS.nickDic.hasOwnProperty(ban00)) bans[0][0] = HOTS.nickDic[ban00]
        else if (ban00) {
          console.log(ban00)
          return resolve(1)
        }
        let ban01 = atts.scopes[16][4025][0]['value'].toString()
        if (HOTS.nickDic.hasOwnProperty(ban01)) bans[0][1] = HOTS.nickDic[ban01]
        else if (ban01) {
          console.log(ban01)
          return resolve(1)
        }
        let ban10 = atts.scopes[16][4028][0]['value'].toString()
        if (HOTS.nickDic.hasOwnProperty(ban10)) bans[1][0] = HOTS.nickDic[ban10]
        else if (ban10) {
          console.log(ban10)
          return resolve(1)
        }
        let ban11 = atts.scopes[16][4030][0]['value'].toString()
        if (HOTS.nickDic.hasOwnProperty(ban11)) bans[1][1] = HOTS.nickDic[ban11]
        else if (ban11) {
          console.log(ban11)
          return resolve(1)
        }
      }
      thisReplay['b'] = bans
      thisReplay['e'] = {}
      thisReplay['e']['l'] = levels
      thisReplay['e']['t'] = deadTowns
      thisReplay['e']['j'] = camps
      thisReplay['e']['c'] = chats
      thisReplay['e']['x'] = EXP
      thisReplay['e']['o'] = mapObjectives
      thisReplay['e']['w'] = deadCannons
      thisReplay['e']['d'] = deaths
      thisReplay['e']['g'] = regenGlobes
      thisReplay['e']['tn'] = teamNumbers
      thisReplay['e']['po'] = pickOrder

      let firstFort = [null,null,null]
      if (deadTowns.length > 0) {
        let fFX = deadTowns[0][1]
        firstFort[0] = fFX > 126 ? 0 : 1 // X
        firstFort[1] = deadTowns[0][0] // Time
      }
      if (deadTowns.length > 1) {
        for (let t=1;t<deadTowns.length;t++) {
          if (((deadTowns[t][1] > 126 ? 0 : 1) !== firstFort[0]) || (deadTowns[t].slice(1,3)=== deadTowns[0].slice(1,3))) {
            firstFort[2] = deadTowns[t][0]-firstFort[1]
            break
          }
        }
      }
      thisReplay['r'] = [minSinceLaunch, build, region, gameLength, mapName, gameMode, firstTo10, firstTo20, firstFort,winners]
      thisReplay.hash = hashCode
      return resolve(thisReplay)
    } catch (err) {
      if (err.name!=="CorruptedError") console.log(err)
      return resolve(0)
    } // continue code
  })
  return promise
}

module.exports = { parseFile }
