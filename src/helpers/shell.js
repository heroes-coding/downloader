const { exec } = require('child_process')

const heroesIsRunning = () => {
  let promise = new Promise(async(resolve, reject) => {
    exec('tasklist', function(err, stdout, stderr) {
      if (err) reject(err)
      else if (stdout.split("\n").filter(x => x.includes("HeroesOfTheStorm")).length) resolve(true)
      else resolve(false)
    })
  })
  return promise
}

const executeCommand = (command) => {
  console.log(`Carrying out: ${command}`)
  let promise = new Promise(async(resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        reject(error)
      }
      console.log(stdout)
      resolve(stdout)
    })
  })
  return promise
}
module.exports = {
  executeCommand,
  heroesIsRunning
}
