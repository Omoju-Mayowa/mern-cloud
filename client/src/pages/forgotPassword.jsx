import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios';
import { UserContext } from './components/context/userContext';

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const ForgotPassword = () => {
  const[userData, setUserData] = useState({
    email : '',
  })

  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const {setCurrentUser} = useContext(UserContext)

  const forgotUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/forgot-password`, userData)
      // OTP request succeeded; do not set currentUser here (we only requested an OTP)
      navigate('/changePassword')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred')
    }
  }


  const changeInputHandler = (e) => {
    setUserData(prevState => {
      return{...prevState, [e.target.name]: e.target.value}
    })
  }

  return (
    <section className="register">
      <div className="container">
        <h2>Sign Up</h2>
        <form className="form login__form" onSubmit={forgotUser}>
          {error && <p className="form__error-message">{error}</p>}
          <input type="email" placeholder='Enter your Email' name='email' value={userData.email} onChange={changeInputHandler} />
          <button type="submit" className='btn primary' onClick={scrollTop}>Requst OTP</button>
        </form>
      </div>
    </section>
  )
}

export default ForgotPassword