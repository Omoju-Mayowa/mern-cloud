import React from 'react'
import './errorcss.css'
import { Link } from 'react-router-dom'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const ErrorPage = () => {
  return (
    <section className='error-page'>
      <div className="center">
        <h1>😒</h1>
        <h2>You Know What To Do 👇</h2>
        <Link to="/" onClick={scrollTop} className='btn primary'>Go Back Home</Link>
      </div>
    </section>
  )
}

export default ErrorPage