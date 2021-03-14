/// <reference types="cypress" />
require('cypress-wait-until')
const { setupWorker, rest } = require('msw')
const { match } = require('node-match-path')
const { last } = Cypress._

let worker
let requests = {}
let routes = new Set()
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

function registerRequest(request) {
  const key = requestKey(request) || makeUniqueKey(request)
  if (!requests[key]) {
    requests[key] = { complete: false, calls: [] }
  }

  requests[key].complete = false
  requests[key].calls.push({ id: request.id, request, complete: false })
  requestMap[request.id] = key
}

async function completeRequest(response, requestId) {
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

before(() => {
  worker = setupWorker()
  worker.on('request:start', registerRequest)
  worker.on('response:mocked', completeRequest)
  worker.on('response:bypass', completeRequest)
  cy.wrap(worker.start(), { log: false }).then(() => {
    console.warn(
      'Please disregard the above warning. cypress-msw-interceptor uses a patched version on MSW Service Worker to enable request interception',
    )
  })
})

Cypress.on('test:before:run', () => {
  if (!worker) return

  worker.resetHandlers()
  requests = {}
  requestMap = {}
  routes = new Set()
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
