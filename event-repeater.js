const request = require('request')
// const util = require('util')
const _ = require('lodash')
const chalk = require('chalk')
const addWeeks = require('date-fns/add_weeks')

let accessToken

function addDays (date, days) {
  let d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function authenticateWildApricot () {
  console.log('tryna authenticate wild apricot')
  return new Promise((resolve, reject) => {
    request({
      url: 'https://oauth.wildapricot.org/auth/token',
      method: 'POST',
      auth: {
        user: 'APIKEY',
        pass: 'cw6rtunm0bdpguvmvxrezqvjn53dua'
      },
      form: {
        'grant_type': 'client_credentials',
        scope: 'auto'
      }
    }, function (err, res) {
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
      resolve(accessToken)
    })
  })
}

function getRepeatingEvents () {
  return new Promise((resolve, reject) => {
    request({
      url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
      method: 'GET',
      qs: {
        '$filter': 'Tags in [repeats-weekly] AND IsUpcoming eq true',
        includeEventDetails: true
      },
      auth: {
        bearer: accessToken
      }
    }, function (err, res, body) {
      if (err) {
        reject(err)
      }

      let json = JSON.parse(body)
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
        events[event]
          .sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate))

        events[event] = events[event].pop()
      }

      console.log(chalk.cyan('Repeating events:'))
      console.log(chalk.yellow(_.map(events, event => event.Name).join('\n')))
      resolve(events)
    })
  })
}

function duplicateEvent (event) {
  return new Promise((resolve, reject) => {
    // console.log('duplicating event', event)
    let newEvent = event
    let startDate = new Date(event.StartDate)
    // newEvent.StartDate = addDays(newEvent.StartDate, 7)
    newEvent.EndDate = addDays(newEvent.EndDate, 7)
    newEvent.StartDate = new Date(newEvent.EndDate)
    newEvent.StartDate.setHours(startDate.getHours())
    newEvent.StartDate.setMinutes(startDate.getMinutes())
    // newStartDate.setDate(new Date(newEvent.EndDate).getDate())
    // newEvent.StartDate = newStartDate
    // console.log('newEvent.StartDate, newEvent.EndDate', newEvent.StartDate, newEvent.EndDate)
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
    // console.log('newEvent', newEvent)
    request({
      url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
      method: 'POST',
      auth: {
        bearer: accessToken
      },
      form: newEvent
    }, function (err, res, body) {
      // console.log('res.statusCode, res.statusMessage', res.statusCode, res.statusMessage)
      if (err) {
        console.log('err', err)
        reject(err)
      }

      // console.log('body', body)
      resolve(body)
    })
  })
}

function createNewEvents (events) {
  let futureDate = new Date()
	futureDate = addWeeks(futureDate, 6)
  // futureDate.setMonth(futureDate.getMonth() + 2)
  // console.log('futureDate', futureDate)

  let promises = []

  for (let key in events) {
    let event = events[key]
    // console.log('event', event)

    console.log(`Checking ${chalk.yellow(event.Name)}...`)
    if (new Date(event.StartDate) < futureDate) {
      console.log(chalk.red('We need to copy this event!'), event.StartDate)
      promises.push(duplicateEvent(event))
    } else {
      console.log(chalk.green('We\'re doing fine on this event.'), event.StartDate)
    }
  }

  return Promise.all(promises)
}

authenticateWildApricot()
  .then(getRepeatingEvents)
  .then(createNewEvents)
