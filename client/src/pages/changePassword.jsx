import axios from 'axios';
import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserContext } from './components/context/userContext';

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const ChangePassword = () => {
  const[userData, setUserData] = useState({
    otp: '',
    newPassword: ''
  })

  const changeInputHandler = (e) => {
    setUserData(prevState => {
      return{...prevState, [e.target.name]: e.target.value}
    })
  }

  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const {setCurrentUser} = useContext(UserContext)

  const changePassword = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/reset-password`, userData)
      const user = response?.data
      setCurrentUser(user)
      // After successful reset the server returns a login payload; sign the user in and go home
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred')
    }
  }



  return (
    <section className="register">
      <div className="container">
        <h2>Sign Up</h2>
        <form className="form login__form" onSubmit={changePassword}>
          {error && <p className="form__error-message">{error}</p>}
          <input type="number" placeholder='Enter Your OTP Code' name='otp' value={userData.otp} onChange={changeInputHandler} />
          <input type="password" placeholder='Enter Your New Password' name='newPassword' value={userData.newPassword} onChange={changeInputHandler} />
          <button type="submit" className='btn primary' onClick={scrollTop}>Change Password</button>
        </form>
      </div>
    </section>
  )
}

export default ChangePassword