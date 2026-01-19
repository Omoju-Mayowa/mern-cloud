import React, { useContext, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import axios from '../components/axios' // Import our custom instance
import { UserContext } from './components/context/userContext'

const Login = () => {
  const [userData, setUserData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setCurrentUser } = useContext(UserContext)

  // Check if we arrived here because of an expired session
  const location = useLocation();
  const isExpired = new URLSearchParams(location.search).get('error') === 'expired';

  const changeInputHandler = (e) => {
    setUserData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const loginUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await axios.post(`/users/login`, userData)
      setCurrentUser(response.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    }
  }

  return (
    <section className="register">
      <div className="container">
        <h2>Sign In</h2>
        <form className="form login__form" onSubmit={loginUser}>
          {isExpired && <p className="form__error-message">Session expired. Please log in again.</p>}
          {error && <p className="form__error-message">{error}</p>}
          <input type="email" placeholder='Email' name='email' value={userData.email} onChange={changeInputHandler} autoFocus />
          <input type="password" placeholder='Password' name='password' value={userData.password} onChange={changeInputHandler} />
          <button type="submit" className='btn primary'>Login</button>
        </form>
        <small>Don't have an account? <Link to="/register">Sign Up</Link></small>
        <small><Link to="/forgotPassword">Forgot Password?</Link></small>
      </div>
    </section>
  )
}

export default Login
