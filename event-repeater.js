const fs = require('fs')
const request = require('request')
const _ = require('lodash')
const chalk = require('chalk')
const dateFns = require('date-fns')
require('dotenv').config()

let accessToken

function authenticateWildApricot (forceNewToken = false) {
  console.log('tryna authenticate wild apricot')
  return new Promise((resolve, reject) => {
    try {
      accessToken = fs.readFileSync('wa_access_token.txt', {
        encoding: 'utf8'
      })
    } catch (err) {
      accessToken = ''
    }

    console.log('accessToken', accessToken)
    if (!accessToken || forceNewToken) {
      request(
        {
          url: 'https://oauth.wildapricot.org/auth/token',
          method: 'POST',
          auth: {
            user: 'APIKEY',
            pass: process.env.WA_API_KEY
          },
          form: {
            grant_type: 'client_credentials',
            scope: 'auto'
          }
        },
        function (err, res) {
          if (err) {
            reject(err)
          }
          var json = JSON.parse(res.body)
          if (json.error) {
            reject(json.error)
          }
          console.log('json', json)
          console.log('Access Token:', json.access_token)
          accessToken = json.access_token
          fs.writeFileSync('wa_access_token.txt', accessToken, {
            encoding: 'utf8'
          })
          resolve(accessToken)
        }
      )
    } else {
      resolve(accessToken)
    }
  })
}

function getRepeatingEvents () {
  function sortRepeatingEvents (json) {
    // console.log('events', util.inspect(json, { depth: 4 }))
    let events = {}
    json.Events.forEach(event => {
      if (event.Tags.indexOf('canceled') === -1) {
        if (!events[event.Name]) {
          events[event.Name] = []
        }

        events[event.Name].push(event)
      }
    })

    for (let event in events) {
      // Sort events chronologically by start date
      events[event].sort(
        (a, b) => new Date(a.StartDate) - new Date(b.StartDate)
      )

      events[event] = events[event].pop()
    }

    console.log(chalk.cyan('Repeating events:'))
    console.log(chalk.yellow(_.map(events, event => event.Name).join('\n')))

    return events
  }

  return new Promise((resolve, reject) => {
    request(
      {
        url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
        method: 'GET',
        qs: {
          $filter: 'Tags in [repeats-weekly] AND IsUpcoming eq true',
          includeEventDetails: true
        },
        auth: {
          bearer: accessToken
        }
      },
      function (err, res, body) {
        if (err) {
          reject(err)
        }

        if (res.statusCode === 401) {
          // API key is out of date. Get a new one.
          authenticateWildApricot(true).then(getRepeatingEvents)
          resolve()
        } else {
          resolve(sortRepeatingEvents(JSON.parse(body)))
        }
      }
    )
  })
}

function duplicateEvent (event) {
  return new Promise((resolve, reject) => {
    console.log(chalk.yellow('duplicating event'), chalk.cyan(event.Name))

    console.log(chalk.green(event.StartDate), chalk.red(event.EndDate))

    const nextWeekStart = dateFns.addWeeks(event.StartDate, 1)
    const nextWeekEnd = dateFns.addWeeks(event.EndDate, 1)

    console.log(chalk.green(nextWeekStart), chalk.red(nextWeekEnd))

    let newEvent = event
    newEvent.StartDate = dateFns.format(nextWeekStart)
    newEvent.EndDate = dateFns.format(nextWeekEnd)

    console.log(chalk.cyan('Creating new event for ' + newEvent.StartDate))
    if (newEvent.sessions) {
      delete newEvent.sessions
    }

    newEvent = _.pick(newEvent, [
      'StartDate',
      'EndDate',
      'Location',
      'RegistrationEnabled',
      'RegistrationsLimit',
      'Tags',
      'Name',
      'Details'
    ])

    newEvent.StartTimeSpecified = true
    newEvent.EndTimeSpecified = true
    resolve()
    request(
      {
        url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
        method: 'POST',
        auth: {
          bearer: accessToken
        },
        form: newEvent
      },
      function (err, res, body) {
        if (err) {
          console.log('err', err)
          reject(err)
        }

        resolve(body)
      }
    )
  })
}

function createNewEvents (events) {
  let futureDate = new Date()
  futureDate = dateFns.addWeeks(futureDate, 6)

  let promises = []

  for (let key in events) {
    let event = events[key]

    console.log(`Checking ${chalk.yellow(event.Name)}...`)
    if (new Date(event.StartDate) < futureDate) {
      console.log(chalk.red('We need to copy this event!'), event.StartDate)
      promises.push(duplicateEvent(event))
    } else {
      console.log(
        chalk.green("We're doing fine on this event."),
        event.StartDate
      )
    }
  }

  return Promise.all(promises)
}

authenticateWildApricot()
  .then(getRepeatingEvents)
  .then(createNewEvents)
