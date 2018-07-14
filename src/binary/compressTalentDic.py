# -*- coding: utf-8 -*-
"""
Created on Fri Jul 13 16:54:05 2018

@author: Jeremy
"""

# -*- coding: utf-8 -*-
import os, json
basePath = 'F:/apiFiles/stats' if os.path.exists("C:/") else '/stats'
with open(os.path.join(basePath,'talentDic.json'),'r') as TD:
    talentDic = json.load(TD)

with open(os.path.join(basePath,'HOTS.json'), 'r') as HS:
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



"""
with open(os.path.join(basePath,'talentBuilder.json'),'r') as TD:
    tb = json.load(TD)
"""


if os.path.exists(os.path.join(basePath,"talentDicBU.json")):
    os.remove(os.path.join(basePath,"talentDicBU.json"))
os.rename(os.path.join(basePath,'talentDic.json'),os.path.join(basePath,"talentDicBU.json"))
with open(os.path.join(basePath,'talentDic.json'),'w') as TD:
    json.dump(talentDic,TD)


talentBuilder = {"builds": talentDic["builds"]}
talentDic = {int(build) if not build == 'builds' else 'builds': data for build, data in talentDic.items()}
builds = sorted(list([k for k in talentDic.keys() if not k == 'builds']))


curBuildCounts = {}
for build in builds:
    bDic = talentDic[build]
    buildN = talentDic['builds'][str(build)]
    for hero, levs in bDic.items():
        try:
            hero = int(hero)
        except:
            print("WTF?",hero)
            continue
        previous = None
        if not hero in talentBuilder:
            talentBuilder[hero] = [buildN, {}, {}, {}, {}, {}, {}, {}, {} ]
            curBuildCounts[hero] = [0,0,0,0,0,0,0]
        for lev, tals in enumerate(levs):
            nTals = len(tals)-1
            oTals = curBuildCounts[hero][lev]
            for bracket, tal in tals.items():
                if tal is None or bracket == 'null':
                    continue
                bracket = int(bracket)
                if not bracket in talentBuilder[hero][lev+1]:
                    talentBuilder[hero][lev+1][bracket] = [[buildN, tal]]
                else:
                    if tal != talentBuilder[hero][lev+1][bracket][-1][1] or bracket > oTals:
                        talentBuilder[hero][lev+1][bracket].append([buildN,tal])

            if oTals > nTals:
                if not buildN in talentBuilder[hero][8]:
                    talentBuilder[hero][8][buildN] = [[lev,oTals]]
                else:
                    talentBuilder[hero][8][buildN].append([lev,oTals])
                print (" hero: {} on build: {} level: {} too long, nTals: {}, previous Build Tals: {}".format(hero, build,lev, nTals,curBuildCounts[hero][lev] ))
            if nTals > curBuildCounts[hero][lev]:
                print(" missing: hero {}, lev: {}, build: {}".format(hero, lev, build))
            curBuildCounts[hero][lev] = nTals


if os.path.exists(os.path.join(basePath,"talentBuilderBU.json")):
    os.remove(os.path.join(basePath,"talentBuilderBU.json"))


if os.path.exists(os.path.join(basePath,'talentBuilder.json')):
    os.rename(os.path.join(basePath,'talentBuilder.json'),os.path.join(basePath,"talentBuilderBU.json"))


with open(os.path.join(basePath,'talentBuilder.json'),'w') as TD:
    json.dump(talentBuilder,TD)
