import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { UserContext } from './components/context/userContext'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    if (!currentUser?.token) {
      navigate('/login')
      return
    }

    const fetchUserPosts = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        })
        setPosts(response.data || [])
      } finally { setLoading(false) }
    }
    fetchUserPosts()
  }, [currentUser, navigate])

  usePostStream((event, payload) => {
    if (event === 'post_created' && String(payload.creator) === String(currentUser?.id)) {
      setPosts(prev => [payload, ...prev])
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    }
  })

  if (loading) return <section className="dashboard"><Loader /></section>

  return (
    <section className="dashboard">
      {posts.length > 0 ? (
        <div className="container dashboard__container">
          {posts.map(post => (
            <article key={post._id} className='dashboard__post'>
              <div className="dashboard__post-info">
                <div className="dashboard__post-thumbnail">
                  <img 
                    src={post.thumbnail?.startsWith('http') ? post.thumbnail : `${assetsBase}/mern/${post.thumbnail}`} 
                    alt={post.title} 
                    onError={(e) => e.target.src = `${assetsBase}/mern/default-avatar.png`}
                  />
                </div>
                <h5>{post.title.length > 60 ? post.title.substr(0, 60) + '...' : post.title}</h5>
              </div>
              <div className="dashboard__post-actions">
                <Link onClick={scrollTop} to={`/posts/${post._id}`} className="btn sm">View</Link>
                <Link onClick={scrollTop} to={`/posts/${post._id}/edit`} className="btn sm primary">Edit</Link>
                <Link onClick={scrollTop} to={`/posts/${post._id}/delete`} className="btn sm danger">Delete</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <h2 className='center'>You have no posts yet.</h2>
      )}
    </section>
  )
}

export default Dashboard
