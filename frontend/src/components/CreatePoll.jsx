
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config'
import './CreatePoll.css'

function CreatePoll() {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  function handleOptionChange(index, value) {
    const updatedOptions = [...options]
    updatedOptions[index] = value
    setOptions(updatedOptions)
  }

  function addOption() {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  function removeOption(index) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const cleanQuestion = question.trim()
    const cleanOptions = options.map(option => option.trim())

    if (!cleanQuestion) {
      setError('Please enter a poll question.')
      return
    }

    if (cleanOptions.some(option => !option)) {
      setError('Please fill in every option.')
      return
    }

    const uniqueOptions = new Set(
      cleanOptions.map(option => option.toLowerCase())
    )

    if (uniqueOptions.size !== cleanOptions.length) {
      setError('Please enter unique options.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: cleanQuestion,
          options: cleanOptions,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not create poll.')
      }

      if (!data.pollId) {
        throw new Error('The backend did not return a poll ID.')
      }

      navigate(`/poll/${data.pollId}`)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="create-poll-page">
      <div className="create-poll-card">
        <h1>Ask. Vote. Watch it live.</h1>
        <p>Create a poll and share it with everyone.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="question">Your question</label>

          <input
            id="question"
            type="text"
            placeholder="e.g. Which programming language do you prefer?"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            maxLength={200}
          />

          <div className="options-heading">
            <label>Poll options</label>
            <span>{options.length}/5</span>
          </div>

          {options.map((option, index) => (
            <div className="option-input-row" key={index}>
              <input
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={event =>
                  handleOptionChange(index, event.target.value)
                }
                maxLength={100}
              />

              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  aria-label={`Remove option ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 5}
          >
            + Add option
          </button>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating poll...' : 'Create poll'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default CreatePoll
