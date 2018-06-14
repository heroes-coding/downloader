const loopsToS = function(time) {
  return parseInt((time-608)/16)
}
function Tomb(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("GemsTurnedIn")) {
    mapStats[11] = []
    for (let p=0;p<10;p++) mapStats[11].push(scoreResults.GemsTurnedIn[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('SoulEatersSpawned')) {
    mapObjectives[0] = []
    for (let s=0;s<uniqueDic['SoulEatersSpawned'].length;s++) {
      let specialEvent = uniqueDic['SoulEatersSpawned'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_fixedData'][0]['m_value']/4096 - 1
      let spawnNumber = specialEvent['m_intData'][0]['m_value']
      let gemsRequired = specialEvent['m_intData'][1]['m_value']
      let gemsOther = specialEvent['m_intData'][2]['m_value']
      mapObjectives[0].push([time,team,spawnNumber,gemsRequired,gemsOther])
    }
  }
}
function Temple(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("TimeInTemple")) {
    mapStats[10] = []
    for (let p=0;p<10;p++) mapStats[10].push(scoreResults.TimeInTemple[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('SkyTempleShotsFired')) {
    mapObjectives[1] = []
    for (let s=0;s<uniqueDic['SkyTempleShotsFired'].length;s++) {
      let specialEvent = uniqueDic['SkyTempleShotsFired'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let damage = specialEvent['m_fixedData'][0]['m_value']/4096
      let number = specialEvent['m_intData'][0]['m_value']
      let temple = specialEvent['m_intData'][1]['m_value']
      let team = specialEvent['m_intData'][2]['m_value']-1
      mapObjectives[1].push([time,team,temple,number,damage])
    }
  }
  if (uniqueDic.hasOwnProperty('SkyTempleActivated')) {
    mapObjectives[2] = []
    for (let s=0;s<uniqueDic['SkyTempleActivated'].length;s++) {
      let specialEvent = uniqueDic['SkyTempleActivated'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let activationNum = specialEvent['m_intData'][0]['m_value']
      let temple = specialEvent['m_intData'][1]['m_value']
      mapObjectives[2].push([time,temple,activationNum])
    }
  }
  if (uniqueDic.hasOwnProperty('SkyTempleCaptured')) {
    mapObjectives[3] = []
    for (let s=0;s<uniqueDic['SkyTempleCaptured'].length;s++) {
      let specialEvent = uniqueDic['SkyTempleCaptured'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let templeNumber = specialEvent['m_intData'][0]['m_value']
      let temple = specialEvent['m_intData'][1]['m_value']
      let team = specialEvent['m_intData'][2]['m_value']-1
      mapObjectives[3].push([time,team,temple,templeNumber])
    }
  }
}
function Shrines(scoreResults,uniqueDic,mapStats,mapObjectives) {
  let punishersN = {'ArcaneShrine': 0, 'FrozenShrine' : 1, 'BombardShrine': 2}
  if (scoreResults.hasOwnProperty("DamageDoneToShrineMinions")) {
    mapStats[7] = []
    for (let p=0;p<10;p++) mapStats[7].push(scoreResults.DamageDoneToShrineMinions[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('Infernal Shrine Captured')) {
    mapObjectives[4] = []
    for (let s=0;s<uniqueDic['Infernal Shrine Captured'].length;s++) {
      let specialEvent = uniqueDic['Infernal Shrine Captured'][s]
      let time =loopsToS(specialEvent['_gameloop'])
      let shrineNumber = specialEvent['m_intData'][0]['m_value']
      let team = specialEvent['m_intData'][1]['m_value']-1
      let losingScore = specialEvent['m_intData'][3]['m_value']
      mapObjectives[4].push([time,team,shrineNumber,losingScore])
    }
  }

  if (uniqueDic.hasOwnProperty('Punisher Killed')) {
    mapObjectives[5] = []
    for (let s=0;s<uniqueDic['Punisher Killed'].length;s++) {
      let specialEvent = uniqueDic['Punisher Killed'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let siegeDam = specialEvent['m_fixedData'][0]['m_value']/4096
      let heroDam =specialEvent['m_fixedData'][1]['m_value']/4096
      let punNum = specialEvent['m_intData'][0]['m_value']
      let team = specialEvent['m_intData'][1]['m_value']-1
      let lifeSpan =specialEvent['m_intData'][2]['m_value']
      let punType = punishersN[specialEvent['m_stringData'][0]['m_value']]
      mapObjectives[5].push([time,team,punNum,punType,lifeSpan,siegeDam,heroDam])
    }
  }
}
function Hanamura(scoreResults,uniqueDic,mapStats,mapObjectives,payLoadSpawns,paths,pathDeaths) {
  if (scoreResults.hasOwnProperty("TimeOnPayload")) {
    mapStats[17] = []
    for (let p=0;p<10;p++) {
      let time = scoreResults.TimeOnPayload[p][0].m_value
      time = time > 1000000000 ? null : time // Nothing bigger than a billion, please =)
      mapStats[17].push(time)
    }
  }
  mapObjectives[23] = payLoadSpawns
  mapObjectives[24] = paths
  mapObjectives[25] = pathDeaths
}
function Hollow(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("RavenTributesCollected")) {
    mapStats[15] = []
    for (let p=0;p<10;p++) mapStats[15].push(scoreResults.RavenTributesCollected[p][0].m_value)
  }
  if (scoreResults.hasOwnProperty("CurseDamageDone")) {
    mapStats[9] = []
    for (let p=0;p<10;p++) mapStats[9].push(scoreResults.CurseDamageDone[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('TributeCollected')) {
    mapObjectives[6] = []
    for (let s=0;s<uniqueDic['TributeCollected'].length;s++) {
      let specialEvent = uniqueDic['TributeCollected'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_fixedData'][0]['m_value']/4096 -1
      let tributeNum = specialEvent['m_intData'][0]['m_value']
      mapObjectives[6].push([time,team,tributeNum])
    }
  }
  if (uniqueDic.hasOwnProperty('RavenCurseActivated')) {
    mapObjectives[7] = []
    for (let s=0;s<uniqueDic['RavenCurseActivated'].length;s++) {
      let specialEvent = uniqueDic['RavenCurseActivated'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_fixedData'][0]['m_value']/4096 -1
      let curseNum = specialEvent['m_intData'][0]['m_value']
      mapObjectives[7].push([time,team,curseNum])
    }
  }
}
function Holdout(scoreResults,uniqueDic,mapStats,mapObjectives, bornZerg) {
  if (scoreResults.hasOwnProperty("DamageDoneToZerg")) {
    mapStats[3] = []
    for (let p=0;p<10;p++) mapStats[3].push(scoreResults.DamageDoneToZerg[p][0].m_value)
  }
  mapObjectives[8] = bornZerg
}
function Battlefield(scoreResults,uniqueDic,mapStats,mapObjectives, bossFights) {
  if (scoreResults.hasOwnProperty("DamageDoneToImmortal")) {
    mapStats[5] = []
    for (let p=0;p<10;p++) mapStats[5].push(scoreResults.DamageDoneToImmortal[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('Boss Duel Started')) {
    mapObjectives[9] = []
    for (let s=0;s<uniqueDic['Boss Duel Started'].length;s++) {
      let specialEvent = uniqueDic['Boss Duel Started'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let duelNum = specialEvent['m_intData'][0]['m_value']
      mapObjectives[9].push([time,duelNum])
    }
  }
  mapObjectives[10] = bossFights
  if (uniqueDic.hasOwnProperty('Immortal Defeated')) {
    mapObjectives[11] = []
    for (let s=0;s<uniqueDic['Immortal Defeated'].length;s++) {
      let specialEvent = uniqueDic['Immortal Defeated'][s]
      let time =loopsToS(specialEvent['_gameloop'])
      let remPower = specialEvent['m_fixedData'][0]['m_value']/4096
      let immortalNum = specialEvent['m_intData'][0]['m_value']
      let team = specialEvent['m_intData'][1]['m_value']-1
      let fightDur = specialEvent['m_intData'][2]['m_value']
      mapObjectives[11].push([time,team,immortalNum,remPower,fightDur])
    }
  }
}
function Garden(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("GardensSeedsCollected")) {
    mapStats[1] = []
    for (let p=0;p<10;p++) mapStats[1].push(scoreResults.GardensSeedsCollected[p][0].m_value)
  }
  if (scoreResults.hasOwnProperty("GardensPlantDamage")) {
    mapStats[16] = []
    for (let p=0;p<10;p++) mapStats[16].push(scoreResults.GardensPlantDamage[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('GardenTerrorActivated')) {
    mapObjectives[12] = []
    for (let s=0;s<uniqueDic['GardenTerrorActivated'].length;s++) {
      let specialEvent = uniqueDic['GardenTerrorActivated'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let terrorNumber = specialEvent['m_fixedData'][0]['m_value']/4096
      let team = specialEvent['m_fixedData'][1]['m_value']/4096 - 1
      mapObjectives[12].push([time,terrorNumber,team])
    }
  }
}
function Doom(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("AltarDamageDone")) {
    mapStats[6] = []
    for (let p=0;p<10;p++) mapStats[6].push(scoreResults.AltarDamageDone[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('Altar Captured')) {
    mapObjectives[13] = []
    for (let s=0;s<uniqueDic['Altar Captured'].length;s++) {
      let specialEvent = uniqueDic['Altar Captured'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_intData'][0]['m_value']-1
      let shotsFired = specialEvent['m_intData'][1]['m_value']
      mapObjectives[13].push([time,team,shotsFired])
    }
  }
  if (uniqueDic.hasOwnProperty('Town Captured')) {
    mapObjectives[14] = []
    for (let s=0;s<uniqueDic['Town Captured'].length;s++) {
      let specialEvent = uniqueDic['Town Captured'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_intData'][0]['m_value']-11
      mapObjectives[14].push([time,team])
    }
  }
  if (uniqueDic.hasOwnProperty('Six Town Event Start')) {
    mapObjectives[15] = []
    for (let s=0;s<uniqueDic['Six Town Event Start'].length;s++) {
      let specialEvent = uniqueDic['Six Town Event Start'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_intData'][0]['m_value']-1
      mapObjectives[15].push([time,team])
    }
  }
  if (uniqueDic.hasOwnProperty('Six Town Event End')) {
    mapObjectives[16] = []
    for (let s=0;s<uniqueDic['Six Town Event End'].length;s++) {
      let specialEvent = uniqueDic['Six Town Event End'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_intData'][0]['m_value']-1
      mapObjectives[16].push([time,team])
    }
  }
}
function Shire(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("DragonNumberOfDragonCaptures")) {
    mapStats[14] = []
    for (let p=0;p<10;p++) mapStats[14].push(scoreResults.DragonNumberOfDragonCaptures[p][0].m_value)
  }
  if (scoreResults.hasOwnProperty("DragonShrinesCaptured")) {
    mapStats[4] = []
    for (let p=0;p<10;p++) mapStats[4].push(scoreResults.DragonShrinesCaptured[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('DragonKnightActivated')) {
    mapObjectives[17] = []
    for (let s=0;s<uniqueDic['DragonKnightActivated'].length;s++) {
      let specialEvent = uniqueDic['DragonKnightActivated'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_fixedData'][0]['m_value']/4096 -1
      let dragonNumber = specialEvent['m_intData'][0]['m_value']
      mapObjectives[17].push([time,dragonNumber,team])
    }
  }
}
function Bay(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("BlackheartDoubloonsCollected")) {
    mapStats[0] = []
    for (let p=0;p<10;p++) mapStats[0].push(scoreResults.BlackheartDoubloonsCollected[p][0].m_value)
  }
  if (scoreResults.hasOwnProperty("BlackheartDoubloonsTurnedIn")) {
    mapStats[8] = []
    for (let p=0;p<10;p++) mapStats[8].push(scoreResults.BlackheartDoubloonsTurnedIn[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('GhostShipCaptured')) {
    mapObjectives[18] = []
    for (let s=0;s<uniqueDic['GhostShipCaptured'].length;s++) {
      let specialEvent = uniqueDic['GhostShipCaptured'][s]
      let time = loopsToS(specialEvent['_gameloop'])
      let team = specialEvent['m_fixedData'][0]['m_value']/4096 - 1
      let turnInNum = specialEvent['m_intData'][0]['m_value']
      let coins = specialEvent['m_intData'][1]['m_value']
      let otherCoins = specialEvent['m_intData'][2] ? specialEvent['m_intData'][2]['m_value'] : 0
      mapObjectives[18].push([time,team,turnInNum,coins,otherCoins])
    }
  }
}
function Mines(scoreResults,uniqueDic,mapStats,mapObjectives) {
  if (scoreResults.hasOwnProperty("MinesSkullsCollected")) {
    mapStats[2] = []
    for (let p=0;p<10;p++) mapStats[2].push(scoreResults.MinesSkullsCollected[p][0].m_value)
  }
  if (uniqueDic.hasOwnProperty('GolemLanes')) mapObjectives[19] = [[uniqueDic['GolemLanes'][0]['m_intData'][0]['m_value']-1,1],[uniqueDic['GolemLanes'][0]['m_intData'][1]['m_value']-1,0]]
}
function Warhead(scoreResults,uniqueDic,mapStats,mapObjectives, spawnedNukes, targetedNukes, droppedNukes) {
  // Dropped = 13 // Launched = 12
  mapStats[12] = [0,0,0,0,0,0,0,0,0,0]
  mapStats[13] = [0,0,0,0,0,0,0,0,0,0]
  mapObjectives[20] = spawnedNukes
  mapObjectives[21] = targetedNukes
  mapObjectives[22] = droppedNukes
  for (let n=0;n<targetedNukes.length;n++) mapStats[12][targetedNukes[n][0]] += 1
  for (let n=0;n<droppedNukes.length;n++) mapStats[13][droppedNukes[n][0]] += 1
}
function Cavern() {}
function City() {}
function Outpost() {}
function Industrial() {}
function Checkpoint() {}
function Alterac() {}
function Foundry(mechCaptures, mapObjectives) { mapObjectives[26] = mechCaptures }

module.exports = { Alterac, Tomb, Temple, Shrines, Hanamura, Hollow, Holdout, Battlefield, Garden, Doom, Shire, Bay, Mines, Warhead, Cavern, City, Outpost, Industrial, Checkpoint, Foundry }
