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
let requestMap = {}
let aliases = {}

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
    registerGraphQL(request)
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

function registerGraphQL(request) {
  if (request?.body?.query.match(/^mutation/i)) {
    registerMutation(request)
  }

  registerQuery(request)
}

function registerMutation(request) {
  const mutation = request.body.operationName
  registerRequestType(request.id, REQUEST_TYPES.MUTATION, mutation)
  if (!mutations[mutation]) {
    mutations[mutation] = { complete: false, calls: [] }
  }
  mutations[mutation].complete = false
  mutations[mutation].calls.push({ id: request.id, request, complete: false })
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

  if (type.type === REQUEST_TYPES.MUTATION) {
    completeMutation(response, requestId)
    return
  }

  const cloned = response.clone()

  const body = await cloned.body
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
  Object.defineProperty(cloned, 'body', { writable: true })
  call.response = cloned
  call.complete = true
  call.response.body = body

  if (call.request.url.pathname.match(/\.\w+$/)) return
  Cypress.log({
    alias: aliases[key],
    displayName: '[MSW] Fetch',
    message: `${key}`,
    consoleProps: () => ({
      key,
      url: call.request.url,
      request: call.request,
      response,
    }),
  })
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

  Cypress.log({
    alias: aliases[meta.operationName],
    displayName: '[MSW] Query',
    message: `${query}`,
    consoleProps: () => ({
      query,
      url: call.request.url,
      request: call.request,
      response,
    }),
  })
}

async function completeMutation(response, requestId) {
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
  const mutation = meta.operationName
  if (!mutations[mutation]) return
  mutations[mutation].complete = true
  const call = mutations[mutation].calls.find(i => i.id === requestId)
  if (!call) return
  Object.defineProperty(response, 'body', { writable: true })
  call.response = response
  call.complete = true
  call.response.body = body

  Cypress.log({
    alias: aliases[meta.operationName],
    displayName: '[MSW] Mutation',
    message: `${mutation}`,
    consoleProps: () => ({
      mutation,
      url: call.request.url,
      request: call.request,
      response,
    }),
  })
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
  aliases = {}
})

Cypress.on('window:before:load', win => {
  if (!worker) return

  win.msw = { worker, rest }
})

Cypress.Commands.add('waitForRequest', alias => {
  cy.get(alias, { log: false }).then(url => {
    Cypress.log({
      displayName: 'Wait',
      name: 'wait',
      message: `${alias}}`,
    })
    cy.waitUntil(() => requests[url] && requests[url].complete, {
      log: false,
    }).then(() => {
      cy.wrap(last(requests[url].calls), { log: false })
    })
  })
})

Cypress.Commands.add('waitForQuery', alias => {
  cy.get(alias, { log: false }).then(operationName => {
    Cypress.log({
      displayName: 'Wait',
      name: 'wait',
      message: `${alias}`,
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

Cypress.Commands.add('waitForMutation', alias => {
  cy.get(alias, { log: false }).then(operationName => {
    Cypress.log({
      displayName: 'Wait',
      message: `${alias}`,
    })
    cy.waitUntil(
      () => mutations[operationName] && mutations[operationName].complete,
      {
        log: false,
      },
    ).then(() => {
      cy.wrap(last(mutations[operationName].calls), { log: false })
    })
  })
})

function getCalls(type, alias) {
  cy.get(alias, { log: false }).then(name => {
    return cy.wrap(type[name].calls, { log: false })
  })
}

Cypress.Commands.add('getRequestCalls', alias => getCalls(requests, alias))

Cypress.Commands.add('getQueryCalls', alias => getCalls(queries, alias))

Cypress.Commands.add('getMutationCalls', alias => getCalls(mutations, alias))

function interceptHandler(req, res, ctx, fn) {
  function customResponse(...args) {
    const response = res(...args)
    return response
  }

  if (!fn) return

  return fn(req, customResponse, ctx)
}

function getInterceptArgs(...args) {
  let alias
  let fn

  args.forEach(arg => {
    if (Cypress._.isFunction(arg)) {
      fn = arg
    } else if (Cypress._.isString(arg)) {
      alias = arg
    }
  })

  return { alias, fn }
}

Cypress.Commands.add('interceptRequest', function mock(type, route, ...args) {
  const { alias, fn } = getInterceptArgs(...args)
  const method = type.toUpperCase()
  worker.use(
    rest[method.toLowerCase()](route, (req, res, ctx) => {
      return interceptHandler(req, res, ctx, fn)
    }),
  )

  const key = `${method}:${route}`
  routes.add(key)
  return setAlias(alias, key)
})

function setAlias(alias, value) {
  if (alias) {
    aliases[value] = alias
    return cy
      .wrap(value, { log: false })
      .as(alias)
      .then(() => value)
  }

  return value
}

Cypress.Commands.add('interceptQuery', function mock(name, ...args) {
  const { alias, fn } = getInterceptArgs(...args)
  worker.use(
    graphql.query(name, (req, res, ctx) => {
      return interceptHandler(req, res, ctx, fn)
    }),
  )

  return setAlias(alias, name)
})

Cypress.Commands.add('interceptMutation', function mock(name, ...args) {
  const { alias, fn } = getInterceptArgs(...args)
  worker.use(
    graphql.mutation(name, (req, res, ctx) => {
      return interceptHandler(req, res, ctx, fn)
    }),
  )

  return setAlias(alias, name)
})
