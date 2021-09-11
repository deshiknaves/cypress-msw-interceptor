describe('GraphQL', () => {
  function waitAndCheckAlias(name, alias, type = 'Query') {
    cy.findByRole('button', { name }).click()
    cy.[`waitFor${type}`](`@${alias}`).then(({ response }) => {
      cy.[`get${type}Calls`](`@${alias}`).then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.data.title, 'i')).should('be.visible')
    })
  }

  it('should be able to mock a request', () => {
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

    waitAndCheckAlias(/get graphql/i, 'courses', 'Query')
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

    waitAndCheckAlias(/mutate graphql/i, 'updateCourse', 'Mutation')
  })
})
