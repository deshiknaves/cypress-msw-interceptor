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
response that was returned from a request:

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

### More to come

If you're reading this, I have a few more things to write up before I make an
alpha version available.
