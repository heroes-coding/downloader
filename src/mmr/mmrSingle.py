import sys, zmq, json
serverAddress = "tcp://*:5560"
from trueskill import Rating, rate, TrueSkill, setup
import mpmath
import math
setup(backend='mpmath')
cdf = TrueSkill(backend='mpmath').cdf
meanMMR = 4200
default_sigma = 525
def winProbability(a, b):
    BETA = default_sigma/2
    playerCount = len(a) + len(b)
    deltaMu = sum([x.mu for x in a]) - sum([x.mu for x in b])
    sumSigma = sum([x.sigma ** 2 for x in a]) + sum([x.sigma ** 2 for x in b])
    denominator = math.sqrt(playerCount * (BETA * BETA) + sumSigma)
    return cdf(deltaMu / denominator)


def runTests():
    players = [ [4500+i//5*100,default_sigma] for i in range(10)]
    won = 1
    result = getMMR(players,won)
    print ("\n","*"*50,"NORMAL:","*"*50,"\n\n",result,"\n")
    players[0] = [None,None]
    result = getMMR(players,won)
    print ("\n","*"*50,"One missing:","*"*50,"\n\n",result,"\n")
    players[1] = [None,None]
    result = getMMR(players,won)
    print ("\n","*"*50,"One each missing:","*"*50,"\n\n",result,"\n")
    players = [[None,None] for i in range(5)] + players[5:]
    result = getMMR(players,won)
    print ("\n","*"*50,"one team missing:","*"*50,"\n\n",result,"\n")
    players = [[None,None] for i in range(10)]
    result = getMMR(players,won)
    print ("\n","*"*50,"both teams missing:","*"*50,"\n\n",result,"\n")



def getMMR(players,won,gameMode, id):
    teamMMRs = [0,0]
    teamCounts = [0,0]
    toAverage = []
    users = []
    tempMMRs = {}
    for i,p in enumerate(players):
        team = i//5
        mmr, sigma = p
        if not mmr:
            toAverage.append(i)
        else:
            teamMMRs[team] += mmr
            teamCounts[team] += 1
    for t in range(2):
        if teamCounts[t]:
            teamMMRs[t] = teamMMRs[t]/teamCounts[t]
    for t in range(2):
        if not teamCounts[t] and not teamCounts[t-1]:
            toAverage = [] # rate nobody
            tempMMRS = {i:[meanMMR, default_sigma] for i in range(10)}
            continue
        elif not teamCounts[t]: # give average rating of other team if team is unrated
            otherTeamMMR = teamMMRs[1-t]
            teamMMRs[t] = otherTeamMMR
            for p in range(5):
                tempMMRs[p+t*5] = [meanMMR,default_sigma]
                if t*5 + p in toAverage:
                    toAverage.remove(t*5 + p)
                if (1-t)*5 + p in toAverage:
                    toAverage.remove((1-t)*5 + p)
                    tempMMRs[(1-t)*5+p] = [otherTeamMMR,default_sigma]
    teamSplit = teamMMRs[0]*5 - teamMMRs[1]*5
    if (len(toAverage)>0):
        pushFactor = teamSplit/len(toAverage)
    teamRatings = [[],[]]
    for p in range(10):
        if p in toAverage:
            calcMMR = min(max(teamMMRs[p//5] + pushFactor if p//5 == 1 else teamMMRs[p//5] - pushFactor,meanMMR-default_sigma),meanMMR+default_sigma)
            users.append([calcMMR,default_sigma])
        else:
            mmr, sigma = players[p]
            if mmr:
                users.append([mmr,sigma])
            else:
                users.append([meanMMR,default_sigma])
        teamRatings[p//5].append(Rating(mu=users[p][0],sigma=users[p][1]))
    team1Rank = 0 if won else 1 # 0 is better than 1
    team0Rank = 1 - team1Rank
    try:
        newRatings = rate([teamRatings[0], teamRatings[1]], ranks=[team0Rank, team1Rank])
    except:
        print(teamRatings[0],teamRatings[1],team0Rank,team1Rank)
        sys.exit()
    WP1 = winProbability(teamRatings[1],teamRatings[0])
    toSave = []
    for p in range(10):
        newMu = round(newRatings[p//5][p%5].mu)
        newSigma = round(newRatings[p//5][p%5].sigma)
        delta = round(newMu - teamRatings[p//5][p%5].mu)
        toSave.append([newMu,newSigma,delta])
    return [toSave,int(WP1*10000),gameMode, id]



context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind(serverAddress)
socket.setsockopt(zmq.RCVTIMEO, 100) # Timeout value of 0.1 secs
socket.setsockopt(zmq.LINGER, 0)
while True:
    try:
        received = socket.recv()
        req = json.loads(received.decode('utf-8'))
        if 'shutdown' in req:
            print("Received command to shutdown...")
            socket.send_string(json.dumps({"shutdown":True}))
            context.destroy()
            break
        results = getMMR(req['players'],req['won'],req['gameMode'],req['id'])
        socket.send_string(json.dumps(results))
    except BaseException as error:
        if not str(error) == 'Resource temporarily unavailable':
            socket.send_string(json.dumps({"error":str(error),"id":req['id'], "req":req}))
        continue


context.destroy()
