import './PollOption.css'

function PollOption({ name, votes, percentage, onVote }) {

  return (
    <div className="poll-option">

      <div className="option-info">

        <span>{name}</span>

        <span>
          {votes} votes · {percentage.toFixed(1)}%
        </span>

      </div>

      <div className="progress-track">

        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`
          }}
        ></div>

      </div>

      <button onClick={onVote}>
        Vote for {name}
      </button>

    </div>
  )
}

export default PollOption