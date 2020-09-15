# cypress-msw-interceptor

A networking layer for Cypress using MSW.

Both Cypress and MSW are amazing technologies, this plugin takes the features of
MSW and adapts its API to work with Cypress in a way that `cy.route` works.

This plugin will start a MSW worker as part of the Cypress runner and intercept
`fetch` requests made from the application being tested. MSW does not need to be
installed as part of application. This allows requests to be mocked using the
fantastic mocking ability of MSW and/or wait for requests to be completed before
continuing in a test.

## Installation

To install the package run:

```shell
$ npm install cypress-msw-interceptor --save-dev
# or
$ yarn add cypress-msw-interceptor --dev
```

Then in `cypress/support/index.js` add:

```javascript
import 'cypress-msw-interceptor'
```

Lastly we need to install the service worker.

```shell
$ npx cypress-msw-interceptor init <PUBLIC_DIR>
```

Replace the `<PUBLIC_DIR>` with the relative path to your application's public
directory. More on this from the
[MSW website](https://mswjs.io/docs/getting-started/integrate/browser).

**NOTE:** This is a prerelease and so it requires a modified version of the
service worker provided by MSW. I will be raising PRs to MSW so that these
features can be made available from the service worker provided out of the box
from MSW (more details on this later).

## Usage

All examples use
[@testing-library/cypress](https://github.com/testing-library/cypress-testing-library).
If you don't know it, check it out, it's the best way to write tests in Cypress
in my opinion.

### Basic Example

To intercept a request use the `cy.interceptRequest` command:

```javascript
it('should be able to mock a request with msw', () => {
  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
    (req, res, ctx) => {
      return res(
        ctx.json({
          userId: 1,
          id: 1,
          title: 'Lord of the rings',
          completed: false,
        }),
      )
    },
  )

  cy.visit('/')
  cy.findByText(/lord of the rings/i).should('be.visible')
})
```

This test will intercept a `GET` (method) request to
`https://jsonplaceholder.typicode.com/todos/1` (route) and respond with the
mocked payload returned from the response resolver.

This is very similar to `cy.route` expect it uses MSW to mock the response. To
learn more about the features of the response resolver, check out the
[MSW documentation](https://mswjs.io/docs/basics/response-resolver).

### Wait for a request

In Cypress to wait for a request to complete you would have to alias a request
and then use `cy.wait('@alias)`
([Cypress Route Documentation](https://docs.cypress.io/api/commands/route.html)).

`cypress-msw-interceptor` provides a similar API to achieve this:

```javascript
it('should be able to wait for a request to happen before it checks for the text', () => {
  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
    (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.json({
          userId: 1,
          id: 1,
          title: 'Lord of the rings',
          completed: false,
        }),
      )
    },
  ).as('todos')

  cy.visit('/')
  cy.waitForRequest('@todos')
  cy.findByText(/lord of the rings/i).should('be.visible')
})
```

A request can be aliased using the `as` chained function after defining a
`cy.interceptRequest` definition. The use `cy.waitForRequest` with the `alias`
with a preceding `@` to wait for that request to complete before finding the
text on the page. To learn more about Cypress aliases check out the
[Cypress Aliases Documentation](https://docs.cypress.io/guides/core-concepts/variables-and-aliases.html).

This can also be done with a request that isn't mocked. This is particularly
useful for end to end test:

```javascript
it("should be able to wait for a request to happen that isn't mocked before it checks for the text", () => {
  cy.interceptRequest('GET', 'https://jsonplaceholder.typicode.com/todos/1').as(
    'todos',
  )
  cy.visit('/')

  cy.waitForRequest('@todos')
  cy.findByText(/some known text value/i).should('be.visible')
})
```

By not providing a response resolver, the request executed as it normally but
will allow `cypress-msw-interceptor` to track the request and wait for the
alias.

You could conditionally include the response resolver so the test sometimes runs
as an integration test and sometimes as an end to end test:

```javascript
function shouldMockResponse(fn) {
  return process.env.CYPRESS_E2E === 'true' ? fn : undefined
}

cy.interceptRequest(
  'GET',
  'https://jsonplaceholder.typicode.com/todos/1',
  shouldMockResponse((req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.json({
        userId: 1,
        id: 1,
        title: 'Lord of the rings',
        completed: false,
      }),
    )
  }),
).as('todos')
```

This way, you could choose to run some tests end to end in some environments and
not others.

### Getting the response

In order to be able to run a test both as integration and end to end, it's
important to be able to add assertions in your tests that are derived from the
`response`:

```javascript
it('should be able to get the response and check that the correct text is displayed', () => {
  cy.visit('/')
  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
    (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.json({
          userId: 1,
          id: 1,
          title: 'Lord of the rings',
          completed: false,
        }),
      )
    },
  ).as('todos')

  cy.waitForRequest('@todos').then(({ request, response }) => {
    cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
  })
})
```

In the example above, `cy.waitForRequest` will wait for the request to complete
and then return the `request` and the `response` which can be used in the
assertion.

### Asserting the number of requests

Sometimes it's important to know how many times a request was made. This can be
checked by using the `cy.getRequestCalls`:

```javascript
cy.visit('/')
cy.interceptRequest('GET', 'https://jsonplaceholder.typicode.com/todos/1').as(
  'todos',
)

cy.waitForRequest('@todos').then(({ request, response }) => {
  cy.getRequestCalls('@todos').then(calls => {
    expect(calls).to.have.length(1)
  })
})
```

### Updating a mock

Sometimes the same request should respond with different values.
`cypress-msw-interceptor` allows you to update a request by redefining an
interceptor definition:

```javascript
it('should be able to update the mock', () => {
  cy.visit('/')
  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
    (req, res, ctx) => {
      return res(
        ctx.json({
          userId: 1,
          id: 1,
          title: 'Lord of the rings',
          completed: false,
        }),
      )
    },
  ).as('todos')

  cy.waitForRequest('@todos')
  cy.getRequestCalls('@todos').then(calls => {
    expect(calls).to.have.length(1)
  })
  cy.findByText(/lord of the rings/i).should('be.visible')

  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
    (req, res, ctx) => {
      return res(
        ctx.json({
          userId: 1,
          id: 1,
          title: 'The outsider',
          completed: false,
        }),
      )
    },
  ).as('todos')
  cy.findByRole('button', { name: /refetch/i }).click()
  cy.waitForRequest('@todos')
  cy.getRequestCalls('@todos').then(calls => {
    expect(calls).to.have.length(2)
  })
  cy.findByText(/the outsider/i).should('be.visible')
})
```

## MSW Service Worker

To make this work, there 2 modifications that had to be made to the MSW service
worker. These are:

1. Add the ability for the `client` in Cypress to be able to provide the mocks
   for the `client` in the application being tested (shared client).
2. Add the ability for the service worker to be able to notify
   `cypress-msw-interceptor` when a request is complete.

At this point in time, this is done my having a copy of the service worker from
MSW with these modifications. However, the intention is to raise some PRs and
hopefully, will get included out of the box. The current implementation is just
a stop gap till it is possible to do without a copy.

### Shared Client

Every application has their own `clientId` and MSW checks if mocks have been
enabled for the `client` before intercepting the fetch requests. In this
scenario that doesn't work, as we want the Cypress test runner to be able to
define and intercept the mocks. To that end, I have modified the service worker
to keep track of the `clientId` of the "shared" client and check that when
making requests from the actual application.

I have create a [draft PR](https://github.com/mswjs/msw/pull/383) that adds the
ability to start the worker (`worker.start`) with an option to run it in a
"shared" mode. The reason why this is still a draft is that I'd like some input
from the maintainers — there might be better ways to do this.

### Notify on completion

In order to wait for `aliases` there needs to be a mechanism for the service
worker to be able to notify when a request starts and when it is complete. Out
of the box, there is a `message` (`REQUEST`) that can be emitted using
`postMessage`. This has almost all the information needed. I've added a unique
id to the request, so that we can track it.

When a request is complete (mocked or unmocked), MSW needs to notify
`cypress-msw-interceptor` that a request was complete. I have added a new
`message` (`REQUEST_COMPLETE`) which provides all the context that is required.

I haven't raised a PR yet, but will in the next day or so — been busy proving
that this can be done.

## Things remaining

This is an alpha release and is rough around the edges. In the next while, I
will complete some of these missing elements:

- Currently, this only works with the `REST` api. This is only because it's
  where I started. I don't forsee any reason why this won't translate to
  `GraphQL`. Just needs time and testing.
- Typescript definitions for the commands.
- See what happens when both the application and Cypress provide a service
  worker from MSW. I suggest not including the one in the application while
  testing in Cypress — maybe though an environment variable.

## Things I wish the Cypress plugin API would allow me to do

- I wish there was a way to add `aliases` in a pill on the right side as
  `cy.request` does. `Cypress.log` doesn't have a lot of options. Some messages
  would be better unnested. However, these are purely cosmetic — I am a frontend
  developer, I want it to be perfect.
- Would be great if Cypress could host the service worker or serve static files.
  It would be nice not to have to put it in the `public` folder of the
  application.

## Contributing

To start the development environment run:

```shell
$ yarn install
$ yarn start
```

To run the Cypress tests run while the application is running in another
terminal:

```shell
$ yarn run cypress:open
```
