import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const Authors = () => {
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  const fetchAuthors = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users`)
      setAuthors(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      console.error('Error fetching authors:', err)
      setError('Failed to load authors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthors()
  }, [])

  usePostStream((event, payload) => {
    if (event === 'post_created' || event === 'post_deleted') {
      fetchAuthors()
    } else if (event === 'profile_updated') {
      setAuthors(prev => prev.map(a => 
        String(a._id || a.id) === String(payload._id) 
          ? { ...a, ...payload } 
          : a
      ))
    }
  })

  // HELPER: Resolves the avatar URL correctly
  const getAvatarUrl = (avatar) => {
    if (!avatar || avatar === 'default-avatar.png' || avatar === 'avatar-default.png') {
      return `${assetsBase}/avatars/default-avatar.png`;
    }
    return avatar.startsWith('http') ? avatar : `${assetsBase}/avatars/${avatar}`;
  }

  if (loading) return <section className="authors"><Loader size='small' /></section>

  return (
    <section className="authors">
      <h1 className='container h1__center'>Our Authors</h1>
      {error && <p className="center" style={{color: '#d32f2f'}}>{error}</p>}
      <div className="container authors__container">
        {authors.length > 0 ? (
          authors.map((author) => (
            <Link key={author._id} to={`/profile/${author._id}`} className='author' onClick={scrollTop}>
              <div className="author__avatar">
                <img 
                  src={getAvatarUrl(author.avatar)} 
                  alt={author.name} 
                  onError={(e) => { e.target.src = `${assetsBase}/avatars/default-avatar.png` }}
                />
              </div>
              <div className="author__info">
                <h4>{author.name}</h4>
                <p>{author.posts || 0} {author.posts === 1 ? 'post' : 'posts'}</p>
              </div>
            </Link>
          ))
        ) : <h2 className="center">No Authors Found</h2>}
      </div>
    </section>
  )
}

export default Authors
