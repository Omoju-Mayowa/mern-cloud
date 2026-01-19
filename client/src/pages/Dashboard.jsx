import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// CRITICAL: Import your CUSTOM axios instance, not the default one
import axios from '../components/axios' 
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  const defaultThumbnail = `${assetsBase}/mern/post-placeholder.jpg`;

  useEffect(() => {
    // 1. Initial Frontend Check
    if (!currentUser?.token) {
      navigate('/login')
      return; // Stop execution
    }

    const fetchUserPosts = async () => {
      try {
        // 2. We use the custom axios. Base URL and Headers are now handled by the interceptor
        // but we can still pass headers manually if your interceptor isn't using the "Request" trick yet.
        const response = await axios.get(`/posts/users/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        })
        setPosts(response.data)
      } catch (err) {
        // 3. If this is a 401, the interceptor in ../axios.js will catch it 
        // and trigger the window.location.href redirect before this console.error runs.
        console.error("Could not fetch posts", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserPosts()
  }, [currentUser, navigate])

  const resolveThumbnail = (thumbnailPath) => {
    if (!thumbnailPath) return defaultThumbnail;
    if (thumbnailPath.startsWith('http')) return thumbnailPath;
    const cleanPath = thumbnailPath.startsWith('mern/') ? thumbnailPath : `mern/${thumbnailPath}`;
    return `${assetsBase}/${cleanPath}`;
  };

  if (loading) return <Loader />

  return (
    <section className="dashboard">
      <div className="container dashboard__container">
        {posts.length > 0 ? (
          posts.map(post => (
            <article key={post._id} className='dashboard__post'>
              <div className="dashboard__post-info">
                <div className="dashboard__post-thumbnail">
                  <img 
                    src={resolveThumbnail(post.thumbnail)} 
                    alt={post.title} 
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = defaultThumbnail;
                    }}
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
          ))
        ) : (
          <h2 className='center'>No posts found.</h2>
        )}
      </div>
    </section>
  )
}

export default Dashboard
