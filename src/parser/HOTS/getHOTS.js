const HOTS = require('./HOTS.json')

function getHOTS(forceRefresh) {
  // returns HOTS asynchronously
  let promise = new Promise(async(resolve, reject) => {
    HOTS.nickDic = {}
    let nickKeys = Object.keys(HOTS.nickNames)
    for (let n=0;n<nickKeys.length;n++) {
      HOTS.nickDic[HOTS.nickNames[nickKeys[n]]] = parseInt(nickKeys[n])
    }
    HOTS.heroDic['布雷泽'] = 75
    HOTS.talentN = {
      // why are the devs messing around with already established talent names?
      'rehgarlightningshieldearthshield': 1029,
      'rehgarearthbindtotemearthgrasptotem': 1036,
      'rehgarearthbindtotemcolossaltotem': 1030,
      'rehgarwolfrun': 1037,
      'rehgarferalheart': 1025,
      'rehgarancestralhealing': 1038,
      'rehgarbloodandthunder': 1027,
      'rehgarancestralhealingfarseersblessing': 1039,
      'rehgarhealingtotem': 1018,
      'rehgarlightningshieldelectriccharge': 1020,
      'rehgarlightningshieldrisingstorm': 1033,
      'rehgarlightningshieldstormcaller': 1019,
      'rehgarbloodlust': 1026,
      'rehgarfarsight': 1024,
      "rehgargladiatorswarshout": 1032
    }
    var talentKeys = Object.keys(HOTS.nTalents)
    var nTal = talentKeys.length
    for (var t =0;t<nTal;t++) {
      let key = parseInt(talentKeys[t])
      HOTS.talentN[HOTS.nTalents[key]]=key
    }
    resolve(HOTS)
  })
  return promise
}

module.exports = getHOTS
