import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    if (!currentUser?.token) { navigate('/login') }
    const fetchUserPosts = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        })
        setPosts(response.data)
      } finally { setLoading(false) }
    }
    fetchUserPosts()
  }, [])

  if (loading) return <Loader />

  return (
    <section className="dashboard">
      <div className="container dashboard__container">
        {posts.length > 0 ? posts.map(post => (
          <article key={post._id} className='dashboard__post'>
            <div className="dashboard__post-info">
              <div className="dashboard__post-thumbnail">
                <img 
                  src={post.thumbnail ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${assetsBase}/mern/${post.thumbnail}`) : `${assetsBase}/mern/post-placeholder.png`} 
                  alt="" 
                  onError={e => e.target.src = `${assetsBase}/mern/post-placeholder.png`}
                />
              </div>
              <h5>{post.title}</h5>
            </div>
            <div className="dashboard__post-actions">
              <Link to={`/posts/${post._id}`} className="btn sm">View</Link>
              <Link to={`/posts/${post._id}/edit`} className="btn sm primary">Edit</Link>
              <Link to={`/posts/${post._id}/delete`} className="btn sm danger">Delete</Link>
            </div>
          </article>
        )) : <h2 className='center'>No posts found.</h2>}
      </div>
    </section>
  )
}

export default Dashboard
