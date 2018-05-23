import hashlib, tqdm, os, sys
""" Iterates through my compressed data at the appropriate file / unit size and gets rid of dupes.
Saves to other folder to be safe """


baseDir = sys.argv[2] if len(sys.argv) > 2 else '/stats/compressed/'
outDir = sys.argv[3] if len(sys.argv) > 3 else '/stats/compressedOut/'
nBytes = int(sys.argv[4]) if len(sys.argv) > 4 else 64


def hashBytes(b):
    m = hashlib.sha256()
    m.update(b)
    return m.digest()


files = os.listdir(baseDir)
for f in tqdm.tqdm(files):
    with open(os.path.join(baseDir,f),'rb') as fb:
        file = fb.read()
    nReps = int(len(file)/64)
    hashes = []
    bytesArray = []
    for i in range(0,nReps):
        repBytes = file[i*64:(i+1)*64]
        h = hashBytes(repBytes)
        if h in hashes:
            print("Found a dupe")
            continue
        else:
            hashes.append(h)
            bytesArray.append(repBytes)
    with open(os.path.join(outDir,f),'wb') as fb:
        fb.write(b"".join(bytesArray))
