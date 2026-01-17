import React, { useState, useContext, useEffect } from 'react'
import  { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { UserContext } from './components/context/userContext'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'


const scrollTop = () => {
  window.scrollTo(0, 0);
}

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const {currentUser} = useContext(UserContext)
  const token = currentUser?.token
  
  //redirect to login page for users who haven't logged in
  useEffect(() => {
    if(!token) {
      navigate('/login')
      return
    }
    
    // Fetch user's posts
    const fetchUserPosts = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${currentUser.id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        setPosts(response.data || [])
        setError('')
      } catch (err) {
        console.error('Error fetching posts:', err)
        setError('Failed to load your posts.')
        setPosts([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserPosts()
  }, [token, currentUser, navigate])

  // Real-time updates via SSE
  usePostStream((event, payload) => {
    if (!currentUser) return
    
    if (event === 'post_created' && String(payload.creator) === String(currentUser.id)) {
      setPosts(prev => [payload, ...prev])
    } else if (event === 'post_updated') {
      const updatedPost = payload
      if (String(updatedPost.creator) === String(currentUser.id)) {
        setPosts(prev => prev.map(p => (String(p._id) === String(updatedPost._id) ? updatedPost : p)))
      }
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    }
  })
  
  if (loading) {
    return (
      <section className="dashboard">
        <Loader />
      </section>
    )
  }
  
  return (
    <section className="dashboard">
      {
        posts.length ? <div className="container dashboard__container">
          {
            posts.map(post => {
              return <article key={post._id} className='dashboard__post'>
                <div className="dashboard__post-info">
                  <div className="dashboard__post-thumbnail">
                    <img src={`${(import.meta.env.VITE_API_BASE_URL || '').replace('/api', '')}/uploads/${post.thumbnail}`} alt="" />
                  </div>
                  <h5>{post.title.length > 60 ? post.title.substr(0, 60) + '...' : post.title}</h5>
                </div>
                <div className="dashboard__post-actions">
                  <Link onClick={scrollTop} to={`/posts/${post._id}`} className="btn sm">View</Link>
                  <Link onClick={scrollTop} to={`/posts/${post._id}/edit`} className="btn sm primary">Edit</Link>
                  <Link onClick={scrollTop} to={`/posts/${post._id}/delete`} className="btn sm danger">Delete</Link>
                </div>
              </article>
            })
          }
        </div> : <h2 className='center'>You have no posts yet. {error && <p style={{color: '#d32f2f'}}>{error}</p>}</h2>
      }
    </section>
  )
}

export default Dashboard
