describe('MSW Requests', () => {
  it("should be able to wait for a request to happen that isn't mocked before it checks for the text", () => {
    cy.interceptRequest(
      'GET',
      'https://jsonplaceholder.typicode.com/todos/1',
      'todos',
    )
    cy.visit('/')

    cy.findByRole('button', { name: /refetch/i }).click()
    cy.waitForRequest('@todos').then(({ response }) => {
      cy.getRequestCalls('@todos').then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  })

  it("should be able to wait for a request to happen that isn't mocked and has a matched path before it checks for the text", () => {
    cy.interceptRequest(
      'GET',
      'https://jsonplaceholder.typicode.com/todos/:id',
      'todos',
    )
    cy.visit('/')

    cy.findByRole('button', { name: /refetch/i }).click()
    cy.waitForRequest('@todos').then(({ response }) => {
      cy.getRequestCalls('@todos').then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  })

  it('should be able to wait for a request to happen before it checks for the text', () => {
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

    cy.findByRole('button', { name: /refetch/i }).click()
    cy.waitForRequest('@todos').then(({ response }) => {
      cy.getRequestCalls('@todos').then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  })

  it('should be able to wait for a matched request to happen before it checks for the text', () => {
    cy.visit('/')
    cy.interceptRequest(
      'GET',
      'https://jsonplaceholder.typicode.com/todos/:id',
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

    cy.findByRole('button', { name: /refetch/i }).click()
    cy.waitForRequest('@todos').then(({ response }) => {
      cy.getRequestCalls('@todos').then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  })

  it('should be able to mock a different response', () => {
    cy.visit('/')
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
    )
    cy.findByRole('button', { name: /refetch/i }).click()
    cy.findByText(/the outsider/i).should('be.visible')
  })

  it('should be able to return an error state', () => {
    cy.visit('/')
    cy.interceptRequest(
      'GET',
      'https://jsonplaceholder.typicode.com/fake',
      'fake',
    )
    cy.findByRole('button', { name: /error/i }).click()
    cy.waitForRequest('@fake').then(({ response }) => {
      cy.getRequestCalls('@fake').then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(`error: ${response.status}`, 'i')).should(
        'be.visible',
      )
    })
  })

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

    cy.findByRole('button', { name: /refetch/i }).click()
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
  it('should be able to mock a response with no data', () => {
    cy.visit('/');
    cy.interceptRequest(
      'GET',
      'https://jsonplaceholder.typicode.com/nocontent',
      (req, res, ctx) => res(ctx.status(204)),
      'noContent',
    )
    cy.findByRole('button', { name: /no content/i }).click()
    cy.waitForRequest('@noContent')
    cy.getRequestCalls('@noContent').then(calls => {
      expect(calls).to.have.length(1)
    })
    cy.findByText(/204/i).should('be.visible')
  })
})
