import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from './components/axios' // Your custom instance with interceptors
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'
import DeletePost from './DeletePost' // Make sure this path is correct

const Dashboard = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)

  useEffect(() => {
    if (!currentUser?.token) return navigate('/login')

    const fetchUserPosts = async () => {
      try {
        const response = await axios.get(`/posts/users/${currentUser.id}`)
        setPosts(response.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchUserPosts()
  }, [currentUser, navigate])

  if (loading) return <Loader />

  return (
    <section className="dashboard">
      <div className="container dashboard__container">
        {posts.length > 0 ? (
          posts.map(post => (
            <article key={post._id} className='dashboard__post'>
              <div className="dashboard__post-info">
                <h5>{post.title}</h5>
              </div>
              <div className="dashboard__post-actions">
                <Link to={`/posts/${post._id}`} className="btn sm">View</Link>
                <Link to={`/posts/${post._id}/edit`} className="btn sm primary">Edit</Link>
                
                {/* USE THE COMPONENT HERE - NO LINK TAG AROUND IT */}
                <DeletePost postId={post._id} /> 
                
              </div>
            </article>
          ))
        ) : <h2 className='center'>No posts found.</h2>}
      </div>
    </section>
  )
}

export default Dashboard
