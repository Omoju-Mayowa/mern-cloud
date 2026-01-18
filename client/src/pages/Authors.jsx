import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const Authors = () => {
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users`)
        setAuthors(Array.isArray(response.data) ? response.data : [])
      } finally { setLoading(false) }
    }
    fetchAuthors()
  }, [])

  const getAvatarUrl = (avatar) => {
    if (!avatar || avatar.includes('default')) return `${assetsBase}/mern/default-avatar.png`;
    return avatar.startsWith('http') ? avatar : `${assetsBase}/mern/${avatar}`;
  }

  if (loading) return <section className="authors"><Loader size='small' /></section>

  return (
    <section className="authors">
      <h1 className='container h1__center'>Our Authors</h1>
      <div className="container authors__container">
        {authors.map((author) => (
          <Link key={author._id} to={`/profile/${author._id}`} className='author'>
            <div className="author__avatar">
              <img 
                src={getAvatarUrl(author.avatar)} 
                alt={author.name} 
                onError={(e) => { e.target.src = `${assetsBase}/mern/default-avatar.png` }}
              />
            </div>
            <div className="author__info">
              <h4>{author.name}</h4>
              <p>{author.posts || 0} posts</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Authors
