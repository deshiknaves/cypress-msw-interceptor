describe('GraphQL', () => {
  function waitAndCheckAlias(name, alias) {
    cy.findByRole('button', { name }).click()
    cy.waitForRequest(`@${alias}`).then(({ response }) => {
      cy.getRequestCalls(`@${alias}`).then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.title, 'i')).should('be.visible')
    })
  }

  it.only('should be able to mock a request', () => {
    cy.interceptQuery('CoursesQuery', (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.data({
          userId: 1,
          id: 1,
          title: 'GET me some data',
          completed: false,
        }),
      )
    }).as('courses')
    cy.visit('/')

    cy.findByRole('button', { name: /get graphql/i }).click()

    cy.findByText(/get me some data/i).should('be.visible')
  })

  it('should be able to mock a mutation', () => {
    cy.interceptMutation('UpdateCourse', (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.data({
          userId: 1,
          id: 1,
          title: 'GET me some data',
          completed: false,
        }),
      )
    }).as('updateCourse')
    cy.visit('/')

    cy.findByRole('button', { name: /mutate graphql/i }).click()

    cy.findByText(/get me some data/i).should('be.visible')
  })
})
