# -*- coding: utf-8 -*-
import os, json
with open('/stats/talentDic.json','r') as TD:
    talentDic = json.load(TD)

with open('/stats/HOTS.json', 'r') as HS:
    HOTS = json.load(HS)


HOTS['talentsN'] = {value:int(key) for key, value in HOTS['nTalents'].items()}
for build, bDic in talentDic.items():
    if build == 'builds':
        continue
    for hero, levs in bDic.items():
        for lev, tals in enumerate(levs):
            for bracket, tal in tals.items():
                if tal is None:
                    continue
                try:
                    tal = int(tal)
                except:
                    if tal in HOTS['talentsN']:
                        talentDic[build][hero][lev][bracket] = HOTS['talentsN'][tal]
                        print("ADDING TALENT:", hero, tal, HOTS['talentsN'][tal] )
                    elif tal in HOTS['rehgarDic']:
                        talentDic[build][hero][lev][bracket] = HOTS['rehgarDic'][tal]
                    else:
                        print("MISSING TALENT FOR:",hero,tal, talentDic[build][hero][lev][bracket])




with open('/stats/talentDic.json','w') as TD:
    json.dump(talentDic,TD)


talentBuilder = {"builds": talentDic["builds"]}
talentDic = {int(build) if not build == 'builds' else 'builds': data for build, data in talentDic.items()}
builds = sorted(list([k for k in talentDic.keys() if not k == 'builds']))
for build in builds:
    bDic = talentDic[build]
    buildN = talentDic['builds'][str(build)]
    for hero, levs in bDic.items():
        try:
            hero = int(hero)
        except:
            print("WTF?",hero)
            continue
        if not hero in talentBuilder:
            talentBuilder[hero] = [buildN, {}, {}, {}, {}, {}, {}, {} ]
        for lev, tals in enumerate(levs):
            for bracket, tal in tals.items():
                if tal is None or bracket == 'null':
                    continue
                bracket = int(bracket)
                if not bracket in talentBuilder[hero][lev+1]:
                    talentBuilder[hero][lev+1][bracket] = [[buildN, tal]]
                else:
                    if tal != talentBuilder[hero][lev+1][bracket][-1][1]:
                        talentBuilder[hero][lev+1][bracket].append([buildN,tal])

with open('/stats/talentBuilder.json','w') as TD:
    json.dump(talentBuilder,TD)
