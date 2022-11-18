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
  if (request.body && request.body.operationName) {
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
  const query = request.body && request.body.query
  if (query && query.match(/^mutation/i)) {
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
  if (type == undefined) return
  if (type.type === REQUEST_TYPES.QUERY) {
    completeQuery(response, requestId)
    return
  }

  if (type.type === REQUEST_TYPES.MUTATION) {
    completeMutation(response, requestId)
    return
  }

  completeRestRequest(response, requestId)
}

async function completeGenericRequest(
  response,
  requestId,
  requests,
  type,
  name,
) {
  const cloned = response.clone()

  const body = cloned.body ? await cloned.body
    .getReader()
    .read()
    .then(({ value }) => {
      const text = new TextDecoder('utf-8').decode(value)
      try {
        return JSON.parse(text)
      } catch (err) {
        return text
      }
    }) : undefined

  const meta = requestTypes[requestId]
  if (!meta) return
  let request
  const isREST = meta.type === REQUEST_TYPES.DEFAULT
  if (isREST) {
    request = requestMap[requestId]
  } else {
    request = meta[type]
  }
  if (!requests[request]) return
  requests[request].complete = true
  const call = requests[request].calls.find(i => i.id === requestId)
  if (!call) return
  Object.defineProperty(cloned, 'body', { writable: true })
  call.response = cloned
  call.complete = true
  call.response.body = body

  if (isREST && call.request.url.pathname.match(/\.\w+$/)) return

  Cypress.log({
    alias: aliases[meta.operationName],
    displayName: `[MSW] ${name}`,
    message: `${request}`,
    consoleProps: () => ({
      [type]: request,
      url: call.request.url,
      request: call.request,
      response,
    }),
  })
}

async function completeRestRequest(response, requestId) {
  return completeGenericRequest(
    response,
    requestId,
    requests,
    requestId,
    'Fetch',
  )
}

async function completeQuery(response, requestId) {
  return completeGenericRequest(
    response,
    requestId,
    queries,
    'operationName',
    'Query',
  )
}

async function completeMutation(response, requestId) {
  return completeGenericRequest(
    response,
    requestId,
    mutations,
    'operationName',
    'Mutation',
  )
}
const setupMSW = (workerOptions = {}) => {
  before(() => {
    worker = setupWorker()
    worker.events.on('request:start', registerRequest)
    worker.events.on('response:mocked', completeRequest)
    worker.events.on('response:bypass', completeRequest)
    console.info('starting server with workerOptions', workerOptions);
    cy.wrap(worker.start(workerOptions), { log: false })
  })
};

Cypress.on('test:before:run', () => {
  if (!worker) return

  worker.resetHandlers()
  requests = {}
  requestMap = {}
  requestTypes = {}
  queries = {}
  routes = new Set()
  aliases = {}
  mutations = {}
})

Cypress.on('window:before:load', win => {
  if (!worker) return

  win.msw = { worker, rest }
})

Cypress.Commands.add('waitForRequest', alias => {
  cy.get(alias, { log: false }).then(url => {
    Cypress.log({
      alias,
      displayName: 'Wait',
      name: 'wait',
      message: '',
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
      alias,
      displayName: 'Wait',
      name: 'wait',
      message: '',
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
      alias,
      displayName: 'Wait',
      name: 'wait',
      message: '',
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

module.exports = setupMSW;
