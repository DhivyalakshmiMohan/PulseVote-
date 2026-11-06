
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL, WS_URL } from '../config'
import './PollPage.css'

function PollPage() {
  const { id } = useParams()

  const [poll, setPoll] = useState(null)
  const [selectedOption, setSelectedOption] = useState('')
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING...')

  useEffect(() => {
    let socket
    let reconnectTimer
    let isActive = true

    async function fetchPoll() {
      try {
        const response = await fetch(`${API_URL}/api/polls/${id}`)

        if (!response.ok) {
          throw new Error('Could not load this poll.')
        }

        const data = await response.json()

        if (isActive) {
          setPoll(data)
          setError('')
        }
      } catch (err) {
        if (isActive) {
          setError(err.message)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    function connectWebSocket() {
      if (!isActive) return

      socket = new WebSocket(`${WS_URL}/ws/polls/${id}`)

      socket.onopen = () => {
        if (isActive) {
          setConnectionStatus('LIVE CONNECTED')
        }
      }

      socket.onmessage = event => {
        try {
          const updatedPoll = JSON.parse(event.data)

          if (isActive) {
            setPoll(updatedPoll)
            setError('')
          }
        } catch {
          console.error('Received invalid poll update.')
        }
      }

      socket.onerror = () => {
        if (isActive) {
          setConnectionStatus('CONNECTION ERROR')
        }
      }

      socket.onclose = () => {
        if (!isActive) return

        setConnectionStatus('RECONNECTING...')

        reconnectTimer = setTimeout(() => {
          connectWebSocket()
        }, 3000)
      }
    }

    fetchPoll()
    connectWebSocket()

    return () => {
      isActive = false
      clearTimeout(reconnectTimer)

      if (socket) {
        socket.close()
      }
    }
  }, [id])

  async function handleVote() {
    if (!selectedOption) {
      setError('Please select an option before voting.')
      return
    }

    setVoting(true)
    setError('')

    try {
      let voterId = localStorage.getItem('pulsevote_voter_id')

      if (!voterId) {
        voterId = crypto.randomUUID()
        localStorage.setItem('pulsevote_voter_id', voterId)
      }

      const response = await fetch(`${API_URL}/api/polls/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optionId: selectedOption,
          voterId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Voting failed.')
      }

      if (data.poll) {
        setPoll(data.poll)
      } else {
        const updatedResponse = await fetch(`${API_URL}/api/polls/${id}`)

        if (updatedResponse.ok) {
          const updatedPoll = await updatedResponse.json()
          setPoll(updatedPoll)
        }
      }

      setSelectedOption('')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return <div className="poll-page">Loading poll...</div>
  }

  if (!poll) {
    return (
      <div className="poll-page">
        <p>{error || 'Poll not found.'}</p>
      </div>
    )
  }

  const totalVotes = poll.totalVotes || 0

  return (
    <main className="poll-page">
      <div className="poll-card">
        <div className="poll-status">
          <span>{connectionStatus}</span>
        </div>

        <h1>{poll.question}</h1>

        <p className="total-votes">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </p>

        <div className="poll-options">
          {poll.options.map(option => {
            const percentage =
              totalVotes > 0
                ? Math.round((option.votes / totalVotes) * 100)
                : 0

            return (
              <label
                className={`poll-option ${
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

                <div className="poll-option-content">
                  <div className="poll-option-info">
                    <span>{option.text}</span>
                    <strong>{percentage}%</strong>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <small>
                    {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                  </small>
                </div>
              </label>
            )
          })}
        </div>

        <button
          className="vote-button"
          onClick={handleVote}
          disabled={!selectedOption || voting}
        >
          {voting ? 'Submitting...' : 'Submit vote'}
        </button>

        {error && <p className="error-message">{error}</p>}
      </div>
    </main>
  )
}

export default PollPage
