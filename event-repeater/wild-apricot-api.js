const request = require('request-promise')
const fs = require('fs')
const util = require('util')
const chalk = require('chalk')
const _ = require('lodash')
const dateFns = require('date-fns')

module.exports = {
  accessToken: async function() {
    const token = this.token ? this.token : await this.authenticate()
    return token
  },

  authenticate: function(forceNewToken = false) {
    let accessToken
    return new Promise((resolve, reject) => {
      try {
        accessToken = fs.readFileSync('wa_access_token.txt', {
          encoding: 'utf8'
        })
      } catch (err) {
        accessToken = ''
      }

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
          function(err, res) {
            if (err) {
              reject(err)
            }
            var json = JSON.parse(res.body)
            if (json.error) {
              reject(json.error)
            }
            accessToken = json.access_token
            fs.writeFileSync('wa_access_token.txt', accessToken, {
              encoding: 'utf8'
            })
            this.token = accessToken
            resolve(accessToken)
          }
        )
      } else {
        this.token = accessToken
        resolve(accessToken)
      }
    })
  },

  getRepeatingEvents: async function() {
    // const token = await this.accessToken()
    // console.log('token', token)
    const options = {
      url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
      method: 'GET',
      qs: {
        // $filter: 'Tags in [repeats-weekly] AND IsUpcoming eq true',
        $filter: 'Tags in [repeats-weekly] AND StartDate gt 2018-04-01',
        includeEventDetails: true
      },
      auth: {
        bearer: await this.accessToken()
      },
      json: true
    }

    let events
    try {
      events = await request(options)
    } catch (error) {
      if (error.statusCode === 401) {
        // API key is out of date. Get a new one.
        if (error.error.reason === 'invalid_token') {
          return this.authenticate(true).then(this.getRepeatingEvents)
        }
      } else {
        console.error(error)
      }
    }

    return this.sortRepeatingEvents(events)
  },

  sortRepeatingEvents: function(data) {
    // console.log('events', util.inspect(data, { depth: 4 }))
    let events = {}
    data.Events.forEach(event => {
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
  },

  duplicateEvent: async function(event) {
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

    const options = {
      url: 'https://api.wildapricot.org/v2/Accounts/228337/Events',
      method: 'POST',
      auth: {
        bearer: await this.accessToken()
      },
      form: newEvent
    }
    return request(options)
  }
}
