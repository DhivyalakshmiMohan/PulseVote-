
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import './PollPage.css'

function PollPage() {
  const { id } = useParams()

  const [poll, setPoll] = useState(null)
  const [selectedOption, setSelectedOption] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [voting, setVoting] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)

  // Temporary voter ID for development only.
  const [voterId] = useState(() => {
    let savedId = localStorage.getItem('pulsevote_voter_id')

    if (!savedId) {
      savedId = crypto.randomUUID()
      localStorage.setItem('pulsevote_voter_id', savedId)
    }

    return savedId
  })

  // Fetch initial poll and establish WebSocket connection.
  useEffect(() => {
    let active = true

    async function fetchPoll() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `http://localhost:8080/api/polls/${id}`
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Could not load poll')
        }

        if (active) {
          setPoll(data)
        }
      } catch (err) {
        if (active) {
          setError(err.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchPoll()

    // Connect to the Go WebSocket endpoint.
    const socket = new WebSocket(
      `ws://localhost:8080/ws/polls/${id}`
    )

    socket.onopen = () => {
      if (active) {
        setLiveConnected(true)
        console.log('Live poll connection established')
      }
    }

    // Receive updated poll data from the backend.
    socket.onmessage = (event) => {
      try {
        const updatedPoll = JSON.parse(event.data)

        if (active) {
          setPoll(updatedPoll)
        }

        console.log('Live poll results updated!')
      } catch (err) {
        console.error('Could not read live poll update:', err)
      }
    }

    socket.onerror = (err) => {
      console.error('WebSocket connection error:', err)
    }

    socket.onclose = () => {
      if (active) {
        setLiveConnected(false)
      }
    }

    // Clean up when leaving the poll page.
    return () => {
      active = false
      socket.close()
    }
  }, [id])

  // Submit vote.
  async function handleVote() {
    if (!selectedOption) {
      setMessage('Please select an option first.')
      return
    }

    try {
      setVoting(true)
      setMessage('')

      const response = await fetch(
        `http://localhost:8080/api/polls/${id}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            optionId: selectedOption,
            voterId: voterId
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not submit vote')
      }

      setMessage('Your vote was recorded successfully!')
      setSelectedOption('')

      // No manual refresh is needed.
      // Redis + WebSocket will send the updated poll.

    } catch (err) {
      setMessage(err.message)
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return <div className="poll-page">Loading poll...</div>
  }

  if (error) {
    return <div className="poll-page error">{error}</div>
  }

  if (!poll) {
    return <div className="poll-page">Poll not found.</div>
  }

  const totalVotes = poll.totalVotes || 0

  return (
    <div className="poll-page">
      <div className="poll-card">

        <span className="live-badge">
          ● {liveConnected ? 'LIVE CONNECTED' : 'CONNECTING...'}
        </span>

        <h1>{poll.question}</h1>

        <p className="vote-count">
          {totalVotes} total votes
        </p>

        <div className="poll-options">
          {poll.options.map((option) => {
            const percentage = totalVotes === 0
              ? 0
              : (option.votes / totalVotes) * 100

            return (
              <label
                className={`poll-choice ${
                  selectedOption === option.id ? 'selected' : ''
                }`}
                key={option.id}
              >
                <input
                  type="radio"
                  name="poll-option"
                  value={option.id}
                  checked={selectedOption === option.id}
                  onChange={() => setSelectedOption(option.id)}
                />

                <div className="choice-content">
                  <div className="choice-info">
                    <span>{option.text}</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <small>{option.votes} votes</small>
                </div>
              </label>
            )
          })}
        </div>

        <button
          className="vote-button"
          onClick={handleVote}
          disabled={voting || !selectedOption}
        >
          {voting ? 'Submitting...' : 'Submit Vote'}
        </button>

        {message && (
          <p className="vote-message">{message}</p>
        )}

      </div>
    </div>
  )
}

export default PollPage
