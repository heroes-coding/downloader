const { Pool } = require('pg')

const createDatabase = function(DB_CONFIG_PATH) {
  const { user, host, database, password } = require(DB_CONFIG_PATH)
  const pg = new Pool({
    user,
    host,
    database,
    password
  })
  const simpleQuery = function(query, values) {
    let promise = new Promise(async function(resolve, reject) {
      let result
      try {
        result = await pg.query(query, values)
      } catch (e) {
        console.log('problem with query: ', query, ', and values: ', values)
        return reject(e)
      }
      return resolve(result)
    })
    return promise
  }
  return {
    simpleQuery,
    pg
  }
}

module.exports = {
  createDatabase
}
