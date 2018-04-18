// Handles all interaction with postgres database

const getCurrentIndex = () => {
  return 42
}

const simpleQuery = async(qs, vs) => {
  let promise = new Promise(async(resolve, reject) => {
    resolve({'hi':'yo'})
  })
  return promise
}

const checkForPreviouslyDownloaded = async(files) => {
  let promise = new Promise(async(resolve, reject) => {
    let news = []
    let result, query, values
    for (let i=0;i<files.length;i++) {
      let file = files[i]
      const { id, filename } = file
      if (!id || !filename) {
        console.log("\n\n",file)
        console.log("\n\n^^^ Something wrong with api response that's not an error, full first result ^^^\n\n")
        return reject(new Error('Corrupt API Data'))
      }
      try {
        result = await simpleQuery(`SELECT * FROM hashes WHERE api_id = ${file.id}`)
      } catch (e) {
        return reject(e)
      }
      // already got it, can skip
      if (result.rowCount && result.rows[0].downloaded) continue
      query = `INSERT INTO hashes (api_id,api_hash,downloaded) VALUES ($1,$2,$3)`
      values = [id, filename, false]
      try {
        await simpleQuery(query,values)
      } catch (e) {
        return reject(e)
      }
      news.push({id, filename})
    }
    return resolve(news)
  })
  return promise
}

module.exports = {
  getCurrentIndex,
  checkForPreviouslyDownloaded
}
