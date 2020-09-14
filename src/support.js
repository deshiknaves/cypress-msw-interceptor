/// <reference types="cypress" />
require('cypress-wait-until')
const { setupWorker, rest } = require('msw')
const { last } = Cypress._

let worker
let requests = {}

function requestKey(request) {
  return `${request.method}:${request.url}`
}

function registerRequest(request) {
  const key = requestKey(request)
  if (!requests[key]) {
    requests[key] = { complete: false, calls: [] }
  }

  requests[key].complete = false
  requests[key].calls.push({ id: request.id, request, complete: false })
}

function completeRequest(request, response) {
  const key = requestKey(request)
  if (!requests[key]) return
  requests[key].complete = true
  const call = requests[key].calls.find(i => i.id === request.id)
  if (!call) return
  call.response = response
  call.complete = true

  try {
    const body = JSON.parse(response.body)
    call.response.body = body
  } catch (err) {
    // Ignore and return the string
  }
}

before(() => {
  navigator.serviceWorker.addEventListener('message', message => {
    const event = JSON.parse(message.data)
    switch (event.type) {
      case 'REQUEST': {
        registerRequest(event.payload)
        break
      }
      case 'REQUEST_COMPLETE': {
        completeRequest(event.request, event.response)
        break
      }
    }
  })
  worker = setupWorker()
  cy.wrap(
    worker.start({
      serviceWorker: { url: '/cypress-msw-service-worker.js', shared: true },
    }),
    { log: false },
  )
})

Cypress.on('test:before:run', () => {
  if (!worker) return

  worker.resetHandlers()
  requests = {}
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

Cypress.Commands.add('interceptRequest', function mock(method, route, fn) {
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

  return `${method}:${route}`
})
