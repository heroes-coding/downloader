const asleep = (sleepTime) => {
  let promise = new Promise(async(resolve, reject) => {
    setTimeout(() => { resolve(true) }, sleepTime)
  })
  return promise
}

exports.asleep = asleep
