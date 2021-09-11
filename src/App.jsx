import React, { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [error, setError] = useState()
  const [data, setData] = useState()

  useEffect(() => {
    getTodos()
  }, [])

  function getTodos() {
    fetch('https://jsonplaceholder.typicode.com/todos/1', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => response.json())
      .then(json => {
        setData(json)
      })
  }

  function fetchMethod(method, body, suffix) {
    fetch(`https://jsonplaceholder.typicode.com/todos${suffix || ''}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method,
      body: body && JSON.stringify(body),
    })
      .then(response => response.json())
      .then(json => {
        setData(json)
      })
  }

  function fetchError() {
    fetch('https://jsonplaceholder.typicode.com/fake').then(async response => {
      const json = await response.json()
      if (!response.ok) {
        setError(`Error: ${response.status}`)
        return
      }

      setData(json)
    })
  }

  return (
    <div className="App">
      {error && <p>{error}</p>}
      {data && <p>{JSON.stringify(data, null, 2)}</p>}
      <div>
        <button type="button" onClick={fetchError}>
          Error
        </button>
        <button type="button" onClick={getTodos}>
          Refetch
        </button>
        <button type="button" onClick={() => fetchMethod('GET')}>
          GET
        </button>
        <button
          type="button"
          onClick={() => fetchMethod('POST', { foo: 'bar' })}
        >
          POST
        </button>
        <button
          type="button"
          onClick={() => fetchMethod('PUT', { foo: 'bar' }, '/1')}
        >
          PUT
        </button>
        <button
          type="button"
          onClick={() => fetchMethod('PATCH', { foo: 'bar' }, '/1')}
        >
          PATCH
        </button>
        <button
          type="button"
          onClick={() => fetchMethod('DELETE', undefined, '/1')}
        >
          DELETE
        </button>
        <button
          type="button"
          onClick={() => fetchMethod('OPTIONS', { foo: 'bar' }, '/1')}
        >
          OPTIONS
        </button>
      </div>
    </div>
  )
}

export default App
