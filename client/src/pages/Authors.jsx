import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const Authors = () => {
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users`)
        const authorsData = Array.isArray(response.data) ? response.data : []
        setAuthors(authorsData)
        setError('')
      } catch (err) {
        console.error('Error fetching authors:', err)
        setError('Failed to load authors.')
        setAuthors([])
      } finally {
        setLoading(false)
      }
    }

    fetchAuthors()
  }, [])

  // Real-time updates via SSE
  usePostStream((event, payload) => {
    if (event === 'post_created' || event === 'post_deleted') {
      // Refetch authors to update post counts
      const fetchAuthors = async () => {
        try {
          const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users`)
          const authorsData = Array.isArray(response.data) ? response.data : []
          setAuthors(authorsData)
        } catch (err) {
          console.error('Error refetching authors:', err)
        }
      }
      fetchAuthors()
    } else if (event === 'profile_updated') {
      // Update author in real-time when profile changes
      setAuthors(prev => prev.map(a => 
        String(a._id || a.id) === String(payload._id) 
          ? { ...a, name: payload.name, avatar: payload.avatar, posts: payload.posts }
          : a
      ))
    }
  })

  if (loading) {
    return (
      <section className="authors">
        <h1 className='container h1__center'>Our Authors</h1>
        <Loader size='small' />
      </section>
    )
  }

  const baseUrl = import.meta.env.VITE_API_ASSETS_URL || ''
  const assetsBase = baseUrl.replace('/api', '') || baseUrl

  return (
    <section className="authors">
      <h1 className='container h1__center'>Our Authors</h1>
      {error && <p className="center" style={{color: '#d32f2f'}}>{error}</p>}
      {authors.length > 0 ? (
        <div className="container authors__container">
          {authors.map((author) => {
            const authorId = author._id || author.id
            const authorName = author.name || 'Unknown'
            const postCount = author.posts || 0
            const avatarSrc = author.avatar 
              ? `${assetsBase}/uploads/${author.avatar}` 
              : `${assetsBase}/uploads/default-avatar.png`
            
            return (
              <Link 
                key={authorId} 
                to={`/profile/${authorId}`} 
                className='author'
                onClick={scrollTop}
              >
                <div className="author__avatar">
                  <img src={avatarSrc} alt={`Image of ${authorName}`} />
                </div>
                <div className="author__info">
                  <h4>{authorName}</h4>
                  <p>{postCount} {postCount === 1 ? 'post' : 'posts'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <h2 className="center">No Authors Found</h2>
      )}
    </section>
  )
}

export default Authors
