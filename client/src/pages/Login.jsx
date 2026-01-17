import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios';
import {UserContext} from './components/context/userContext'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const Login = () => {
  const[userData, setUserData] = useState({
    email : '',
    password : ''
  })

  const [error, setError] = useState('')
  const navigate = useNavigate()

  const {setCurrentUser} = useContext(UserContext)

  const changeInputHandler = (e) => {
    setUserData(prevState => {
      return{...prevState, [e.target.name]: e.target.value}
    })
  }

  const loginUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/login`, userData)
      const user = response.data
      setCurrentUser(user)
      navigate('/')
    } catch (err) {
      console.error('Login failed:', err.response?.status, err.response?.data || err.message)
      setError(err.response?.data?.message || err.message || 'An error occurred')
    }
  }

  return (
    <section className="register">
      <div className="container">
        <h2>Sign In</h2>
        <form className="form login__form" onSubmit={loginUser}>
          {error && <p className="form__error-message">{error}</p>}
          <input type="email" placeholder='Email' name='email' value={userData.email} onChange={changeInputHandler} autoFocus />
          <input type="password" placeholder='Password' name='password' value={userData.password} onChange={changeInputHandler} />
          <button type="submit" className='btn primary' onClick={scrollTop}>Login</button>
        </form>
        <small>Don't have an account? <Link to="/register" onClick={scrollTop}>Sign Up</Link></small>
        <small><Link to="/forgotPassword" onClick={scrollTop}>Forgot Password?</Link></small>
      </div>
    </section>
  )
}

export default Login