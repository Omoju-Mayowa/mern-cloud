import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from './components/axios' // Verify this path!
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'
import DeletePost from './DeletePost'

// Smart Resolver for Dashboard Media (Consistency with PostItem)
const resolveMediaUrl = (path, folder = 'mern') => {
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  if (!path || path.includes('placeholder')) {
      return `${assetsBase}/${folder}/post-placeholder.png`;
  }
  if (path.startsWith('http')) return path;
  
  // Check if prefix folder is already present in the path
  const cleanPath = path.startsWith(`${folder}/`) ? path : `${folder}/${path}`;
  return `${assetsBase}/${cleanPath}`;
};

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)

  useEffect(() => {
    // If no user is logged in, redirect to login
    if (!currentUser?.token) {
      navigate('/login')
      return
    }

    const fetchUserPosts = async () => {
      setLoading(true)
      try {
        const response = await axios.get(`/posts/users/${currentUser.id}`)
        
        // Ensure we are setting an array even if the backend sends something else
        const data = Array.isArray(response.data) ? response.data : []
        setPosts(data)
      } catch (err) {
        console.error("Dashboard Fetch Error:", err)
        setError("Failed to fetch posts. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchUserPosts()
  }, [currentUser?.id, currentUser?.token, navigate])

  if (loading) return <Loader />

  return (
    <section className="dashboard">
      <div className="container dashboard__container">
        {error && <p className="form__error-message center">{error}</p>}
        
        {posts.length > 0 ? (
          <div className="dashboard__posts-layout">
            {posts.map(post => (
              <article key={post._id} className='dashboard__post'>
                <div className="dashboard__post-info">
                  <div className="dashboard__post-thumbnail">
                     {/* Updated to use resolveMediaUrl for R2 Bucket Support */}
                     <img 
                       src={resolveMediaUrl(post.thumbnail)} 
                       alt={post.title} 
                     />
                  </div>
                  <h5>{post.title}</h5>
                </div>
                <div className="dashboard__post-actions">
                  <Link to={`/posts/${post._id}`} className="btn sm">View</Link>
                  <Link to={`/posts/${post._id}/edit`} className="btn sm primary">Edit</Link>
                  <DeletePost postId={post._id} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="center">
            <h2>You have no posts yet.</h2>
            <Link to="/create" className="btn primary">Create Your First Post</Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default Dashboard
