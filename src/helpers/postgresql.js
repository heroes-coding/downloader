const { Pool } = require('pg')

const createDatabase = function(user,host,database,password) {
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
        return reject(e)
      }
      return resolve(result)
    })
    return promise
  }
  return {
    simpleQuery
  }
}

module.exports = {
  createDatabase
}
