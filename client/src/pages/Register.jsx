import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const Register = () => {
  const[userData, setUserData] = useState({
    name : '',
    email : '',
    password : '',
    password2 : ''
  })

  const [error, setError] = useState('')
  const navigate = useNavigate()

  const changeInputHandler = (e) => {
    setUserData(prevState => {
      return{...prevState, [e.target.name]: e.target.value}
    })
  }

  const registerUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      console.log('Sending registration request to:', `${import.meta.env.VITE_API_BASE_URL}/users/register`)
      console.log('User data:', userData)
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/register`, userData)
      const newUser = response.data
      console.log('Registration success:', newUser)
      if(!newUser) {
        setError('Registration failed. Please try again.')
      } else {
          useEffect(() => {
    navigate('/login')
  }, [])
      }
    } catch (err) {
      console.error('Registration error:', err)
      console.error('Error response:', err.response)
      setError(err.response?.data?.message || err.message || 'An error occurred')
    }
  }

  return (
    <section className="register">
      <div className="container">
        <h2>Sign Up</h2>
        <form className="form register__form" onSubmit={registerUser}>
          {error && <p className="form__error-message">{error}</p>}
          <input type="text" placeholder='Full Name' name='name' value={userData.name} onChange={changeInputHandler} autoFocus/>
          <input type="email" placeholder='Email' name='email' value={userData.email} onChange={changeInputHandler} />
          <input type="password" placeholder='Password' name='password' value={userData.password} onChange={changeInputHandler} />
          <input type="password" placeholder='Confirm Password' name='password2' value={userData.password2} onChange={changeInputHandler} />
          <button type="submit" className='btn primary' onClick={scrollTop}>Register</button>
        </form>
        <small>Already have an account? <Link to="/login" onClick={scrollTop}>Sign In</Link></small>
      </div>
    </section>
  )
}

export default Register