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
$ npm install cypress-msw-interceptor msw --save-dev
# or
$ yarn add cypress-msw-interceptor msw --dev
```

Then in `cypress/support/index.js` add:

```javascript
import 'cypress-msw-interceptor'
```

If you need to customize the
[MSW Worker start options](https://mswjs.io/docs/api/setup-worker/start). You
can do so like:

```javascript
import { setMswWorkerOptions }, 'cypress-msw-interceptor'

setMswWorkerOptions({ quiet: true, onUnhandledRequest: 'bypass' })
```

Next we need initialize msw. Follow the guide form
[MSW website](https://mswjs.io/docs/getting-started/integrate/browser).

You don't need to configure the worker or create handlers unless you want to use
it in your application too. The integration for `cypress-msw-interceptor` will
happen automatically by importing `cypress-msw-interceptor`.

Lastly, we need to set the `baseUrl` for Cypress so that Cypress starts at the
same address as the application so that the service worker can be registered
correctly.

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

This is very similar to `cy.route` except it uses MSW to mock the response. To
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
    'todos',
  )

  cy.visit('/')
  cy.waitForRequest('@todos')
  cy.findByText(/lord of the rings/i).should('be.visible')
})
```

A request can be aliased using the third or forth (depending if a mock is
provided) argument to `cy.interceptRequest`. The use `cy.waitForRequest` with
the `alias` with a preceding `@` to wait for that request to complete before
finding the text on the page. To learn more about Cypress aliases check out the
[Cypress Aliases Documentation](https://docs.cypress.io/guides/core-concepts/variables-and-aliases.html).

`cy.interceptRequest` will also work with the native `.as('alias')` chainable
from Cypress, but that will not show the pretty badge in the test runner if you
do. It's recommended that you use the third or forth argument so you get the
best debugging experience.

This can also be done with a request that isn't mocked. This is particularly
useful for end to end test:

```javascript
it("should be able to wait for a request to happen that isn't mocked before it checks for the text", () => {
  cy.interceptRequest(
    'GET',
    'https://jsonplaceholder.typicode.com/todos/1',
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
  'todos',
)
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
    'todos',
  )

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
cy.interceptRequest(
  'GET',
  'https://jsonplaceholder.typicode.com/todos/1',
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
    'todos',
  )

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
    'todos',
  )
  cy.findByRole('button', { name: /refetch/i }).click()
  cy.waitForRequest('@todos')
  cy.getRequestCalls('@todos').then(calls => {
    expect(calls).to.have.length(2)
  })
  cy.findByText(/the outsider/i).should('be.visible')
})
```

### GraphQL Query

MSW provides an easy way to mock GraphQL queries. To make the same API available
`cypress-msw-interceptor` has custom Cypress extensions to work with that API.

To mock a query with the name of `CoursesQuery`:

```javascript
cy.interceptQuery(
  'CoursesQuery',
  (req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.data({
        courses: [
          {
            userId: 1,
            id: 1,
            title: 'GET me some data',
            completed: false,
          },
        ],
      }),
    )
  },
  'courses',
)
cy.visit('/')

cy.findByRole('button', { name: /get graphql/i }).click()
cy.waitForQuery('@courses').then(({ response }) => {
  cy.getQueryCalls('@courses').then(calls => {
    expect(calls).to.have.length(1)
  })
  cy.findByText(new RegExp(response.body.data.courses[0].title, 'i')).should(
    'be.visible',
  )
})
```

This can also be done for a query that hasn't been mocked:

```javascript
cy.interceptQuery('CoursesQuery', 'courses')
cy.visit('/')

cy.findByRole('button', { name: /get graphql/i }).click()
cy.waitForQuery('@courses').then(({ response }) => {
  cy.getQueryCalls('@courses').then(calls => {
    expect(calls).to.have.length(1)
  })
  cy.findByText(new RegExp(response.body.data.courses[0].title, 'i')).should(
    'be.visible',
  )
})
```

### GraphQL Mutation

In a similar way to queries, there is an extension for GraphQL Mutations:

```javascript
cy.interceptMutation(
  'UpdateCourse',
  (req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.data({
        courses: [
          {
            userId: 1,
            id: 1,
            title: 'GET me some data',
            completed: false,
          },
        ],
      }),
    )
  },
  'updateCourse',
)
cy.visit('/')

cy.findByRole('button', { name: /mutate graphql/i }).click()
cy.waitForMutation('@updateCourse').then(({ response }) => {
  cy.getMutationCalls('@updateCourse').then(calls => {
    expect(calls).to.have.length(1)
  })
  cy.findByText(new RegExp(response.body.data.courses[0].title, 'i')).should(
    'be.visible',
  )
})
```

In a similar way, we can wait for requests that weren't mocked:

```javascript
cy.interceptMutation('UpdateCourse', 'updateCourse')
cy.visit('/')

cy.findByRole('button', { name: /mutate graphql/i }).click()
cy.waitForMutation('@updateCourse').then(({ response }) => {
  cy.getMutationCalls('@updateCourse').then(calls => {
    expect(calls).to.have.length(1)
  })
  cy.findByText(new RegExp(response.body.data.courses[0].title, 'i')).should(
    'be.visible',
  )
})
```

## Things I wish the Cypress plugin API would allow me to do

- Would be great if Cypress could host the service worker or serve static files.
  It would be nice not to have to put it in the `public` folder of the
  application.

## Contributing

To start the development environment run:

```shell
yarn install
yarn start
```

To run the Cypress tests run while the application is running in another
terminal:

```shell
yarn run cypress:open
```
