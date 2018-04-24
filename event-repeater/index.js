const WA = require('./wild-apricot-api')

const request = require('request')
const _ = require('lodash')
const chalk = require('chalk')
const dateFns = require('date-fns')
require('dotenv').config()
console.log('WA', WA)

function duplicateEvent(event) {}

function createNewEvents(events) {
  let futureDate = new Date()
  futureDate = dateFns.addWeeks(futureDate, 6)

  let promises = []

  for (let key in events) {
    let event = events[key]

    console.log(`Checking ${chalk.yellow(event.Name)}...`)
    if (new Date(event.StartDate) < futureDate) {
      console.log(chalk.red('We need to copy this event!'), event.StartDate)
      promises.push(WA.duplicateEvent(event))
    } else {
      console.log(
        chalk.green("We're doing fine on this event."),
        event.StartDate
      )
    }
  }

  return Promise.all(promises)
}

// console.log('WA.accessToken()', WA.accessToken())

WA.getRepeatingEvents().then(createNewEvents)
