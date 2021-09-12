describe('GraphQL', () => {
  function waitAndCheckAlias(name, alias, type = 'Query') {
    cy.findByRole('button', { name }).click()
    cy.[`waitFor${type}`](`@${alias}`).then(({ response }) => {
      cy.[`get${type}Calls`](`@${alias}`).then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.data.courses[0].title, 'i')).should('be.visible')
    })
  }

  it('should be able to mock a query', () => {
    cy.interceptQuery('CoursesQuery', (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.data({
          courses: [{
            userId: 1,
            id: 1,
            title: 'GET me some data',
            completed: false,
          }]
        }),
      )
    }, 'courses')
    cy.visit('/')

    waitAndCheckAlias(/get graphql/i, 'courses', 'Query')
  })

  it('should be able to wait for a query that isn\'t mocked', () => {
    cy.interceptQuery('CoursesQuery', 'courses')
    cy.visit('/')

    cy.findByRole('button', { name: /get graphql/i }).click()

    waitAndCheckAlias(/get graphql/i, 'courses', 'Query')
  })

  it('should be able to mock a mutation', () => {
    cy.interceptMutation('UpdateCourse', (req, res, ctx) => {
      return res(
        ctx.delay(1000),
        ctx.data({
          courses: [{
            userId: 1,
            id: 1,
            title: 'GET me some data',
            completed: false,
          }]
        }),
      )
    }, 'updateCourse')
    cy.visit('/')

    waitAndCheckAlias(/mutate graphql/i, 'updateCourse', 'Mutation')
  })

  it('should be able to wait for a mutation that isn\'t mocked', () => {
    cy.interceptMutation('UpdateCourse', 'updateCourse')
    cy.visit('/')

    cy.findByRole('button', { name: /mutate graphql/i }).click()

    cy.waitForMutation('@updateCourse').then(({ response }) => {
      cy.getMutationCalls(`@updateCourse`).then(calls => {
        expect(calls).to.have.length(1)
      })
      cy.findByText(new RegExp(response.body.data.updateCourseTopic.description, 'i')).should('be.visible')
    })
  })
})
