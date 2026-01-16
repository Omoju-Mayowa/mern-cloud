import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const OTP = () => {
  const[userData, setUserData] = useState({
    otp: ''
  })

  const changeInputHandler = (e) => {
    setUserData(prevState => {
      return{...prevState, [e.target.name]: e.target.value}
    })
  }

  return (
    <section className="register">
      <div className="container">
        <h2>Sign Up</h2>
        <form className="form login__form">
          <p className="form__error-message">This is an error message</p>
          <input type="text" placeholder='Enter You Otp Code' name='otp' value={userData.otp} onChange={changeInputHandler} />
          <button type="submit" className='btn primary' onClick={scrollTop}>Submit OTP</button>
        </form>
      </div>
    </section>
  )
}

export default OTP