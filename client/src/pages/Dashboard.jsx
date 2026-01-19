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

  // Configuration for Cloudflare R2
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  
  // NOTE: Ensure this matches the EXACT file name in your R2 bucket (e.g., .jpg vs .png)
  const defaultThumbnail = `${assetsBase}/mern/post-placeholder.jpg`;

  useEffect(() => {
    if (!currentUser?.token) {
      navigate('/login')
    }

    const fetchUserPosts = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        })
        setPosts(response.data)
      } catch (err) {
        console.error("Could not fetch posts", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserPosts()
  }, [currentUser, navigate])

  /**
   * Smart Resolver for Thumbnails:
   * 1. If thumbnail is missing, use the default placeholder.
   * 2. If thumbnail is a full URL (starts with http), use it as is.
   * 3. If thumbnail is a path, ensure it has the correct 'mern/' prefix.
   */
  const resolveThumbnail = (thumbnailPath) => {
    if (!thumbnailPath) return defaultThumbnail;
    if (thumbnailPath.startsWith('http')) return thumbnailPath;

    // Check if the path already includes 'mern/' to avoid double-prefixing
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
                      // Prevent infinite loops if the placeholder is also missing
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
