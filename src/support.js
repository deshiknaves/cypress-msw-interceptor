/// <reference types="cypress" />
require('cypress-wait-until')
const { setupWorker, rest, graphql } = require('msw')
const { match } = require('node-match-path')
const { last } = Cypress._

const REQUEST_TYPES = {
  DEFAULT: 'DEFAULT',
  QUERY: 'QUERY',
  MUTATION: 'MUTATION',
}

let worker
let requestTypes = {}
let requests = {}
let mutations = {}
let queries = {}
let routes = new Set()
let operations = new Set()
let requestMap = {}

function requestKey(request) {
  return Array.from(routes).find(i => {
    const [method, url] = i.split(/:(.+)/)
    const routeMatched = match(url, request.url)
    return request.method === method && routeMatched.matches
  })
}

function makeUniqueKey(request) {
  return `${request.method}:${request.url}`
}

function registerRequestType(requestId, type, operationName) {
  // Queries go though this twice
  if (requestTypes[requestId]) return
  requestTypes[requestId] = { type, operationName }
}

function registerRequest(request) {
  if (request?.body?.operationName) {
    registerQuery(request)
  }
  registerRequestType(request.id, REQUEST_TYPES.DEFAULT)
  const key = requestKey(request) || makeUniqueKey(request)
  if (!requests[key]) {
    requests[key] = { complete: false, calls: [] }
  }

  requests[key].complete = false
  requests[key].calls.push({ id: request.id, request, complete: false })
  requestMap[request.id] = key
}

function registerQuery(request) {
  const query = request.body.operationName
  registerRequestType(request.id, REQUEST_TYPES.QUERY, query)
  if (!queries[query]) {
    queries[query] = { complete: false, calls: [] }
  }
  queries[query].complete = false
  queries[query].calls.push({ id: request.id, request, complete: false })
}

async function completeRequest(response, requestId) {
  const type = requestTypes[requestId]
  if (type.type === REQUEST_TYPES.QUERY) {
    completeQuery(response, requestId)
    return
  }

  const body = await response.body
    .getReader()
    .read()
    .then(({ value }) => {
      const text = new TextDecoder('utf-8').decode(value)
      try {
        return JSON.parse(text)
      } catch (err) {
        return text
      }
    })

  const key = requestMap[requestId]
  if (!requests[key]) return
  requests[key].complete = true
  const call = requests[key].calls.find(i => i.id === requestId)
  if (!call) return
  Object.defineProperty(response, 'body', { writable: true })
  call.response = response
  call.complete = true
  call.response.body = body
}

async function completeQuery(response, requestId) {
  const body = await response.body
    .getReader()
    .read()
    .then(({ value }) => {
      const text = new TextDecoder('utf-8').decode(value)
      try {
        return JSON.parse(text)
      } catch (err) {
        return text
      }
    })

  const meta = requestTypes[requestId]
  if (!meta) return
  const query = meta.operationName
  if (!queries[query]) return
  queries[query].complete = true
  const call = queries[query].calls.find(i => i.id === requestId)
  if (!call) return
  Object.defineProperty(response, 'body', { writable: true })
  call.response = response
  call.complete = true
  call.response.body = body
}

before(() => {
  worker = setupWorker()
  worker.events.on('request:start', registerRequest)
  worker.events.on('response:mocked', completeRequest)
  worker.events.on('response:bypass', completeRequest)
  cy.wrap(worker.start(), { log: false })
})

Cypress.on('test:before:run', () => {
  if (!worker) return

  worker.resetHandlers()
  requests = {}
  requestMap = {}
  requestTypes = {}
  queries = {}
  routes = new Set()
  operations = new Set()
})

Cypress.on('window:before:load', win => {
  if (!worker) return

  win.msw = { worker, rest }
})

Cypress.Commands.add('waitForRequest', alias => {
  cy.get(alias).then(url => {
    Cypress.log({
      displayName: 'Waiting for request',
      message: `${alias} — ${url.replace(':', ' ')}`,
    })
    cy.waitUntil(() => requests[url] && requests[url].complete, {
      log: false,
    }).then(() => {
      cy.wrap(last(requests[url].calls), { log: false })
    })
  })
})

Cypress.Commands.add('waitForQuery', alias => {
  cy.get(alias).then(operationName => {
    Cypress.log({
      displayName: 'Waiting for query',
      message: `${alias} — ${operationName}`,
    })
    cy.waitUntil(
      () => queries[operationName] && queries[operationName].complete,
      {
        log: false,
      },
    ).then(() => {
      cy.wrap(last(queries[operationName].calls), { log: false })
    })
  })
})

Cypress.Commands.add('getRequestCalls', alias => {
  cy.get(alias, { log: false }).then(url => {
    return cy.wrap(requests[url].calls, { log: false })
  })
})

Cypress.Commands.add('interceptRequest', function mock(type, route, fn) {
  const method = type.toUpperCase()
  worker.use(
    rest[method.toLowerCase()](route, (req, res, ctx) => {
      function customResponse(...args) {
        const response = res(...args)
        Cypress.log({
          displayName: 'fetch [MSW]',
          message: `${method} ${req.url.href}`,
          consoleProps: () => ({
            method,
            url: req.url.href,
            request: req,
            response,
          }),
        })
        return response
      }

      if (!fn) return

      return fn(req, customResponse, ctx)
    }),
  )

  const key = `${method}:${route}`
  routes.add(key)
  return key
})

Cypress.Commands.add('interceptQuery', function mock(name, fn) {
  worker.use(
    graphql.query(name, (req, res, ctx) => {
      function customResponse(...args) {
        const response = res(...args)
        Cypress.log({
          displayName: 'query [MSW]',
          message: `${name} ${req.url.href}`,
          consoleProps: () => ({
            name,
            url: req.url.href,
            request: req,
            response,
          }),
        })
        return response
      }

      if (!fn) return

      return fn(req, customResponse, ctx)
    }),
  )

  operations.add(name)
  return name
})

Cypress.Commands.add('interceptMutation', function mock(name, fn) {
  worker.use(
    graphql.mutation(name, (req, res, ctx) => {
      function customResponse(...args) {
        const response = res(...args)
        Cypress.log({
          displayName: 'mutation [MSW]',
          message: `${name} ${req.url.href}`,
          consoleProps: () => ({
            name,
            url: req.url.href,
            request: req,
            response,
          }),
        })
        return response
      }

      if (!fn) return

      return fn(req, customResponse, ctx)
    }),
  )
})
