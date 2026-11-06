
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CreatePoll from './components/CreatePoll'
import PollPage from './components/PollPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<CreatePoll />} />

        <Route path="/poll/:id" element={<PollPage />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
