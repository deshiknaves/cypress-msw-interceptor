describe('REST', () => {
  function waitAndCheckAlias(name, alias) {
    cy.findByRole('button', { name }).click()
    cy.waitForRequest(`@${alias}`).then(({ response }) => {
      cy.getRequestCalls(`@${alias}`).then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  }

  it('should be able to mock a GET request', () => {
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
            title: 'GET me some data',
            completed: false,
          }),
        )
      },
    ).as('todo')

    waitAndCheckAlias(/^get$/i, 'todo')
  })

  it('should be able to mock a POST request', () => {
    cy.visit('/')
    cy.interceptRequest(
      'POST',
      'https://jsonplaceholder.typicode.com/todos',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'POST it',
            completed: false,
          }),
        )
      },
    ).as('postTodo')

    waitAndCheckAlias(/post/i, 'postTodo')
  })

  it('should be able to mock a PUT request', () => {
    cy.visit('/')
    cy.interceptRequest(
      'PUT',
      'https://jsonplaceholder.typicode.com/todos/1',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'PUT some sauce on it',
            completed: false,
          }),
        )
      },
    ).as('putTodo')

    waitAndCheckAlias(/put/i, 'putTodo')
  })

  it('should be able to mock a PATCH request', () => {
    cy.visit('/')
    cy.interceptRequest(
      'PATCH',
      'https://jsonplaceholder.typicode.com/todos/1',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'PATCH adams',
            completed: false,
          }),
        )
      },
    ).as('patchTodo')

    waitAndCheckAlias(/patch/i, 'patchTodo')
  })

  it('should be able to mock a DELETE request', () => {
    cy.visit('/')
    cy.interceptRequest(
      'DELETE',
      'https://jsonplaceholder.typicode.com/todos/1',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'DELETE me',
            completed: false,
          }),
        )
      },
    ).as('deleteTodo')

    waitAndCheckAlias(/delete/i, 'deleteTodo')
  })

  it('should be able to mock a OPTIONS request', () => {
    cy.visit('/')
    cy.interceptRequest(
      'OPTIONS',
      'https://jsonplaceholder.typicode.com/todos/1',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'what are my OPTIONS?',
            completed: false,
          }),
        )
      },
    ).as('options')

    waitAndCheckAlias(/options/i, 'options')
  })

  it('should be able to intercept a request if the mock has a lowercase method name', () => {
    cy.visit('/')
    cy.interceptRequest(
      'get',
      'https://jsonplaceholder.typicode.com/todos/1',
      (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.json({
            userId: 1,
            id: 1,
            title: 'GET me some data',
            completed: false,
          }),
        )
      },
    ).as('todo')

    waitAndCheckAlias(/^get$/i, 'todo')
  })
})
