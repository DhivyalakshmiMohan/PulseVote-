
import { useState } from 'react'
import './CreatePoll.css'

function CreatePoll() {
  // Store poll question
  const [question, setQuestion] = useState('')

  // Store poll options
  const [options, setOptions] = useState(['', ''])

  // Store created poll information
  const [createdPoll, setCreatedPoll] = useState(null)

  // Store loading status
  const [loading, setLoading] = useState(false)

  // Handle option input changes
  function handleOptionChange(index, value) {
    const updatedOptions = [...options]
    updatedOptions[index] = value
    setOptions(updatedOptions)
  }

  // Add a new option
  function addOption() {
    if (options.length >= 5) return

    setOptions([...options, ''])
  }

  // Remove an option
  function removeOption(index) {
    if (options.length <= 2) return

    setOptions(options.filter((_, i) => i !== index))
  }

  // Submit poll to Go backend
  async function handleSubmit(event) {
    event.preventDefault()

    const validOptions = options
      .map(option => option.trim())
      .filter(option => option !== '')

    if (!question.trim() || validOptions.length < 2) {
      alert('Enter a question and at least two options.')
      return
    }

    if (
      new Set(validOptions.map(option => option.toLowerCase())).size !==
      validOptions.length
    ) {
      alert('Please enter unique options.')
      return
    }

    try {
      setLoading(true)
      setCreatedPoll(null)

      const response = await fetch(
        'http://localhost:8080/api/polls',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            question: question.trim(),
            options: validOptions
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not create poll')
      }

      setCreatedPoll({
        question: question.trim(),
        options: validOptions,
        pollId: data.pollId
      })

      setQuestion('')
      setOptions(['', ''])

    } catch (error) {
      alert(error.message)
      console.error('Create poll error:', error)

    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-poll">

      <h1>Create your poll</h1>

      <p>Ask a question and collect opinions.</p>

      <form onSubmit={handleSubmit}>

        <label>Poll Question</label>

        <input
          type="text"
          placeholder="What do you want to ask?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />

        <label>Poll Options</label>

        {options.map((option, index) => (
          <div className="option-input" key={index}>

            <input
              type="text"
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(event) =>
                handleOptionChange(index, event.target.value)
              }
              required
            />

            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={options.length <= 2}
            >
              Remove
            </button>

          </div>
        ))}

        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= 5}
        >
          + Add option
        </button>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Poll...' : 'Launch Poll'}
        </button>

      </form>

      {/* Display created poll */}
      {createdPoll && (
        <div className="poll-preview">

          <h2>Poll created successfully!</h2>

          <h3>{createdPoll.question}</h3>

          {createdPoll.options.map((option, index) => (
            <p key={index}>{option}</p>
          ))}

          <p>
            <strong>Poll ID:</strong> {createdPoll.pollId}
          </p>

          <p>Your poll has been saved in MongoDB!</p>

          {/* Shareable poll link */}
          <div className="share-poll">

            <h3>Share your poll</h3>

            <a href={`/poll/${createdPoll.pollId}`}>
              Open your poll
            </a>

          </div>

        </div>
      )}

    </div>
  )
}

export default CreatePoll
