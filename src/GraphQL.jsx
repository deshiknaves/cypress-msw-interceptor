import React, { useEffect, useState } from 'react'
import T from 'prop-types'
import { useQuery, useMutation } from 'urql'

const CoursesQuery = `
  query ($topic: String!) {
    courses(topic: $topic) {
      id
      title
    }
  }
`

const UpdateCourse = `
  mutation ($id: Int!, $topic: String!) {
    updateCourseTopic(id: $id, topic: $topic) {
      id
      author
      description
      topic
      url
    }
  }
`

export function GraphQL({ onData }) {
  const [enabled, setEnabled] = useState(false)
  const [result] = useQuery({
    query: CoursesQuery,
    pause: !enabled,
    variables: { topic: 'JavaScript' },
  })
  const [updateCourseResult, updateCourse] = useMutation(UpdateCourse)

  function handleClickCourses() {
    setEnabled(true)
  }

  const data = result.data || updateCourseResult.data || null

  useEffect(() => {
    if (!data) return
    onData(data)
  }, [data])

  return (
    <div>
      <h2>GraphQL</h2>
      <button type="button" onClick={handleClickCourses}>
        GET GRAPHQL
      </button>
      <button
        type="button"
        onClick={() => updateCourse({ id: 1, topic: 'JavaScript' })}
      >
        MUTATE GRAPHQL
      </button>
    </div>
  )
}

GraphQL.propTypes = {
  onData: T.func.isRequired,
}
